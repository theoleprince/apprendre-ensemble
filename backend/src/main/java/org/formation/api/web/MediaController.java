package org.formation.api.web;

import org.formation.api.domain.AppUser;
import org.formation.api.security.CurrentUser;
import org.formation.api.security.MediaSigner;
import org.formation.api.service.AccessPolicy;
import org.formation.api.service.MediaStorage;
import org.formation.api.web.dto.Dtos.MediaUpload;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api")
public class MediaController {

    private final MediaStorage storage;
    private final CurrentUser currentUser;
    private final AccessPolicy policy;
    private final MediaSigner signer;

    public MediaController(MediaStorage storage, CurrentUser currentUser, AccessPolicy policy, MediaSigner signer) {
        this.storage = storage;
        this.currentUser = currentUser;
        this.policy = policy;
        this.signer = signer;
    }

    /**
     * Televersement. Equipe pedagogique : contenu de cours (public). Apprenant : video de pratique (privee),
     * renvoyee avec un lien signe temporaire pour sa propre previsualisation.
     */
    @PostMapping("/media")
    public MediaUpload upload(@RequestParam("file") MultipartFile file) {
        AppUser u = currentUser.get();
        boolean publicContent = policy.isStaff(u);
        MediaUpload m = storage.store(file, u, publicContent);
        return publicContent ? m : new MediaUpload(m.url(), m.sizeBytes(), m.contentType());
    }

    /**
     * Diffusion. Medias publics : librement (lecture par &lt;video&gt;, cache hors ligne). Medias prives : lien signe
     * et non expire obligatoire. Spring gere les requetes partielles (Range) : reprise sur reseau instable.
     */
    @GetMapping("/media/{name}")
    public ResponseEntity<Resource> media(@PathVariable String name, @RequestParam(required = false) Long exp,
                                          @RequestParam(required = false) String sig) {
        boolean priv = storage.isPrivate(name);
        if (priv && !signer.verify(name, exp, sig)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        CacheControl cache = priv ? CacheControl.noStore() : CacheControl.maxAge(365, TimeUnit.DAYS).cachePrivate().immutable();
        return storage.load(name)
                .map(r -> ResponseEntity.ok()
                        .cacheControl(cache)
                        .header("X-Content-Type-Options", "nosniff")
                        .contentType(name.endsWith(".vtt") ? new org.springframework.http.MediaType("text", "vtt", java.nio.charset.StandardCharsets.UTF_8)
                                : MediaTypeFactory.getMediaType(r).orElse(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM))
                        .body(r))
                .orElse(ResponseEntity.notFound().build());
    }
}
