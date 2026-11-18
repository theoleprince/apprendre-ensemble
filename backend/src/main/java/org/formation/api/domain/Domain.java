package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Domaine de competences (ex. competences socio-emotionnelles, cooperation, numerique). */
@Entity
@Table(name = "competence_domain")
@Getter
@Setter
@NoArgsConstructor
public class Domain {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    /** Nom d'icone SVG. */
    private String icon;

    private int position;
}
