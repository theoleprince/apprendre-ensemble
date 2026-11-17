package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Journal d'activite minimal (frequence de connexion, synchronisations hors ligne). Pas de donnees de contenu. */
@Entity
@Table(indexes = @Index(columnList = "userId,at"))
@Getter
@Setter
@NoArgsConstructor
public class ActivityEvent {
    public enum Type { LOGIN, SYNC, ASSISTANT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    @Enumerated(EnumType.STRING)
    private Type type;

    /** Nombre d'elements synchronises (SYNC). */
    private int itemCount;

    private Instant at = Instant.now();

    public ActivityEvent(Long userId, Type type, int itemCount) {
        this.userId = userId;
        this.type = type;
        this.itemCount = itemCount;
    }
}
