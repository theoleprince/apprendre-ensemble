package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Abonnement d'un apprenant. Prolonge si une nouvelle periode est achetee avant la fin. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Subscription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    private SubscriptionPlan plan;

    private Instant startsAt;
    private Instant endsAt;

    private String paymentReference;

    public boolean isActive() {
        Instant now = Instant.now();
        return startsAt != null && endsAt != null && !now.isBefore(startsAt) && now.isBefore(endsAt);
    }
}
