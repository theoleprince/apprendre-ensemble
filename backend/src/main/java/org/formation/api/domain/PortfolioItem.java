package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** Preuve de pratique (texte + video de classe eventuelle) evaluee par un mentor. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class PortfolioItem {
    public enum Status { SOUMIS, VALIDE, A_REVOIR }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    private Lesson lesson;

    @Column(length = 4000)
    private String text;

    @Column(length = 1000)
    private String mediaUrl;

    @Enumerated(EnumType.STRING)
    private Status status = Status.SOUMIS;

    @Column(length = 4000)
    private String mentorFeedback;

    @ManyToOne(fetch = FetchType.LAZY)
    private AppUser mentor;

    private Instant submittedAt = Instant.now();
    private Instant reviewedAt;
}
