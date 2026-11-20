package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

/** Ressource telechargeable (fiche pratique, affiche, guide) : consultable et partageable hors ligne. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Resource {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 1000)
    private String summary;

    private String icon;

    /** Contenu texte (markdown simple) : leger, imprimable, lisible a voix haute. */
    @Column(columnDefinition = "TEXT")
    private String content;

    /** Fichier joint optionnel (PDF, audio). */
    @Column(length = 1000)
    private String fileUrl;

    @ManyToOne(fetch = FetchType.EAGER)
    private Domain domain;

    @ElementCollection(fetch = FetchType.EAGER)
        @CollectionTable(name = "resource_target_role")
    @Column(name = "role")
    private Set<String> targetRoles = new HashSet<>();
}
