package org.formation.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Cle de signature des certificats numeriques (Open Badges 3.0, VC-JWT).
 * Generee au premier usage et conservee en base : un badge emis reste verifiable apres un redemarrage
 * ou un redeploiement. La cle publique est publiee (JWKS) ; la cle privee ne sort jamais du serveur.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class SigningKey {
    @Id
    @Column(length = 64)
    private String kid;

    /** JWK complet (prive) au format JSON. */
    @Column(nullable = false, length = 8000)
    private String jwk;

    private Instant createdAt = Instant.now();
}
