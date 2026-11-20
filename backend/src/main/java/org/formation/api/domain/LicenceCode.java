package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Licence institutionnelle : un code remis par un partenaire, avec un nombre de places et une date de fin. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class LicenceCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    /** Institution titulaire (ministere, ONG, ecole...). */
    @Column(nullable = false)
    private String institution;

    /** Nombre maximal d'inscriptions (0 = illimite). */
    private int seats;

    private int used;

    /** Fin de validite (incluse) ; null = sans limite. */
    private java.time.LocalDate validUntil;

    /** Formation couverte ; null = tous les contenus payants. */
    private Long programId;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;

    private Instant createdAt = Instant.now();
}
