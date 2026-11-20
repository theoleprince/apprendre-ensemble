package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.MediaFile;
import org.formation.api.repository.MediaFileRepository;
import org.formation.api.web.dto.Dtos.MediaUpload;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Stockage des medias. Noms aleatoires (UUID). Le type declare par le client est verifie sur les premiers octets
 * du fichier (signature) : un executable renomme en .mp4 est refuse.
 * Les fichiers des apprenants sont PRIVES (lien signe), ceux de l'equipe pedagogique PUBLICS (contenus de cours).
 * En production multi-instances : stockage objet S3 (Suisse/UE).
 */
@Service
public class MediaStorage {

    private static final Map<String, String> ALLOWED = Map.of(
            "video/mp4", "mp4", "video/webm", "webm",
            "audio/mpeg", "mp3", "audio/mp4", "m4a", "audio/ogg", "ogg", "audio/webm", "weba",
            "text/vtt", "vtt", "image/jpeg", "jpg", "image/png", "png", "application/pdf", "pdf");
    private static final Pattern SAFE_NAME = Pattern.compile("^[a-f0-9-]{36}\\.[a-z0-9]{2,5}$");
    /** Taille maximale d'un fichier d'apprenant (une video de pratique compressee sur telephone). */
    static final long LEARNER_MAX_BYTES = 100L * 1024 * 1024;

    private final Path root;
    private final MediaFileRepository files;

    public MediaStorage(@Value("${app.media.dir:./data/media}") String dir, MediaFileRepository files) throws IOException {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        this.files = files;
        Files.createDirectories(root);
    }

    public MediaUpload store(MultipartFile file, AppUser owner, boolean publicContent) {
        String type = file.getContentType() == null ? "" : file.getContentType().split(";")[0].trim().toLowerCase();
        String ext = ALLOWED.get(type);
        if (ext == null && file.getOriginalFilename() != null && file.getOriginalFilename().toLowerCase().endsWith(".vtt")) {
            ext = "vtt";
            type = "text/vtt";
        }
        if (ext == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Format non accepté : " + type);
        }
        if (!publicContent && file.getSize() > LEARNER_MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Fichier trop volumineux (100 Mo maximum)");
        }
        byte[] head = new byte[16];
        try (InputStream in = file.getInputStream()) {
            int n = in.readNBytes(head, 0, head.length);
            if (!matchesSignature(ext, head, n)) {
                throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Le contenu du fichier ne correspond pas à son type");
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier illisible");
        }
        String name = UUID.randomUUID() + "." + ext;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, root.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Échec de l'enregistrement du fichier");
        }
        MediaFile m = new MediaFile();
        m.setName(name);
        m.setOwner(owner);
        m.setVisibility(publicContent ? MediaFile.Visibility.PUBLIC : MediaFile.Visibility.PRIVATE);
        m.setContentType(type);
        m.setSizeBytes(file.getSize());
        files.save(m);
        return new MediaUpload("/api/media/" + name, file.getSize(), type);
    }

    /**
     * Enregistre un contenu pedagogique (public) a partir d'octets : import d'un paquet de cours.
     * Meme controle de la signature du fichier que pour un televersement.
     */
    public MediaUpload storeBytes(String originalName, byte[] data, AppUser owner) {
        String lower = originalName == null ? "" : originalName.toLowerCase();
        String ext = lower.contains(".") ? lower.substring(lower.lastIndexOf('.') + 1) : "";
        String type = ALLOWED.entrySet().stream().filter(e -> e.getValue().equals(ext)).map(Map.Entry::getKey).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Format non accepté : " + originalName));
        if (!matchesSignature(ext, data, Math.min(16, data.length))) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Le contenu du fichier ne correspond pas à son type : " + originalName);
        }
        String name = UUID.randomUUID() + "." + ext;
        try {
            Files.write(root.resolve(name), data);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Échec de l'enregistrement du fichier");
        }
        MediaFile m = new MediaFile();
        m.setName(name);
        m.setOwner(owner);
        m.setVisibility(MediaFile.Visibility.PUBLIC);
        m.setContentType(type);
        m.setSizeBytes(data.length);
        files.save(m);
        return new MediaUpload("/api/media/" + name, data.length, type);
    }

    /** Fichiers sans fiche (medias d'origine du jeu de demonstration) : contenus pedagogiques, donc publics. */
    public boolean isPrivate(String name) {
        return files.findById(name).map(m -> m.getVisibility() == MediaFile.Visibility.PRIVATE).orElse(false);
    }

    public Optional<Resource> load(String name) {
        if (!SAFE_NAME.matcher(name).matches()) return Optional.empty();
        Path p = root.resolve(name).normalize();
        if (!p.startsWith(root) || !Files.isRegularFile(p)) return Optional.empty();
        return Optional.of(new FileSystemResource(p));
    }

    public void delete(String name) {
        if (!SAFE_NAME.matcher(name).matches()) return;
        try {
            Files.deleteIfExists(root.resolve(name).normalize());
        } catch (IOException ignored) {
            // fichier deja absent ou verrouille : la fiche est supprimee quand meme
        }
        files.deleteById(name);
    }

    /** Signatures de fichiers (magic numbers). */
    static boolean matchesSignature(String ext, byte[] h, int n) {
        if (n < 4) return false;
        String ascii = new String(h, 0, n, StandardCharsets.ISO_8859_1);
        return switch (ext) {
            case "mp4", "m4a" -> n >= 8 && ascii.startsWith("ftyp", 4);
            case "webm", "weba" -> (h[0] & 0xFF) == 0x1A && (h[1] & 0xFF) == 0x45 && (h[2] & 0xFF) == 0xDF && (h[3] & 0xFF) == 0xA3;
            case "mp3" -> ascii.startsWith("ID3") || ((h[0] & 0xFF) == 0xFF && (h[1] & 0xE0) == 0xE0);
            case "ogg" -> ascii.startsWith("OggS");
            case "pdf" -> ascii.startsWith("%PDF");
            case "png" -> (h[0] & 0xFF) == 0x89 && ascii.startsWith("PNG", 1);
            case "jpg" -> (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF;
            case "vtt" -> ascii.startsWith("WEBVTT") || ascii.startsWith("ï»¿WEBVTT");
            default -> false;
        };
    }
}
