package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Fichier televerse. PUBLIC : contenu pedagogique (lecons). PRIVATE : production d'un apprenant
 * (video de pratique de classe, pouvant montrer des enfants) : lisible uniquement par lien signe et temporaire.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class MediaFile {
    public enum Visibility { PUBLIC, PRIVATE }

    /** Nom stocke (UUID + extension). */
    @Id
    @Column(length = 64)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    private AppUser owner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Visibility visibility = Visibility.PRIVATE;

    private String contentType;
    private long sizeBytes;
    private Instant createdAt = Instant.now();
}
