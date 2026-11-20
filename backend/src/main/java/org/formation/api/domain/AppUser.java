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

    /** Etablissement de rattachement (enseignant·es, directions). */
    @ManyToOne(fetch = FetchType.EAGER)
    private School school;

    /** Consentement explicite au traitement des donnees (RGPD / nLPD). */
    private boolean dataConsent;

    /** Test d'entree passe : ids des modules recommandes (csv). */
    private boolean placementDone;
    private String recommendedCourseIds;

    /** Public (code Audience). Vide : le nom du role (publics historiques). */
    private String audience;

    private Instant createdAt = Instant.now();
    private Instant lastActiveAt;

    /** Compte actif. Desactive : connexion refusee et sessions en cours invalidees. */
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean enabled = true;

    /** Changement d'identifiants (mot de passe, desactivation, "deconnecter partout") : les jetons anterieurs sont refuses. */
    private Instant credentialsChangedAt;

    /** Version des identifiants, portee par chaque jeton : incrementee a chaque changement, elle invalide les anciens jetons. */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int credentialsVersion;

    /** Invalide toutes les sessions en cours. */
    public void revokeSessions() {
        credentialsVersion++;
        credentialsChangedAt = Instant.now();
    }

    /** Compte efface a la demande (droit a l'effacement) : donnees personnelles anonymisees. */
    private Instant deletedAt;
}
