package org.formation.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

/**
 * Classe (session) : un programme lance pour un groupe, avec dates, animateur·rice,
 * ouverture progressive des modules, points et classement configurables.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Classroom {
    public enum UnlockMode { ALL, WEEKLY }

    /** PUBLIC : noms visibles ; ANONYMOUS : rang personnel uniquement ; DISABLED : pas de classement. */
    public enum LeaderboardMode { PUBLIC, ANONYMOUS, DISABLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    private Program program;

    @ManyToOne(fetch = FetchType.EAGER)
    private AppUser facilitator;

    private LocalDate startDate;
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    private UnlockMode unlockMode = UnlockMode.WEEKLY;

    /** Nombre de jours entre l'ouverture de deux modules (mode WEEKLY). */
    private int unlockIntervalDays = 7;

    @Enumerated(EnumType.STRING)
    private LeaderboardMode leaderboardMode = LeaderboardMode.PUBLIC;

    // ---- Bareme des points (configurable par classe) ----
    private int pointsPerLesson = 10;
    /** Points pour 1 % de score au quiz d'un module (meilleure tentative). */
    private int pointsPerQuizPercent = 1;
    private int pointsPerPortfolio = 50;
    private int pointsPerPost = 5;

    /** Code d'invitation pour rejoindre la classe. */
    @Column(unique = true)
    private String inviteCode;

    /** Lien de la visio recurrente de la classe. */
    @Column(length = 500)
    private String meetingUrl;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "classroom_member")
    private Set<AppUser> members = new HashSet<>();

    /** Classe cloturee : classement final fige et certificats de laureat delivres. */
    private boolean closed;
}
