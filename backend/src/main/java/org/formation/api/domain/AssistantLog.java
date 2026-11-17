package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Trace pseudonymisee des echanges avec l'assistant IA, pour la supervision humaine
 * (revue des reponses, signalements de situations sensibles). Duree de conservation limitee.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class AssistantLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private Long courseId;

    @Column(length = 2000)
    private String question;

    @Column(length = 4000)
    private String answer;

    /** Message signale (situation de protection de l'enfance, contenu inapproprie...) a revoir par un humain. */
    private boolean flagged;

    private String model;
    private long inputTokens;
    private long outputTokens;

    private Instant at = Instant.now();
}
