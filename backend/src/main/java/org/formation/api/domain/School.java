package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Etablissement (ecole) : rattachement des enseignant·es, suivi par la direction. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class School {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String countryCode;
    private String region;
    private String commune;
}
