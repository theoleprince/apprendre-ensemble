package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "course_id", "level"}))
@Getter
@Setter
@NoArgsConstructor
public class Certificate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Code public de verification (lien partageable, ex. LinkedIn). */
    @Column(unique = true, nullable = false)
    private String code;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CertificateLevel level;

    private int scorePercent;
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
