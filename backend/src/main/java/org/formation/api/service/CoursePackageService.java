package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Domain;
import org.formation.api.repository.CourseRepository;
import org.formation.api.repository.DomainRepository;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Paquet de cours transferable (ZIP) : tout un cours, sa presentation, ses lecons, ses exercices et ses medias.
 * Sert a migrer un module vers une autre instance (un pays, une institution : bien public numerique)
 * et a sauvegarder un contenu independamment de la base. Format documente : course.json + media/.
 * Un cours importe arrive depublie : l'equipe le relit avant de l'ouvrir.
 */
@Service
public class CoursePackageService {

    public static final String FORMAT = "formation-course";
    public static final int VERSION = 1;
    static final long MAX_ENTRY_BYTES = 1024L * 1024 * 1024;
    private static final Pattern MEDIA_URL = Pattern.compile("^/api/media/([a-f0-9-]{36}\\.[a-z0-9]{2,5})$");

    private final AdminService admin;
    private final MediaStorage media;
    private final DomainRepository domains;
    private final CourseRepository courses;
    private final String publicUrl;
    private final ObjectMapper json = JsonMapper.builder().build();

    public CoursePackageService(AdminService admin, MediaStorage media, DomainRepository domains, CourseRepository courses,
                                @Value("${app.public-url:http://localhost:4200}") String publicUrl) {
        this.admin = admin;
        this.media = media;
        this.domains = domains;
        this.courses = courses;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    public record Manifest(String format, int version, Instant exportedAt, String source, String domainName,
                           CourseInput course, List<String> media) {
    }

    @Transactional(readOnly = true)
    public byte[] export(Long courseId) {
        CourseInput in = admin.getCourse(courseId);
        String domainName = courses.findById(courseId).map(c -> c.getDomain() == null ? null : c.getDomain().getName()).orElse(null);
        Set<String> names = new LinkedHashSet<>();
        for (LessonInput l : in.lessons()) {
            mediaName(l.mediaUrl()).ifPresent(names::add);
            mediaName(l.subtitlesUrl()).ifPresent(names::add);
        }
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            Manifest m = new Manifest(FORMAT, VERSION, Instant.now(), publicUrl, domainName, in, List.copyOf(names));
            zip.putNextEntry(new ZipEntry("course.json"));
            zip.write(json.writerWithDefaultPrettyPrinter().writeValueAsBytes(m));
            zip.closeEntry();
            for (String n : names) {
                Optional<Resource> r = media.load(n);
                if (r.isEmpty()) continue;
                zip.putNextEntry(new ZipEntry("media/" + n));
                try (InputStream is = r.get().getInputStream()) {
                    is.transferTo(zip);
                }
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Export du cours impossible");
        }
        return bytes.toByteArray();
    }

    /** Importe un paquet : medias recopies (signature verifiee), adresses reecrites, cours cree depublie. */
    @Transactional
    public AdminCourse importPackage(MultipartFile file, AppUser by) {
        Manifest m = null;
        Map<String, byte[]> files = new HashMap<>();
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(file.getInputStream())) {
            ZipEntry e;
            while ((e = zip.getNextEntry()) != null) {
                if (e.isDirectory()) continue;
                String name = e.getName();
                if (name.contains("..") || name.startsWith("/")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paquet invalide : chemin interdit " + name);
                }
                byte[] data = zip.readNBytes((int) Math.min(MAX_ENTRY_BYTES, Integer.MAX_VALUE - 8));
                total += data.length;
                if (total > 2 * MAX_ENTRY_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Paquet trop volumineux");
                if (name.equals("course.json")) m = json.readValue(data, Manifest.class);
                else if (name.startsWith("media/")) files.put(name.substring(6), data);
            }
        } catch (IOException | tools.jackson.core.JacksonException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paquet de cours illisible");
        }
        if (m == null || !FORMAT.equals(m.format()) || m.course() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce fichier n'est pas un paquet de cours");
        }
        if (m.version() > VERSION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Version de paquet non prise en charge : " + m.version());
        }
        Map<String, String> moved = new HashMap<>();
        for (Map.Entry<String, byte[]> f : files.entrySet()) {
            moved.put(f.getKey(), media.storeBytes(f.getKey(), f.getValue(), by).url());
        }
        CourseInput c = m.course();
        List<LessonInput> lessons = c.lessons().stream().map(l -> new LessonInput(l.title(), l.mediaType(),
                remap(l.mediaUrl(), moved), l.mediaSizeBytes(), remap(l.subtitlesUrl(), moved), l.content(), l.practiceTask(),
                l.durationMinutes())).toList();
        final String domainName = m.domainName();
        Long domainId = domainName == null ? null
                : domains.findAll().stream().filter(d -> d.getName().equalsIgnoreCase(domainName)).map(Domain::getId).findFirst().orElse(null);
        CourseInput copy = new CourseInput(c.title(), c.description(), c.icon(), c.type(), c.countryCode(), c.languageCode(),
                c.targetRoles(), c.allowedCohorts(), c.allowedRegions(), c.passScore(), c.masteryScore(), c.expertiseEnabled(),
                false, lessons, c.questions(), domainId, c.price(), c.presentation());
        return admin.create(copy);
    }

    private static Optional<String> mediaName(String url) {
        if (url == null) return Optional.empty();
        Matcher m = MEDIA_URL.matcher(url);
        return m.matches() ? Optional.of(m.group(1)) : Optional.empty();
    }

    /** Media du paquet : nouvelle adresse locale. Media absent du paquet : on garde l'adresse (ex. lien externe). */
    private static String remap(String url, Map<String, String> moved) {
        return mediaName(url).map(n -> moved.getOrDefault(n, url)).orElse(url);
    }
}
