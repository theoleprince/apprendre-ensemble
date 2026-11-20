package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/**
 * Motivation de l'apprenant, calculee a partir de son activite reelle (lecons terminees, evaluations, certificats) :
 * serie de jours, objectif hebdomadaire, points d'experience et niveaux, badges, rappels par e-mail (avec consentement).
 */
@Service
@Transactional
public class EngagementService {

    private static final Logger log = LoggerFactory.getLogger(EngagementService.class);

    /** Barreme des points d'experience. */
    static final int XP_LESSON = 10;
    static final int XP_EXAM = 30;
    static final int XP_CERTIFICATE = 50;

    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CertificateRepository certificates;
    private final EnrollmentRepository enrollments;
    private final AppUserRepository users;
    private final MailService mail;
    private final ZoneId zone;
    private final String publicUrl;

    public EngagementService(LessonProgressRepository progress, QuizAttemptRepository attempts, CertificateRepository certificates,
                             EnrollmentRepository enrollments, AppUserRepository users, MailService mail,
                             @Value("${app.timezone:Africa/Porto-Novo}") String zone,
                             @Value("${app.public-url:http://localhost:4200}") String publicUrl) {
        this.progress = progress;
        this.attempts = attempts;
        this.certificates = certificates;
        this.enrollments = enrollments;
        this.users = users;
        this.mail = mail;
        this.zone = ZoneId.of(zone);
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    @Transactional(readOnly = true)
    public Engagement engagement(AppUser u) {
        return compute(u, LocalDate.now(zone));
    }

    Engagement compute(AppUser u, LocalDate today) {
        List<LessonProgress> lessons = progress.findAllForUser(u.getId());
        List<QuizAttempt> exams = attempts.findByUserId(u.getId());
        List<Certificate> certs = certificates.findValidForUser(u.getId());

        // activite par jour (minutes et lecons)
        Map<LocalDate, int[]> days = new TreeMap<>();
        for (LessonProgress p : lessons) {
            if (p.getCompletedAt() == null) continue;
            int[] d = days.computeIfAbsent(day(p.getCompletedAt()), k -> new int[2]);
            d[0] += Math.max(1, Math.round(p.getTimeSpentSeconds() / 60f));
            d[1]++;
        }
        for (QuizAttempt a : exams) {
            days.computeIfAbsent(day(a.getAttemptedAt()), k -> new int[2])[0] += 5;
        }

        // serie : jours consecutifs actifs se terminant aujourd'hui (ou hier : la serie n'est pas encore perdue)
        int streak = 0;
        LocalDate cursor = days.containsKey(today) ? today : today.minusDays(1);
        while (days.containsKey(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        int best = 0;
        int run = 0;
        LocalDate prev = null;
        Map<Integer, LocalDate> streakReached = new HashMap<>();
        for (LocalDate d : days.keySet()) {
            run = prev != null && prev.plusDays(1).equals(d) ? run + 1 : 1;
            best = Math.max(best, run);
            for (int t : new int[]{3, 7, 30}) if (run >= t) streakReached.putIfAbsent(t, d);
            prev = d;
        }

        // semaine en cours (lundi -> dimanche)
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<DayActivity> week = new ArrayList<>();
        int weekMinutes = 0;
        for (int i = 0; i < 7; i++) {
            LocalDate d = monday.plusDays(i);
            int[] a = days.getOrDefault(d, new int[2]);
            week.add(new DayActivity(d, a[0], a[1]));
            weekMinutes += a[0];
        }

        // objectif atteint au moins une semaine
        Map<LocalDate, Integer> perWeek = new TreeMap<>();
        days.forEach((d, a) -> perWeek.merge(d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), a[0], Integer::sum));
        LocalDate goalWeek = perWeek.entrySet().stream().filter(e -> e.getValue() >= u.getWeeklyGoalMinutes())
                .map(Map.Entry::getKey).findFirst().orElse(null);

        // points d'experience
        Set<Long> passedCourses = new HashSet<>();
        exams.stream().filter(QuizAttempt::isPassed).forEach(a -> passedCourses.add(a.getCourse().getId()));
        int xp = lessons.size() * XP_LESSON + passedCourses.size() * XP_EXAM + certs.size() * XP_CERTIFICATE;
        int level = 1;
        while (xp >= threshold(level + 1)) level++;

        // badges
        List<Instant> lessonDates = lessons.stream().map(LessonProgress::getCompletedAt).filter(Objects::nonNull).sorted().toList();
        List<Instant> certDates = certs.stream().map(Certificate::getIssuedAt).filter(Objects::nonNull).sorted().toList();
        Instant perfect = exams.stream().filter(a -> a.getScorePercent() == 100).map(QuizAttempt::getAttemptedAt).min(Comparator.naturalOrder()).orElse(null);
        Instant offline = lessons.stream().filter(LessonProgress::isCompletedOffline).map(LessonProgress::getCompletedAt)
                .filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
        List<Enrollment> enrolled = enrollments.findAllForUser(u.getId());
        List<Instant> courseEnrolls = enrolled.stream().filter(e -> e.getCourse() != null).map(Enrollment::getEnrolledAt)
                .filter(Objects::nonNull).sorted().toList();

        List<BadgeDto> badges = new ArrayList<>();
        badges.add(count("PREMIERE_LECON", "Premier pas", "Terminer une première leçon", "sprout", lessonDates, 1));
        badges.add(count("DIX_LECONS", "Sur la bonne voie", "Terminer 10 leçons", "book-open", lessonDates, 10));
        badges.add(count("CINQUANTE_LECONS", "Infatigable", "Terminer 50 leçons", "trophy", lessonDates, 50));
        badges.add(count("PREMIER_CERTIFICAT", "Certifié·e", "Obtenir un premier certificat", "award", certDates, 1));
        badges.add(count("CINQ_CERTIFICATS", "Collection", "Obtenir 5 certificats", "medal", certDates, 5));
        badges.add(flag("SANS_FAUTE", "Sans faute", "Obtenir 100 % à une évaluation finale", "target", perfect));
        badges.add(streakBadge("SERIE_3", "En rythme", "Apprendre 3 jours de suite", 3, best, streakReached));
        badges.add(streakBadge("SERIE_7", "Une semaine pleine", "Apprendre 7 jours de suite", 7, best, streakReached));
        badges.add(streakBadge("SERIE_30", "Habitude installée", "Apprendre 30 jours de suite", 30, best, streakReached));
        badges.add(flag("OBJECTIF", "Objectif tenu", "Atteindre son objectif d'une semaine", "calendar",
                goalWeek == null ? null : goalWeek.atStartOfDay(zone).toInstant()));
        badges.add(flag("HORS_LIGNE", "Partout", "Terminer une leçon sans connexion", "wifi-off", offline));
        badges.add(count("EXPLORATEUR", "Curieux·se", "Suivre 3 cours différents", "compass", courseEnrolls, 3));

        return new Engagement(streak, best, days.containsKey(today), week, weekMinutes, u.getWeeklyGoalMinutes(),
                u.isRemindersEnabled(), xp, level, threshold(level), threshold(level + 1), badges);
    }

    public Engagement saveGoals(AppUser u, GoalsInput in) {
        u.setWeeklyGoalMinutes(in.weeklyGoalMinutes());
        u.setRemindersEnabled(in.remindersEnabled());
        users.save(u);
        return engagement(u);
    }

    /** Niveau n atteint a 50 * n * (n - 1) points : 0, 100, 300, 600, 1000... */
    static int threshold(int level) {
        return 50 * level * (level - 1);
    }

    /**
     * Rappel bienveillant apres 3 jours sans activite, au plus une fois par semaine, uniquement aux personnes
     * qui l'ont demande et qui ont un cours en cours.
     */
    @Scheduled(cron = "${app.reminders.cron:0 0 9 * * *}", zone = "${app.timezone:Africa/Porto-Novo}")
    public void sendReminders() {
        if (!mail.enabled()) return;
        Instant now = Instant.now();
        int sent = 0;
        for (AppUser u : users.findByRemindersEnabledTrueAndEnabledTrueAndDeletedAtIsNull()) {
            if (u.getEmail() == null || u.getEmail().endsWith(".local") || u.getEmail().endsWith(".invalid")) continue;
            if (u.getLastActiveAt() != null && u.getLastActiveAt().isAfter(now.minus(Duration.ofDays(3)))) continue;
            if (u.getLastReminderAt() != null && u.getLastReminderAt().isAfter(now.minus(Duration.ofDays(7)))) continue;
            Optional<Enrollment> open = enrollments.findAllForUser(u.getId()).stream()
                    .filter(e -> e.getCourse() != null)
                    .filter(e -> progress.countByUserIdAndLessonCourseId(u.getId(), e.getCourse().getId()) < e.getCourse().getLessons().size())
                    .findFirst();
            if (open.isEmpty()) continue;
            String first = u.getFullName() == null ? "" : " " + u.getFullName().trim().split("\\s+")[0];
            String body = "Bonjour" + first + ",\n\n"
                    + "Votre cours « " + open.get().getCourse().getTitle() + " » vous attend. "
                    + "Quelques minutes suffisent pour avancer d'une leçon.\n\n"
                    + "Reprendre : " + publicUrl + "/apprendre/" + open.get().getCourse().getId() + "\n\n"
                    + "Vous recevez ce message car vous avez activé les rappels. "
                    + "Pour les désactiver : " + publicUrl + "/profil\n";
            if (mail.send(u.getEmail(), "Votre prochaine leçon vous attend", body)) {
                u.setLastReminderAt(now);
                users.save(u);
                sent++;
            }
        }
        if (sent > 0) log.info("Rappels d'apprentissage envoyés : {}", sent);
    }

    private LocalDate day(Instant i) {
        return i.atZone(zone).toLocalDate();
    }

    private static BadgeDto count(String code, String label, String desc, String icon, List<Instant> dates, int target) {
        boolean ok = dates.size() >= target;
        return new BadgeDto(code, label, desc, icon, ok, ok ? dates.get(target - 1) : null, Math.min(dates.size(), target), target);
    }

    private static BadgeDto flag(String code, String label, String desc, String icon, Instant at) {
        return new BadgeDto(code, label, desc, icon, at != null, at, at != null ? 1 : 0, 1);
    }

    private BadgeDto streakBadge(String code, String label, String desc, int target, int best, Map<Integer, LocalDate> reached) {
        LocalDate d = reached.get(target);
        return new BadgeDto(code, label, desc, "flame", d != null, d == null ? null : d.atStartOfDay(zone).toInstant(),
                Math.min(best, target), target);
    }
}
