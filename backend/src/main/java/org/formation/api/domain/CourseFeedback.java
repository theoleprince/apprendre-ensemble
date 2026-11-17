package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Questionnaire de retour d'experience utilisateur sur un module. */
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "course_id"}))
@Getter
@Setter
@NoArgsConstructor
public class CourseFeedback {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    /** Satisfaction globale 1..5. */
    private int rating;
    /** Clarte du contenu 1..5. */
    private int clarity;
    /** Utilite pour la pratique 1..5. */
    private int usefulness;

    @Column(length = 2000)
    private String comment;

    private Instant createdAt = Instant.now();
}
