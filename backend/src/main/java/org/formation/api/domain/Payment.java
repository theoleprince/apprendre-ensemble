package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Paiement en ligne (Mobile Money, carte) via un prestataire agree (FedaPay). L'acces n'est accorde qu'apres
 * confirmation du prestataire, relue cote serveur : jamais sur la seule foi du navigateur.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Payment {
    public enum Kind { COURSE, PROGRAM, SUBSCRIPTION }
    public enum Status { PENDING, APPROVED, DECLINED, CANCELED, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Reference interne unique transmise au prestataire. */
    @Column(nullable = false, unique = true, length = 40)
    private String reference;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind;

    /** Cours, formation ou formule d'abonnement achete. */
    private Long targetId;

    private String description;

    /** Montant en unites de la devise (FCFA : pas de centimes). */
    private int amount;

    private String currency = "XOF";

    private String provider = "FEDAPAY";

    /** Identifiant de la transaction chez le prestataire. */
    private String providerTransactionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
    /** Droits accordes (inscription ou abonnement) : idempotence de la confirmation. */
    private Instant fulfilledAt;
}
