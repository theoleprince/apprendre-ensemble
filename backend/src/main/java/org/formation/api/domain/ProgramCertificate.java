package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Certificat de programme (parcours complet), avec mention de laureat·e eventuelle (rang en classe). */
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "program_id"}))
@Getter
@Setter
@NoArgsConstructor
public class ProgramCertificate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String code;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Program program;

    @ManyToOne(fetch = FetchType.LAZY)
    private Classroom classroom;

    /** Rang final dans la classe (1, 2, 3 = laureat·e), null sinon. */
    private Integer rank;
    private Integer classSize;
    private int points;

    private Instant issuedAt = Instant.now();

    /** Revocation (fraude, erreur d'attribution) : le certificat reste tracable mais n'est plus valide. */
    private Instant revokedAt;

    @Column(length = 500)
    private String revokedReason;

    private String revokedBy;

    public boolean isRevoked() {
        return revokedAt != null;
    }
}
