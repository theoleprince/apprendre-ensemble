package org.formation.api.web;

import org.formation.api.service.MediaStorage;
import org.formation.api.web.dto.Dtos.MediaUpload;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api")
public class MediaController {

    private final MediaStorage storage;

    public MediaController(MediaStorage storage) {
        this.storage = storage;
    }

    /** Televersement (medias de lecon par les formateurs, videos de pratique par les apprenants). */
    @PostMapping("/media")
    public MediaUpload upload(@RequestParam("file") MultipartFile file) {
        return storage.store(file);
    }

    /**
     * Diffusion des medias. Spring gere les requetes partielles (Range) : lecture progressive de la video
     * et reprise des telechargements interrompus sur reseau instable.
     */
    @GetMapping("/media/{name}")
    public ResponseEntity<Resource> media(@PathVariable String name) {
        return storage.load(name)
                .map(r -> ResponseEntity.ok()
                        .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePrivate().immutable())
                        .contentType(name.endsWith(".vtt") ? new org.springframework.http.MediaType("text", "vtt", java.nio.charset.StandardCharsets.UTF_8)
                                : MediaTypeFactory.getMediaType(r).orElse(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM))
                        .body(r))
                .orElse(ResponseEntity.notFound().build());
    }
}
