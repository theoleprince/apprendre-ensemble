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
public class ForumPost {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private ForumThread thread;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private AppUser author;

    @Column(nullable = false, length = 4000)
    private String body;

    private Instant createdAt = Instant.now();
}
