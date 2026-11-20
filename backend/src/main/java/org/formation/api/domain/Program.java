package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Programme (parcours) : suite ordonnee de modules avec ses regles de certification. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Program {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    private String icon;

    /** Duree indicative affichee (ex. "6 modules · 8 semaines"). */
    private String durationLabel;

    private String countryCode;

    @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "program_target_role")
    @Column(name = "role")
    private Set<String> targetRoles = new HashSet<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "program_course")
    @OrderColumn(name = "position")
    private List<Course> courses = new ArrayList<>();

    /** Niveau a atteindre dans chaque module pour obtenir le certificat du programme. */
    @Enumerated(EnumType.STRING)
    private CertificateLevel requiredLevel = CertificateLevel.ATTESTATION;

    /** Prix d'inscription a la formation complete (FCFA). 0 = gratuite. */
    private int price;

    // ---- Presentation (page publique) ----
    /** DEBUTANT, INTERMEDIAIRE ou AVANCE. */
    private String level = "DEBUTANT";

    /** Ce que l'apprenant saura faire a la fin. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "program_objective")
    @OrderColumn(name = "position")
    @Column(name = "objective", length = 300)
    private List<String> objectives = new ArrayList<>();

    @Column(length = 1000)
    private String prerequisites;

    private String authorName;
    private String authorTitle;
    @Column(length = 1000)
    private String authorBio;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "program_faq")
    @OrderColumn(name = "position")
    private List<FaqEntry> faq = new ArrayList<>();

    private boolean published = true;
}
