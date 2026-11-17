package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "lesson_id"}))
@Getter
@Setter
@NoArgsConstructor
public class LessonProgress {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Lesson lesson;

    /** Date reelle de completion sur l'appareil (peut preceder la synchro). */
    private Instant completedAt;

    /** Temps passe sur la lecon, mesure sur l'appareil (secondes). */
    private int timeSpentSeconds;

    /** Lecon terminee sans connexion (indicateur d'usage hors ligne). */
    private boolean completedOffline;

    private Instant syncedAt = Instant.now();
}
