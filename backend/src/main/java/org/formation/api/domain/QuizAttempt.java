package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class QuizAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    private int scorePercent;
    private boolean passed;

    /** Reponses choisies (index csv, dans l'ordre des questions) : analyse des erreurs frequentes. */
    @Column(length = 1000)
    private String answers;

    private Instant attemptedAt = Instant.now();
}
