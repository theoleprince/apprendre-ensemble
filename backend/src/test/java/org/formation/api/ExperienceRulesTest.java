package org.formation.api;

import org.formation.api.domain.*;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.CourseRepository;
import org.formation.api.service.*;
import org.formation.api.web.dto.Dtos.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Experience apprenant : nouveaux exercices, notes, motivation, avis et pages de presentation. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:experience;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "app.seed.demo-data=true",
        "app.media.dir=target/test-media",
        "app.ai.enabled=false"})
@Transactional
class ExperienceRulesTest {

    @Autowired LearningService learning;
    @Autowired EnrollmentService enrollments;
    @Autowired NoteService notes;
    @Autowired EngagementService engagement;
    @Autowired AppUserRepository users;
    @Autowired CourseRepository courses;
    @Value("${app.jwt.secret}") String secret;

    private AppUser user(String email) {
        return users.findByEmailIgnoreCase(email).orElseThrow();
    }

    private Course course(String prefix) {
        return courses.findAllByOrderByIdAsc().stream().filter(c -> c.getTitle().startsWith(prefix)).findFirst().orElseThrow();
    }

    @Test
    void arrangementExercisesAreShuffledByTheServerAndGradedServerSide() {
        AppUser u = user("enseignant@demo.local");
        Course c = course("Gérer");
        QuizQuestion match = c.examQuestions().stream().filter(q -> q.getKind() == QuestionKind.MATCH).findFirst().orElseThrow();

        // le paquet ne revele pas la solution : la colonne de droite n'est pas dans l'ordre d'origine
        QuestionDto shown = learning.coursePackage(u, c.getId()).questions().stream()
                .filter(q -> q.id().equals(match.getId())).findFirst().orElseThrow();
        List<String> rights = shown.options().stream().map(QuestionGrader::right).toList();
        List<String> original = match.getOptions().stream().map(QuestionGrader::right).toList();
        assertThat(rights).containsExactlyInAnyOrderElementsOf(original).isNotEqualTo(original);
        assertThat(shown.kind()).isEqualTo(QuestionKind.MATCH);

        int[] perm = QuestionGrader.examPermutation(match, secret);
        int solution = QuestionGrader.solution(match, perm);
        assertThat(QuestionGrader.correct(match, solution, perm)).isTrue();
        assertThat(QuestionGrader.correct(match, 123, perm)).isFalse();   // l'ordre affiche n'est pas la solution
        assertThat(QuestionGrader.correct(match, 112, perm)).isFalse();   // reponse invalide (doublon)
        assertThat(QuestionGrader.correct(match, null, perm)).isFalse();
    }

    @Test
    void orderExerciseCodesAreDecodedStrictly() {
        QuizQuestion q = new QuizQuestion();
        q.setKind(QuestionKind.ORDER);
        q.getOptions().addAll(List.of("a", "b", "c"));
        int[] perm = {2, 0, 1};                               // affiche : c, a, b
        assertThat(QuestionGrader.displayOptions(q, perm)).containsExactly("c", "a", "b");
        assertThat(QuestionGrader.solution(q, perm)).isEqualTo(231); // a (2e affiche), b (3e), c (1er)
        assertThat(QuestionGrader.correct(q, 231, perm)).isTrue();
        assertThat(QuestionGrader.correct(q, 123, perm)).isFalse();
        assertThat(QuestionGrader.correct(q, 2310, perm)).isFalse();
    }

    @Test
    void notesArePrivateToEnrolledLearnersAndEmptyNotesAreRemoved() {
        AppUser u = user("enseignant@demo.local");
        Course c = course("Gérer");
        Lesson l = c.getLessons().getFirst();
        NoteDto n = notes.save(u, l.getId(), new NoteInput("  Respiration 4-6 chaque matin  ", true));
        assertThat(n.text()).isEqualTo("Respiration 4-6 chaque matin");
        assertThat(notes.forCourse(u, c.getId())).extracting(NoteDto::lessonId).containsExactly(l.getId());

        notes.save(u, l.getId(), new NoteInput("", false));
        assertThat(notes.forCourse(u, c.getId())).isEmpty();

        AppUser parent = user("parent@demo.local");
        assertThatThrownBy(() -> notes.save(parent, course("Piloter").getLessons().getFirst().getId(), new NoteInput("x", false)))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void engagementReflectsRealActivity() {
        AppUser u = user("enseignant@demo.local");
        Course c = course("Gérer");
        Lesson l3 = c.getLessons().get(2);
        List<Integer> answers = c.getQuestions().stream().filter(q -> q.getLesson() != null && q.getLesson().getId().equals(l3.getId()))
                .map(q -> QuestionGrader.solution(q, QuestionGrader.identity(q.getOptions().size()))).toList();
        Engagement before = engagement.engagement(u);
        learning.sync(u, List.of(new ProgressItem(l3.getId(), Instant.now(), 600, false, answers)));

        Engagement e = engagement.engagement(u);
        assertThat(e.activeToday()).isTrue();
        assertThat(e.streak()).isGreaterThanOrEqualTo(1);
        assertThat(e.xp()).isEqualTo(before.xp() + 10);
        assertThat(e.weekMinutes()).isGreaterThanOrEqualTo(10);
        assertThat(e.week()).hasSize(7);
        assertThat(e.badges()).filteredOn(BadgeDto::earned).extracting(BadgeDto::code).contains("PREMIERE_LECON");
        assertThat(e.nextLevelXp()).isGreaterThan(e.xp());

        Engagement g = engagement.saveGoals(u, new GoalsInput(90, true));
        assertThat(g.weeklyGoalMinutes()).isEqualTo(90);
        assertThat(g.remindersEnabled()).isTrue();
    }

    @Test
    void publicPagesShowRealReviewsWithoutFullNames() {
        Course c = course("Gérer");
        CourseDetail d = enrollments.courseDetail(null, c.getId());
        assertThat(d.presentation().objectives()).isNotEmpty();
        assertThat(d.presentation().authorName()).isNotBlank();
        assertThat(d.preview()).isNotNull();
        assertThat(d.related()).hasSize(3).noneMatch(r -> r.id().equals(c.getId()));
        assertThat(d.reviews().count()).isEqualTo(java.util.Arrays.stream(d.reviews().histogram()).sum());

        PublicStats s = enrollments.publicStats();
        assertThat(s.learners()).isPositive();
        assertThat(s.certificates()).isPositive();
        assertThat(s.testimonials()).allSatisfy(t -> assertThat(t.author()).matches("\\S+( \\S\\.)?"));
    }
}
