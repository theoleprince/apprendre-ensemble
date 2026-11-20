package org.formation.api.web;

import jakarta.validation.Valid;
import org.formation.api.security.CurrentUser;
import org.formation.api.service.BrandingService;
import org.formation.api.web.dto.Dtos.BrandingDto;
import org.springframework.web.bind.annotation.*;

/** Identite visuelle : lue par tous (avant connexion), modifiee par l'administration. */
@RestController
@RequestMapping("/api")
public class BrandingController {

    private final BrandingService branding;
    private final CurrentUser currentUser;

    public BrandingController(BrandingService branding, CurrentUser currentUser) {
        this.branding = branding;
        this.currentUser = currentUser;
    }

    @GetMapping("/public/branding")
    public BrandingDto get() {
        return branding.current();
    }

    @PutMapping("/admin/branding")
    public BrandingDto save(@Valid @RequestBody BrandingDto in) {
        return branding.save(currentUser.get(), in);
    }
}
