package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Discussion d'une communaute de pratique (par module ou generale), avec visioconference optionnelle. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class ForumThread {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 4000)
    private String body;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser author;

    /** Module concerne (null = communaute generale du pays). */
    private Long courseId;

    private String countryCode;

    /** Lien de visioconference (Jitsi / BigBlueButton) et date de la seance animee. */
    @Column(length = 500)
    private String meetingUrl;
    private Instant meetingAt;

    private boolean pinned;

    @OneToMany(mappedBy = "thread", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt")
    private List<ForumPost> posts = new ArrayList<>();

    private Instant createdAt = Instant.now();
    private Instant lastActivityAt = Instant.now();
}
