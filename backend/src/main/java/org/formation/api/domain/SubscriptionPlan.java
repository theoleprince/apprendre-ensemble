package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Formule d'abonnement individuel : acces a tous les contenus payants pendant une duree. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class SubscriptionPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    /** Prix (FCFA). */
    private int price;

    private int durationDays;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;
}
