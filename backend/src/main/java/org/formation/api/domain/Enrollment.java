package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Inscription d'un apprenant a un cours ou a une formation (programme).
 * Une inscription a une formation inscrit aussi a chacun de ses cours (programId renseigne).
 */
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "course_id"}))
@Getter
@Setter
@NoArgsConstructor
public class Enrollment {
    public enum Method { GRATUIT, MOBILE_MONEY, CARTE, CODE, FORMATION }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    /** Cours suivi (null pour l'inscription a la formation elle-meme). */
    @ManyToOne(fetch = FetchType.LAZY)
    private Course course;

    /** Formation : soit l'objet de l'inscription, soit la formation qui a inscrit a ce cours. */
    @ManyToOne(fetch = FetchType.LAZY)
    private Program program;

    @Enumerated(EnumType.STRING)
    private Method method = Method.GRATUIT;

    /** Montant paye (FCFA). */
    private int amount;

    /** Reference de paiement (simulee en demonstration). */
    private String paymentRef;

    private Instant enrolledAt = Instant.now();
}
