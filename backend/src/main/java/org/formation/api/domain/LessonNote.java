package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Note personnelle et signet d'un apprenant sur une lecon. */
@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "lesson_id"}))
@Getter
@Setter
@NoArgsConstructor
public class LessonNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Lesson lesson;

    @Column(length = 4000)
    private String text;

    private boolean bookmarked;

    private Instant updatedAt = Instant.now();
}
