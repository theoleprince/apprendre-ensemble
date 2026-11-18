package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Module de formation (12 modules d'environ 12 h dans le curriculum enseignant). */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Course {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    /** Emoji / pictogramme du module : reperage visuel pour les publics a faible litteratie. */
    private String icon;

    @Enumerated(EnumType.STRING)
    private CourseType type = CourseType.THEORIQUE;

    /** Domaine de competences du module. */
    @ManyToOne(fetch = FetchType.EAGER)
    private Domain domain;

    private String countryCode;
    private String languageCode;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    @CollectionTable(name = "course_target_role")
    @Column(name = "role")
    private Set<Role> targetRoles = new HashSet<>();

    /** Restriction par groupe RCT (vide = tous les groupes). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "course_allowed_cohort")
    @Column(name = "cohort")
    private Set<String> allowedCohorts = new HashSet<>();

    /** Restriction par zone geographique (vide = toutes les zones). */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "course_allowed_region")
    @Column(name = "region")
    private Set<String> allowedRegions = new HashSet<>();

    // ---- Criteres de certification parametrables ----
    /** Badge de micro-certification : score minimum au quiz (%). */
    private int passScore = 70;
    /** Certification de maitrise : score minimum (%) + toutes les lecons. */
    private int masteryScore = 85;
    /** Certification d'expertise : portfolio valide par un mentor. */
    private boolean expertiseEnabled = true;

    /** Prix d'inscription (FCFA). 0 = gratuit (finance par un programme). */
    private int price;

    private boolean published = true;

    /** Incremente a chaque modification : le client hors ligne sait s'il doit retelecharger. */
    private int contentVersion = 1;

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<Lesson> lessons = new ArrayList<>();

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<QuizQuestion> questions = new ArrayList<>();

    private Instant updatedAt = Instant.now();
}
