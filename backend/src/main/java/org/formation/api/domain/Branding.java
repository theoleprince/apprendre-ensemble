package org.formation.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Identite visuelle de la plateforme (une seule ligne, id = 1) : nom, organisation, logo, couleurs, signataires.
 * Permet d'appliquer la charte graphique du client sans developpement. Absente = valeurs de la configuration.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Branding {
    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private String name;

    /** Organisation editrice (ex. la fondation qui porte le programme). */
    private String organization;

    @Column(length = 300)
    private String tagline;

    /** Logo televerse (PNG ou JPEG servi par la plateforme). */
    private String logoUrl;

    @Column(length = 7, nullable = false)
    private String primaryColor;

    @Column(length = 7, nullable = false)
    private String accentColor;

    private String supportEmail;

    /** Mention de bas de page (ex. "plateforme de demonstration"). */
    private String footerNote;

    private String signatory1;
    @Column(name = "signatory1_role")
    private String signatory1Role;
    private String signatory2;
    @Column(name = "signatory2_role")
    private String signatory2Role;

    private Instant updatedAt = Instant.now();
    private String updatedBy;
}
