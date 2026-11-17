package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private String countryCode;
    private String languageCode;

    /** Zone geographique (departement, commune, circonscription...) : droits d'acces et stratification RCT. */
    private String region;

    /** Groupe du protocole d'evaluation (ex. TRAITEMENT / CONTROLE) ou groupe libre. */
    private String cohort;

    /** Consentement explicite au traitement des donnees (RGPD / nLPD). */
    private boolean dataConsent;

    /** Test d'entree passe : ids des modules recommandes (csv). */
    private boolean placementDone;
    private String recommendedCourseIds;

    private Instant createdAt = Instant.now();
    private Instant lastActiveAt;
}
