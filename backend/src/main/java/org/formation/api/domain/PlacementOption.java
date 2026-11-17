package org.formation.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PlacementOption {
    @Column(length = 500)
    private String label;

    /** Pictogramme (emoji) pour les publics a faible litteratie. */
    private String icon;

    /** Titre du module recommande si cette option est choisie (lien par titre : stable entre pays). */
    private String recommendsCourseTitle;
}
