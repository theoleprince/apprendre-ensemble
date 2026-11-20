package org.formation.api.web;

import org.formation.api.domain.UiTranslation;
import org.formation.api.repository.LanguageRepository;
import org.formation.api.repository.UiTranslationRepository;
import org.formation.api.security.CurrentUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Traductions de l'interface : lecture publique, chargement par l'administration. */
@RestController
@RequestMapping("/api")
public class TranslationController {

    private final UiTranslationRepository packs;
    private final LanguageRepository languages;
    private final CurrentUser currentUser;

    public TranslationController(UiTranslationRepository packs, LanguageRepository languages, CurrentUser currentUser) {
        this.packs = packs;
        this.languages = languages;
        this.currentUser = currentUser;
    }

    @GetMapping(value = "/public/i18n/{lang}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> pack(@PathVariable String lang) {
        return packs.findById(lang)
                .map(p -> ResponseEntity.ok().cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES)).body(p.getPayload()))
                .orElse(ResponseEntity.notFound().build());
    }

    public record PackInfo(String lang, int entries, Instant updatedAt, String updatedBy) {
    }

    @GetMapping("/admin/i18n")
    public List<PackInfo> list() {
        return packs.findAll().stream().map(p -> new PackInfo(p.getLang(), p.getEntries(), p.getUpdatedAt(), p.getUpdatedBy())).toList();
    }

    /** Charge (ou remplace) le pack d'une langue active. Les valeurs vides sont ignorees (repli sur le francais). */
    @PutMapping("/admin/i18n/{lang}")
    public PackInfo save(@PathVariable String lang, @RequestBody Map<String, String> entries) {
        if (!languages.existsById(lang)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Langue inconnue : ajoutez-la d'abord");
        if (entries.size() > 20_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pack trop volumineux");
        Map<String, String> clean = new java.util.TreeMap<>();
        entries.forEach((k, v) -> {
            if (k != null && v != null && !k.isBlank() && !v.isBlank() && k.length() <= 2000 && v.length() <= 4000) clean.put(k, v);
        });
        UiTranslation p = packs.findById(lang).orElseGet(UiTranslation::new);
        p.setLang(lang);
        try {
            p.setPayload(tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(clean));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pack invalide");
        }
        p.setEntries(clean.size());
        p.setUpdatedAt(Instant.now());
        p.setUpdatedBy(currentUser.get().getFullName());
        packs.save(p);
        return new PackInfo(p.getLang(), p.getEntries(), p.getUpdatedAt(), p.getUpdatedBy());
    }
}
