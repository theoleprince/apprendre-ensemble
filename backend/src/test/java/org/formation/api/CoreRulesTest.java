package org.formation.api;

import org.formation.api.domain.*;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.CourseRepository;
import org.formation.api.service.AdminService;
import org.formation.api.service.EnrollmentService;
import org.formation.api.service.LearningService;
import org.formation.api.service.QuestionGrader;
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
    @Autowired EnrollmentService enrollments;
    @org.springframework.beans.factory.annotation.Value("${app.jwt.secret}") String secret;

    private AppUser teacher() {
        return users.findByEmailIgnoreCase("enseignant@demo.local").orElseThrow();
    }

    private Course emotions() {
        return courses.findAllByOrderByIdAsc().stream().filter(c -> c.getTitle().startsWith("Gérer")).findFirst().orElseThrow();
    }

    /** Bonnes reponses du quiz d'une lecon (ce que l'apprenant a coche pour reussir). */
    private static List<Integer> rightAnswers(Course c, Lesson l) {
        return c.getQuestions().stream().filter(q -> q.getLesson() != null && q.getLesson().getId().equals(l.getId()))
                .map(q -> QuestionGrader.solution(q, QuestionGrader.identity(q.getOptions().size()))).toList();
    }

    private static ProgressItem done(Course c, Lesson l, Instant at, int seconds, boolean offline) {
        return new ProgressItem(l.getId(), at, seconds, offline, rightAnswers(c, l));
    }

    @Test
    void offlineSyncIsIdempotentAndResolvesConflicts() {
        AppUser u = teacher();
        Course c = emotions();
        Lesson l = c.getLessons().get(2); // les lecons 1 et 2 sont deja faites dans le jeu de demonstration
        Instant early = Instant.parse("2026-11-01T08:00:00Z");
        Instant late = Instant.parse("2026-11-05T08:00:00Z");

        learning.sync(u, List.of(done(c, l, late, 120, false)));
        // rejeu depuis un second appareil hors ligne : date plus ancienne, temps plus long
        SyncResponse r = learning.sync(u, List.of(done(c, l, early, 300, true), done(c, l, early, 300, true)));

        List<ProgressItem> forLesson = r.serverState().stream().filter(p -> p.lessonId().equals(l.getId())).toList();
        assertThat(forLesson).hasSize(1);
        assertThat(forLesson.getFirst().completedAt()).isEqualTo(early);
        assertThat(forLesson.getFirst().timeSpentSeconds()).isEqualTo(300);
        assertThat(forLesson.getFirst().offline()).isTrue();
        assertThat(r.rejected()).isEmpty();
    }

    @Test
    void syncRefusesSkippedLessonsAndFailedQuizzes() {
        AppUser u = teacher();
        Course c = emotions();
        Lesson third = c.getLessons().get(2);
        Lesson fourth = c.getLessons().get(3);

        // saut d'une lecon : la 4e sans la 3e
        SyncResponse skipped = learning.sync(u, List.of(done(c, fourth, Instant.now(), 60, false)));
        assertThat(skipped.accepted()).isZero();
        assertThat(skipped.rejected()).extracting(RejectedItem::lessonId).containsExactly(fourth.getId());

        // quiz de la lecon rate ou absent : refuse
        List<Integer> wrong = rightAnswers(c, third).stream().map(a -> (a + 1) % 3).toList();
        SyncResponse failed = learning.sync(u, List.of(
                new ProgressItem(third.getId(), Instant.now(), 60, false, wrong),
                new ProgressItem(third.getId(), Instant.now(), 60, false, null)));
        assertThat(failed.accepted()).isZero();
        assertThat(failed.rejected()).hasSize(2).allMatch(x -> x.reason().contains("Quiz"));

        // dans l'ordre et avec le quiz reussi : accepte, meme envoye dans le desordre au sein d'un lot
        SyncResponse ok = learning.sync(u, List.of(done(c, fourth, Instant.now(), 60, true), done(c, third, Instant.now(), 60, true)));
        assertThat(ok.accepted()).isEqualTo(2);
        assertThat(ok.rejected()).isEmpty();
    }

    @Test
    void finalExamQuestionsAreDistinctFromLessonQuizzesAndNeverSentWithAnswers() {
        Course c = emotions();
        List<QuizQuestion> exam = c.examQuestions();
        assertThat(exam).isNotEmpty().allMatch(q -> q.getLesson() == null);
        AppUser u = teacher();
        CoursePackage pkg = learning.coursePackage(u, c.getId());
        // l'examen envoye au client : uniquement des questions d'examen, sans bonne reponse (QuestionDto n'en a pas)
        assertThat(pkg.questions()).extracting(QuestionDto::id).containsExactlyElementsOf(exam.stream().map(QuizQuestion::getId).toList());
        java.util.Set<Long> checkIds = new java.util.HashSet<>();
        pkg.lessons().forEach(l -> l.checks().forEach(q -> checkIds.add(q.id())));
        assertThat(pkg.questions()).noneMatch(q -> checkIds.contains(q.id()));
        assertThat(QuestionDto.class.getRecordComponents()).noneMatch(rc -> rc.getName().toLowerCase().contains("correct"));
    }

    @Test
    void certificationLevelsAreIssuedProgressively() {
        AppUser u = teacher();
        Course c = emotions();
        List<ProgressItem> all = c.getLessons().stream()
                .map(l -> done(c, l, Instant.now().minusSeconds(60), 60, false)).toList();

        SyncResponse s = learning.sync(u, all);
        assertThat(s.newCertificates()).extracting(CertificateDto::level).containsExactly(CertificateLevel.ATTESTATION);

        List<Integer> right = c.examQuestions().stream().map(q -> QuestionGrader.solution(q, QuestionGrader.examPermutation(q, secret))).toList();
        List<Integer> wrong = right.stream().map(a -> (a + 1) % 3).toList();

        QuizResult failed = learning.submitQuiz(u, c.getId(), wrong);
        assertThat(failed.passed()).isFalse();
        assertThat(failed.newCertificates()).isEmpty();

        QuizResult full = learning.submitQuiz(u, c.getId(), right);
        assertThat(full.mastery()).isTrue();
        assertThat(full.newCertificates()).extracting(CertificateDto::level)
                .containsExactlyInAnyOrder(CertificateLevel.BADGE, CertificateLevel.MAITRISE);
        assertThat(full.corrections()).allMatch(QuestionCorrection::correct);

        // aucun doublon en cas de nouvelle reussite
        assertThat(learning.submitQuiz(u, c.getId(), right).newCertificates()).isEmpty();
    }

    @Test
    void learnerMustEnrollAndFollowLessonsBeforeFinalEvaluation() {
        AppUser u = users.findByEmailIgnoreCase("jeune@demo.local").orElseThrow();
        Course c = emotions();
        // pas inscrit : pas d'acces au contenu
        assertThatThrownBy(() -> learning.coursePackage(u, c.getId())).isInstanceOf(ResponseStatusException.class);

        EnrollResult r = enrollments.enroll(u, new EnrollRequest(c.getId(), null, Enrollment.Method.GRATUIT, null, null));
        assertThat(r.courseId()).isEqualTo(c.getId());
        CoursePackage pkg = learning.coursePackage(u, c.getId());
        // apres chaque notion, un test de comprehension (corrige sur l'appareil)
        assertThat(pkg.lessons()).allMatch(l -> !l.checks().isEmpty());

        // l'evaluation finale reste fermee tant que toutes les lecons ne sont pas terminees
        assertThatThrownBy(() -> learning.submitQuiz(u, c.getId(), List.of(0, 0, 0)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("Terminez");
    }

    @Test
    void paidCourseNeedsLicenceSubscriptionOrRealOnlinePayment() {
        AppUser u = users.findByEmailIgnoreCase("jeune@demo.local").orElseThrow();
        Course paid = courses.findAllByOrderByIdAsc().stream().filter(c -> c.getPrice() > 0).findFirst().orElseThrow();
        assertThatThrownBy(() -> enrollments.enroll(u, new EnrollRequest(paid.getId(), null, Enrollment.Method.GRATUIT, null, null)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> enrollments.enroll(u, new EnrollRequest(paid.getId(), null, Enrollment.Method.CODE, null, "FAUX")))
                .isInstanceOf(ResponseStatusException.class);
        // plus aucun paiement simule : Mobile Money / carte passent obligatoirement par le prestataire
        assertThatThrownBy(() -> enrollments.enroll(u, new EnrollRequest(paid.getId(), null, Enrollment.Method.MOBILE_MONEY, "+22997000000", null)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> enrollments.enroll(u, new EnrollRequest(paid.getId(), null, Enrollment.Method.ABONNEMENT, null, null)))
                .isInstanceOf(ResponseStatusException.class);
        EnrollResult ok = enrollments.enroll(u, new EnrollRequest(paid.getId(), null, Enrollment.Method.CODE, null, "gdp-2027"));
        assertThat(ok.paymentRef()).isEqualTo("LIC-GDP-2027");
        assertThat(enrollments.isEnrolled(u, paid)).isTrue();
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
