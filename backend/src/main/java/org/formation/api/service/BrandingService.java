package org.formation.api.service;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Branding;
import org.formation.api.domain.Role;
import org.formation.api.repository.BrandingRepository;
import org.formation.api.web.dto.Dtos.BrandingDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.regex.Pattern;

/**
 * Identite visuelle (charte graphique) : nom, organisation, logo, couleurs, signataires des certificats.
 * Modifiable par l'administration, sans redeploiement. Les couleurs sont refusees si le texte n'y reste pas
 * lisible (contraste WCAG AA >= 4,5:1) : la charte d'un client ne doit pas degrader l'accessibilite.
 */
@Service
public class BrandingService {

    static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");
    /** Logo : fichier image televerse sur la plateforme (meme origine : compatible avec la politique de securite du contenu). */
    static final Pattern LOGO = Pattern.compile("^/api/media/[a-f0-9-]{36}\\.(png|jpg)$");
    /** Couleur du texte pose sur la couleur d'accent (boutons jaunes). */
    static final String DARK_TEXT = "#2b2200";

    private final BrandingRepository repo;
    private final BrandingDto defaults;
    private volatile BrandingDto cache;

    public BrandingService(BrandingRepository repo,
                           @Value("${app.brand.name:Plateforme de formation}") String name,
                           @Value("${app.brand.organization:}") String organization,
                           @Value("${app.brand.primary:#2f7d4f}") String primary,
                           @Value("${app.brand.accent:#f5c400}") String accent,
                           @Value("${app.brand.signatory1:Responsable pédagogique}") String s1,
                           @Value("${app.brand.signatory1-role:Coordination pédagogique}") String s1r,
                           @Value("${app.brand.signatory2:Direction du programme}") String s2,
                           @Value("${app.brand.signatory2-role:En partenariat avec le ministère de l'éducation}") String s2r) {
        this.repo = repo;
        this.defaults = new BrandingDto(name, blank(organization),
                "Des formations courtes et certifiantes, en ligne et sans connexion.", null, primary, accent, null,
                "plateforme de démonstration", s1, s1r, s2, s2r);
    }

    @Transactional(readOnly = true)
    public BrandingDto current() {
        BrandingDto c = cache;
        if (c == null) {
            c = repo.findById(1L).map(BrandingService::dto).orElse(defaults);
            cache = c;
        }
        return c;
    }

    @Transactional
    public BrandingDto save(AppUser by, BrandingDto in) {
        if (by.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé à l'administration");
        }
        if (in.name() == null || in.name().isBlank()) throw bad("Le nom de la plateforme est obligatoire");
        if (!HEX.matcher(String.valueOf(in.primaryColor())).matches() || !HEX.matcher(String.valueOf(in.accentColor())).matches()) {
            throw bad("Couleurs attendues au format #RRGGBB");
        }
        double onPrimary = contrast(in.primaryColor(), "#ffffff");
        if (onPrimary < 4.5) {
            throw bad(String.format("Couleur principale trop claire : le texte blanc n'y est pas lisible (contraste %.1f:1, minimum 4,5:1). Choisissez une teinte plus foncée de la charte.", onPrimary));
        }
        double onAccent = contrast(in.accentColor(), DARK_TEXT);
        if (onAccent < 4.5) {
            throw bad(String.format("Couleur d'accent trop foncée : le texte sombre n'y est pas lisible (contraste %.1f:1, minimum 4,5:1). Choisissez une teinte plus claire.", onAccent));
        }
        String logo = blank(in.logoUrl());
        if (logo != null && !LOGO.matcher(logo).matches()) throw bad("Logo : téléversez une image PNG ou JPEG");
        String email = blank(in.supportEmail());
        if (email != null && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw bad("Adresse de contact invalide");

        Branding b = repo.findById(1L).orElseGet(Branding::new);
        b.setName(in.name().trim());
        b.setOrganization(blank(in.organization()));
        b.setTagline(blank(in.tagline()));
        b.setLogoUrl(logo);
        b.setPrimaryColor(in.primaryColor().toLowerCase());
        b.setAccentColor(in.accentColor().toLowerCase());
        b.setSupportEmail(email);
        b.setFooterNote(blank(in.footerNote()));
        b.setSignatory1(blank(in.signatory1()));
        b.setSignatory1Role(blank(in.signatory1Role()));
        b.setSignatory2(blank(in.signatory2()));
        b.setSignatory2Role(blank(in.signatory2Role()));
        b.setUpdatedAt(Instant.now());
        b.setUpdatedBy(by.getEmail());
        repo.save(b);
        cache = dto(b);
        return cache;
    }

    /** Contraste WCAG 2.x entre deux couleurs #RRGGBB. */
    static double contrast(String a, String b) {
        double la = luminance(a);
        double lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    private static double luminance(String hex) {
        double[] c = new double[3];
        for (int i = 0; i < 3; i++) {
            double v = Integer.parseInt(hex.substring(1 + 2 * i, 3 + 2 * i), 16) / 255.0;
            c[i] = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    private static BrandingDto dto(Branding b) {
        return new BrandingDto(b.getName(), b.getOrganization(), b.getTagline(), b.getLogoUrl(), b.getPrimaryColor(),
                b.getAccentColor(), b.getSupportEmail(), b.getFooterNote(), b.getSignatory1(), b.getSignatory1Role(),
                b.getSignatory2(), b.getSignatory2Role());
    }

    private static ResponseStatusException bad(String m) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, m);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
