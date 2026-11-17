package org.formation.api;

import org.formation.api.domain.*;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.CourseRepository;
import org.formation.api.service.AdminService;
import org.formation.api.service.LearningService;
import org.formation.api.web.dto.Dtos.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Regles metier critiques de l'offre : synchro hors ligne, certification, droits RCT, tirage stratifie. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "app.seed.demo-data=true",
        "app.media.dir=target/test-media",
        "app.ai.enabled=false"})
@Transactional
class CoreRulesTest {

    @Autowired LearningService learning;
    @Autowired AdminService admin;
    @Autowired AppUserRepository users;
    @Autowired CourseRepository courses;

    private AppUser teacher() {
        return users.findByEmailIgnoreCase("enseignant@demo.local").orElseThrow();
    }

    private Course emotions() {
        return courses.findAllByOrderByIdAsc().stream().filter(c -> c.getTitle().startsWith("Gérer")).findFirst().orElseThrow();
    }

    @Test
    void offlineSyncIsIdempotentAndResolvesConflicts() {
        AppUser u = teacher();
        Lesson l = emotions().getLessons().getFirst();
        Instant early = Instant.parse("2026-11-01T08:00:00Z");
        Instant late = Instant.parse("2026-11-05T08:00:00Z");

        learning.sync(u, List.of(new ProgressItem(l.getId(), late, 120, false)));
        // rejeu depuis un second appareil hors ligne : date plus ancienne, temps plus long
        SyncResponse r = learning.sync(u, List.of(new ProgressItem(l.getId(), early, 300, true),
                new ProgressItem(l.getId(), early, 300, true)));

        List<ProgressItem> forLesson = r.serverState().stream().filter(p -> p.lessonId().equals(l.getId())).toList();
        assertThat(forLesson).hasSize(1);
        assertThat(forLesson.getFirst().completedAt()).isEqualTo(early);
        assertThat(forLesson.getFirst().timeSpentSeconds()).isEqualTo(300);
        assertThat(forLesson.getFirst().offline()).isTrue();
    }

    @Test
    void certificationLevelsAreIssuedProgressively() {
        AppUser u = teacher();
        Course c = emotions();
        List<ProgressItem> all = c.getLessons().stream()
                .map(l -> new ProgressItem(l.getId(), Instant.now().minusSeconds(60), 60, false)).toList();

        SyncResponse s = learning.sync(u, all);
        assertThat(s.newCertificates()).extracting(CertificateDto::level).containsExactly(CertificateLevel.ATTESTATION);

        // 3/4 = 75 % : badge (>= 70) mais pas maitrise (>= 85)
        QuizResult partial = learning.submitQuiz(u, c.getId(), List.of(1, 0, 1, 1));
        assertThat(partial.scorePercent()).isEqualTo(75);
        assertThat(partial.newCertificates()).extracting(CertificateDto::level).containsExactly(CertificateLevel.BADGE);

        QuizResult full = learning.submitQuiz(u, c.getId(), List.of(1, 2, 1, 1));
        assertThat(full.mastery()).isTrue();
        assertThat(full.newCertificates()).extracting(CertificateDto::level).containsExactly(CertificateLevel.MAITRISE);
        assertThat(full.corrections()).allMatch(QuestionCorrection::correct);

        // aucun doublon en cas de nouvelle reussite
        assertThat(learning.submitQuiz(u, c.getId(), List.of(1, 2, 1, 1)).newCertificates()).isEmpty();
    }

    @Test
    void courseRestrictedToTreatmentGroupIsHiddenFromControlGroup() {
        AppUser u = teacher();
        Course c = emotions();
        c.getAllowedCohorts().add("TRAITEMENT");
        u.setCohort("CONTROLE");
        assertThat(learning.visibleCourses(u)).noneMatch(x -> x.id().equals(c.getId()));
        assertThatThrownBy(() -> learning.coursePackage(u, c.getId())).isInstanceOf(ResponseStatusException.class);

        u.setCohort("TRAITEMENT");
        assertThat(learning.visibleCourses(u)).anyMatch(x -> x.id().equals(c.getId()));
    }

    @Test
    void stratifiedRandomizationIsBalancedAndReproducible() {
        RandomizeRequest req = new RandomizeRequest(List.of("T", "C"), Role.ENSEIGNANT, "BJ", false, 42L);
        RandomizeResult first = admin.randomize(req);
        Map<Long, String> firstAssignment = assignment();
        RandomizeResult second = admin.randomize(req);

        assertThat(second.byRegionAndGroup()).isEqualTo(first.byRegionAndGroup());
        assertThat(assignment()).isEqualTo(firstAssignment);
        first.byRegionAndGroup().values().forEach(groups -> {
            long t = groups.getOrDefault("T", 0L);
            long ctl = groups.getOrDefault("C", 0L);
            assertThat(Math.abs(t - ctl)).isLessThanOrEqualTo(1);
        });
    }

    private Map<Long, String> assignment() {
        return users.findAll().stream().filter(u -> u.getRole() == Role.ENSEIGNANT && u.getCohort() != null)
                .collect(java.util.stream.Collectors.toMap(AppUser::getId, AppUser::getCohort));
    }
}
