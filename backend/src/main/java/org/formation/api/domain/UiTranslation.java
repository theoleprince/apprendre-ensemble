package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Pack de traduction de l'interface pour une langue (JSON { "texte francais": "traduction" }).
 * Charge par l'administration, sans developpement ni redeploiement : prioritaire sur le pack livre avec l'application.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class UiTranslation {
    @Id
    @Column(length = 10)
    private String lang;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    private int entries;

    private Instant updatedAt = Instant.now();

    private String updatedBy;
}
