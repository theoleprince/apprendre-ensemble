package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Jeton de reinitialisation du mot de passe : seule son empreinte SHA-256 est conservee. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class PasswordResetToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant usedAt;

    private Instant createdAt = Instant.now();
}
