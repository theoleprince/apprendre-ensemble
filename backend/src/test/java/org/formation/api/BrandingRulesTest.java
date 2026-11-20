package org.formation.api;

import org.formation.api.domain.AppUser;
import org.formation.api.domain.Certificate;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.CertificateRepository;
import org.formation.api.report.ReportService;
import org.formation.api.service.BrandingService;
import org.formation.api.service.OpenBadgeService;
import org.formation.api.web.dto.Dtos.BrandingDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Charte graphique parametrable : nom, organisation, couleurs accessibles, logo, signataires. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:branding;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "app.seed.demo-data=true",
        "app.media.dir=target/test-media",
        "app.ai.enabled=false"})
@Transactional
class BrandingRulesTest {

    @Autowired BrandingService branding;
    @Autowired OpenBadgeService badges;
    @Autowired ReportService reports;
    @Autowired AppUserRepository users;
    @Autowired CertificateRepository certificates;

    private AppUser user(String email) {
        return users.findByEmailIgnoreCase(email).orElseThrow();
    }

    private static BrandingDto brand(String primary, String accent, String logo) {
        return new BrandingDto("Former pour la paix", "Organisation cliente", "Former pour prévenir les violences", logo,
                primary, accent, "contact@exemple.org", null, "Cheffe de projet", "Programme", "Direction", "Fondation");
    }

    @Test
    void administratorAppliesTheClientCharterEverywhere() {
        BrandingDto saved = branding.save(user("admin@demo.local"), brand("#1b4f8a", "#f2b632", null));
        assertThat(branding.current().name()).isEqualTo("Former pour la paix");
        assertThat(saved.primaryColor()).isEqualTo("#1b4f8a");
        // les badges numeriques portent le nom de l'organisation emettrice
        assertThat(((Map<?, ?>) badges.issuer()).get("name")).isEqualTo("Organisation cliente");
        // le certificat PDF est regenere avec la nouvelle couleur sans erreur de gabarit
        Certificate c = certificates.findAll().stream().filter(x -> !x.isRevoked()).findFirst().orElseThrow();
        byte[] pdf = reports.certificatePdf(c.getCode());
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void colorsThatBreakReadabilityAreRefused() {
        AppUser admin = user("admin@demo.local");
        assertThatThrownBy(() -> branding.save(admin, brand("#f5c400", "#f2b632", null)))   // texte blanc sur jaune
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("trop claire");
        assertThatThrownBy(() -> branding.save(admin, brand("#1b4f8a", "#3b2f96", null)))   // texte sombre sur violet
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("trop foncée");
        assertThatThrownBy(() -> branding.save(admin, brand("blue", "#f2b632", null)))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void onlyUploadedImagesAreAcceptedAsLogoAndOnlyAdminsCanChangeTheBrand() {
        AppUser admin = user("admin@demo.local");
        assertThatThrownBy(() -> branding.save(admin, brand("#1b4f8a", "#f2b632", "https://exemple.org/logo.svg")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Logo");
        assertThat(branding.save(admin, brand("#1b4f8a", "#f2b632", "/api/media/5b3a9c71-2e6d-4a0f-8c47-9d1e3f6a2b33.png")).logoUrl())
                .endsWith(".png");
        AppUser formateur = users.findAll().stream().filter(u -> u.getRole() == org.formation.api.domain.Role.FORMATEUR).findFirst().orElseThrow();
        assertThatThrownBy(() -> branding.save(formateur, brand("#1b4f8a", "#f2b632", null)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("administration");
    }
}
