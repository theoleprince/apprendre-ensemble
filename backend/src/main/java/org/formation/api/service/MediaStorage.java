package org.formation.api.service;

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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Stockage des medias (videos, audios, sous-titres, videos de portfolio) sur disque / volume.
 * Noms de fichiers aleatoires (UUID) : non devinables. En production : stockage objet S3 (Suisse/UE) possible.
 */
@Service
public class MediaStorage {

    private static final Map<String, String> ALLOWED = Map.of(
            "video/mp4", "mp4", "video/webm", "webm",
            "audio/mpeg", "mp3", "audio/mp4", "m4a", "audio/ogg", "ogg", "audio/webm", "weba",
            "text/vtt", "vtt", "image/jpeg", "jpg", "image/png", "png", "application/pdf", "pdf");
    private static final Pattern SAFE_NAME = Pattern.compile("^[a-f0-9-]{36}\\.[a-z0-9]{2,5}$");

    private final Path root;

    public MediaStorage(@Value("${app.media.dir:./data/media}") String dir) throws IOException {
        this.root = Path.of(dir).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    public MediaUpload store(MultipartFile file) {
        String type = file.getContentType() == null ? "" : file.getContentType().split(";")[0].trim().toLowerCase();
        String ext = ALLOWED.get(type);
        if (ext == null && file.getOriginalFilename() != null && file.getOriginalFilename().toLowerCase().endsWith(".vtt")) {
            ext = "vtt";
            type = "text/vtt";
        }
        if (ext == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Format non accepte : " + type);
        }
        String name = UUID.randomUUID() + "." + ext;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, root.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Echec de l'enregistrement du fichier");
        }
        return new MediaUpload("/api/media/" + name, file.getSize(), type);
    }

    public Optional<Resource> load(String name) {
        if (!SAFE_NAME.matcher(name).matches()) return Optional.empty();
        Path p = root.resolve(name).normalize();
        if (!p.startsWith(root) || !Files.isRegularFile(p)) return Optional.empty();
        return Optional.of(new FileSystemResource(p));
    }
}
