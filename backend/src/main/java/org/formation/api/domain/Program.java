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
    @Enumerated(EnumType.STRING)
    @CollectionTable(name = "program_target_role")
    @Column(name = "role")
    private Set<Role> targetRoles = new HashSet<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "program_course")
    @OrderColumn(name = "position")
    private List<Course> courses = new ArrayList<>();

    /** Niveau a atteindre dans chaque module pour obtenir le certificat du programme. */
    @Enumerated(EnumType.STRING)
    private CertificateLevel requiredLevel = CertificateLevel.ATTESTATION;

    /** Prix d'inscription a la formation complete (FCFA). 0 = gratuite. */
    private int price;

    private boolean published = true;
}
