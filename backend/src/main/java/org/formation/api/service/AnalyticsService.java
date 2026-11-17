package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Indicateurs du tableau de bord (completion, scores, frequence de connexion, abandons, usage hors ligne,
 * temps moyen / median, retours utilisateurs), filtrables par pays, zone et groupe RCT.
 * Calcul en memoire pour la demonstration ; en production : vues materialisees SQL rafraichies la nuit.
 */
@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    /** Sans activite depuis ce delai sans avoir termine le module = abandon. */
    private static final Duration DROPOUT_AFTER = Duration.ofDays(14);
    private static final Set<Role> STAFF = EnumSet.of(Role.ADMIN, Role.FORMATEUR);

    private final AppUserRepository users;
    private final CourseRepository courses;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CertificateRepository certificates;
    private final CourseFeedbackRepository feedbacks;
    private final ActivityEventRepository activity;

    public AnalyticsService(AppUserRepository users, CourseRepository courses, LessonProgressRepository progress,
                            QuizAttemptRepository attempts, CertificateRepository certificates,
                            CourseFeedbackRepository feedbacks, ActivityEventRepository activity) {
        this.users = users;
        this.courses = courses;
        this.progress = progress;
        this.attempts = attempts;
        this.certificates = certificates;
        this.feedbacks = feedbacks;
        this.activity = activity;
    }

    public record Filter(String country, String region, String cohort) {
        boolean matches(AppUser u) {
            return (blank(country) || country.equals(u.getCountryCode()))
                    && (blank(region) || region.equals(u.getRegion()))
                    && (blank(cohort) || cohort.equals(u.getCohort()));
        }

        private static boolean blank(String s) {
            return s == null || s.isBlank();
        }
    }

    public Dashboard dashboard(Filter f) {
        Map<Long, AppUser> learners = users.findByRoleNotIn(STAFF).stream().filter(f::matches)
                .collect(Collectors.toMap(AppUser::getId, Function.identity()));
        Set<Long> ids = learners.keySet();
        Instant now = Instant.now();

        List<LessonProgress> prog = progress.findAllForExport().stream().filter(p -> ids.contains(p.getUser().getId())).toList();
        List<QuizAttempt> atts = attempts.findAllForExport().stream().filter(a -> ids.contains(a.getUser().getId())).toList();
        List<Certificate> certs = certificates.findAllForExport().stream().filter(c -> ids.contains(c.getUser().getId())).toList();
        List<CourseFeedback> fbs = feedbacks.findAllForExport().stream().filter(x -> ids.contains(x.getUser().getId())).toList();
        List<ActivityEvent> events = activity.findByAtAfter(now.minus(Duration.ofDays(28))).stream()
                .filter(e -> ids.contains(e.getUserId())).toList();

        long active7d = events.stream().filter(e -> e.getAt().isAfter(now.minus(Duration.ofDays(7))))
                .map(ActivityEvent::getUserId).distinct().count();
        long logins28 = events.stream().filter(e -> e.getType() == ActivityEvent.Type.LOGIN).count();
        double loginsPerWeek = ids.isEmpty() ? 0 : logins28 / 4.0 / ids.size();
        double offlineShare = prog.isEmpty() ? 0 : prog.stream().filter(LessonProgress::isCompletedOffline).count() / (double) prog.size();

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Map<LocalDate, Long> perDay = prog.stream().filter(p -> p.getCompletedAt() != null)
                .collect(Collectors.groupingBy(p -> LocalDate.ofInstant(p.getCompletedAt(), ZoneOffset.UTC), Collectors.counting()));
        List<CountStat> last14 = new ArrayList<>();
        for (int i = 13; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            last14.add(new CountStat(d.toString(), perDay.getOrDefault(d, 0L)));
        }

        List<CourseStats> perCourse = courses.findAllByOrderByIdAsc().stream()
                .map(c -> courseStats(c, prog, atts, fbs, now)).toList();

        return new Dashboard(
                ids.size(), active7d, round(loginsPerWeek), prog.size(), round(offlineShare), certs.size(),
                round(fbs.stream().mapToInt(CourseFeedback::getRating).average().orElse(0)),
                count(certs.stream().map(c -> c.getLevel().label())),
                count(learners.values().stream().map(u -> u.getRole().name())),
                count(learners.values().stream().map(u -> Objects.requireNonNullElse(u.getRegion(), "-"))),
                count(learners.values().stream().map(u -> Objects.requireNonNullElse(u.getCohort(), "Non assigné"))),
                last14, perCourse);
    }

    private CourseStats courseStats(Course c, List<LessonProgress> prog, List<QuizAttempt> atts,
                                    List<CourseFeedback> fbs, Instant now) {
        int lessonCount = c.getLessons().size();
        Map<Long, List<LessonProgress>> byUser = prog.stream()
                .filter(p -> p.getLesson().getCourse().getId().equals(c.getId()))
                .collect(Collectors.groupingBy(p -> p.getUser().getId()));
        long started = byUser.size();
        List<Double> minutesToComplete = new ArrayList<>();
        long completed = 0;
        long dropouts = 0;
        long offline = 0;
        long total = 0;
        for (List<LessonProgress> ps : byUser.values()) {
            total += ps.size();
            offline += ps.stream().filter(LessonProgress::isCompletedOffline).count();
            if (lessonCount > 0 && ps.size() >= lessonCount) {
                completed++;
                minutesToComplete.add(ps.stream().mapToInt(LessonProgress::getTimeSpentSeconds).sum() / 60.0);
            } else {
                Instant last = ps.stream().map(LessonProgress::getCompletedAt).filter(Objects::nonNull)
                        .max(Comparator.naturalOrder()).orElse(now);
                if (last.isBefore(now.minus(DROPOUT_AFTER))) dropouts++;
            }
        }
        Collections.sort(minutesToComplete);
        double median = minutesToComplete.isEmpty() ? 0
                : minutesToComplete.size() % 2 == 1 ? minutesToComplete.get(minutesToComplete.size() / 2)
                : (minutesToComplete.get(minutesToComplete.size() / 2 - 1) + minutesToComplete.get(minutesToComplete.size() / 2)) / 2;
        List<CourseFeedback> cf = fbs.stream().filter(x -> x.getCourse().getId().equals(c.getId())).toList();
        return new CourseStats(c.getId(), c.getTitle(), started, completed,
                round(started == 0 ? 0 : completed / (double) started),
                round(atts.stream().filter(a -> a.getCourse().getId().equals(c.getId())).mapToInt(QuizAttempt::getScorePercent).average().orElse(0)),
                round(minutesToComplete.stream().mapToDouble(Double::doubleValue).average().orElse(0)),
                round(median), dropouts, round(total == 0 ? 0 : offline / (double) total),
                round(cf.stream().mapToInt(CourseFeedback::getRating).average().orElse(0)), cf.size());
    }

    /** Erreurs les plus frequentes par question + retours utilisateurs : base de la boucle d'amelioration. */
    public CourseInsights insights(Long courseId) {
        Course c = courses.findById(courseId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<QuizAttempt> atts = attempts.findByCourseId(courseId);
        List<QuizQuestion> qs = c.getQuestions();
        List<QuestionInsight> qi = new ArrayList<>();
        for (int i = 0; i < qs.size(); i++) {
            QuizQuestion q = qs.get(i);
            long[] counts = new long[q.getOptions().size()];
            long answered = 0;
            for (QuizAttempt a : atts) {
                String[] parts = a.getAnswers() == null ? new String[0] : a.getAnswers().split(",", -1);
                if (i < parts.length && !parts[i].isBlank()) {
                    int idx = Integer.parseInt(parts[i]);
                    if (idx >= 0 && idx < counts.length) {
                        counts[idx]++;
                        answered++;
                    }
                }
            }
            List<OptionStat> dist = new ArrayList<>();
            for (int j = 0; j < counts.length; j++) {
                dist.add(new OptionStat(q.getOptions().get(j), counts[j], j == q.getCorrectIndex()));
            }
            double err = answered == 0 ? 0 : (answered - counts[q.getCorrectIndex()]) / (double) answered;
            qi.add(new QuestionInsight(q.getId(), q.getQuestion(), answered, round(err), dist));
        }
        List<CourseFeedback> fb = feedbacks.findByCourseId(courseId);
        return new CourseInsights(c.getId(), c.getTitle(), c.getContentVersion(), atts.size(), qi,
                fb.stream().map(CourseFeedback::getComment).filter(s -> s != null && !s.isBlank()).distinct().toList(),
                round(fb.stream().mapToInt(CourseFeedback::getRating).average().orElse(0)),
                round(fb.stream().mapToInt(CourseFeedback::getClarity).average().orElse(0)),
                round(fb.stream().mapToInt(CourseFeedback::getUsefulness).average().orElse(0)));
    }

    private static List<CountStat> count(java.util.stream.Stream<String> s) {
        return s.collect(Collectors.groupingBy(x -> x, TreeMap::new, Collectors.counting())).entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> new CountStat(e.getKey(), e.getValue())).toList();
    }

    private static double round(double d) {
        return Math.round(d * 100) / 100.0;
    }
}
