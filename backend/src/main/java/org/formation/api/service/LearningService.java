package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.repository.ProgramCertificateRepository;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class LearningService {

    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CertificateRepository certificates;
    private final CourseFeedbackRepository feedbacks;
    private final ActivityEventRepository activity;
    private final AppUserRepository users;
    private final CertificationService certification;
    private final AccessPolicy policy;
    private final ProgramService programs;
    private final ClassroomLocks locks;
    private final ProgramCertificateRepository programCerts;
    private final EnrollmentService enrollments;

    public LearningService(CourseRepository courses, LessonRepository lessons, LessonProgressRepository progress,
                           QuizAttemptRepository attempts, CertificateRepository certificates,
                           CourseFeedbackRepository feedbacks, ActivityEventRepository activity, AppUserRepository users,
                           CertificationService certification, AccessPolicy policy, ProgramService programs,
                           ClassroomLocks locks, ProgramCertificateRepository programCerts, EnrollmentService enrollments) {
        this.courses = courses;
        this.lessons = lessons;
        this.progress = progress;
        this.attempts = attempts;
        this.certificates = certificates;
        this.feedbacks = feedbacks;
        this.activity = activity;
        this.users = users;
        this.certification = certification;
        this.policy = policy;
        this.programs = programs;
        this.locks = locks;
        this.programCerts = programCerts;
        this.enrollments = enrollments;
    }

    @Transactional(readOnly = true)
    public List<Course> visible(AppUser user) {
        return courses.findAllByOrderByIdAsc().stream().filter(c -> policy.canAccess(user, c)).toList();
    }

    @Transactional(readOnly = true)
    public List<CourseSummary> visibleCourses(AppUser user) {
        Map<Long, Long> doneByCourse = progress.findAllForUser(user.getId()).stream()
                .collect(Collectors.groupingBy(p -> p.getLesson().getCourse().getId(), Collectors.counting()));
        Map<Long, List<CertificateLevel>> levels = certificates.findAllForUser(user.getId()).stream()
                .collect(Collectors.groupingBy(c -> c.getCourse().getId(),
                        Collectors.mapping(Certificate::getLevel, Collectors.toList())));
        Set<Long> recommended = recommendedIds(user);
        return visible(user).stream()
                .map(c -> summary(c, doneByCourse.getOrDefault(c.getId(), 0L).intValue(),
                        levels.getOrDefault(c.getId(), List.of()), recommended.contains(c.getId())))
                .toList();
    }

    public static Set<Long> recommendedIds(AppUser user) {
        if (user.getRecommendedCourseIds() == null || user.getRecommendedCourseIds().isBlank()) return Set.of();
        return Arrays.stream(user.getRecommendedCourseIds().split(",")).map(String::trim)
                .filter(s -> !s.isEmpty()).map(Long::valueOf).collect(Collectors.toSet());
    }

    public static CourseSummary summary(Course c, int done, List<CertificateLevel> levels, boolean recommended) {
        int minutes = c.getLessons().stream().mapToInt(Lesson::getDurationMinutes).sum();
        long bytes = c.getLessons().stream().mapToLong(Lesson::getMediaSizeBytes).sum();
        List<CertificateLevel> sorted = levels.stream().sorted().toList();
        return new CourseSummary(c.getId(), c.getTitle(), c.getDescription(), c.getIcon(), c.getType(),
                c.getDomain() == null ? null : c.getDomain().getName(),
                c.getCountryCode(), c.getLanguageCode(), c.getLessons().size(), minutes, bytes, done, sorted,
                c.getContentVersion(), recommended);
    }

    @Transactional(readOnly = true)
    public CoursePackage coursePackage(AppUser user, Long courseId) {
        Course c = enrolledCourse(user, courseId);
        enrollments.lockReason(user, c).ifPresent(r -> {
            throw new ResponseStatusException(HttpStatus.LOCKED, r);
        });
        return new CoursePackage(c.getId(), c.getTitle(), c.getDescription(), c.getIcon(), c.getType(),
                c.getPassScore(), c.getMasteryScore(), c.isExpertiseEnabled(), c.getContentVersion(), c.getUpdatedAt(),
                c.getLessons().stream().map(l -> lessonDto(l, c.getQuestions())).toList(),
                c.examQuestions().stream().map(q -> new QuestionDto(q.getId(), q.getQuestion(), List.copyOf(q.getOptions()))).toList());
    }

    static LessonDto lessonDto(Lesson l, List<QuizQuestion> questions) {
        List<CheckQuestion> checks = questions.stream()
                .filter(q -> q.getLesson() != null && q.getLesson().getId().equals(l.getId()))
                .map(q -> new CheckQuestion(q.getId(), q.getQuestion(), List.copyOf(q.getOptions()), q.getCorrectIndex(), q.getExplanation()))
                .toList();
        return new LessonDto(l.getId(), l.getPosition(), l.getTitle(), l.getMediaType(), l.getMediaUrl(),
                l.getMediaSizeBytes(), l.getSubtitlesUrl(), l.getContent(), l.getPracticeTask(), l.getDurationMinutes(), checks);
    }

    /** Cours accessible ET suivi : il faut etre inscrit pour acceder au contenu. */
    public Course enrolledCourse(AppUser user, Long courseId) {
        Course c = accessibleCourse(user, courseId);
        if (!enrollments.isEnrolled(user, c)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Inscrivez-vous à ce cours pour le suivre");
        }
        return c;
    }

    /**
     * Synchronisation idempotente de la progression faite hors ligne.
     * Conflits (meme lecon sur deux appareils / rejeu) : date de completion la plus ancienne,
     * temps passe le plus grand, indicateur hors ligne conserve s'il a ete vrai une fois.
     */
    public SyncResponse sync(AppUser user, List<ProgressItem> items) {
        int accepted = 0;
        Set<Course> touched = new HashSet<>();
        List<RejectedItem> rejected = new ArrayList<>();
        // lecons deja validees, enrichies au fil du lot : l'ordre d'un meme cours est respecte dans un envoi groupe
        Set<Long> done = new HashSet<>();
        progress.findAllForUser(user.getId()).forEach(p -> done.add(p.getLesson().getId()));
        Map<Long, Optional<String>> lockByCourse = new HashMap<>();
        List<ProgressItem> ordered = items.stream()
                .sorted(Comparator.comparing((ProgressItem it) -> lessons.findById(it.lessonId()).map(Lesson::getPosition).orElse(0)))
                .toList();
        for (ProgressItem item : ordered) {
            Optional<Lesson> lesson = lessons.findById(item.lessonId());
            if (lesson.isEmpty()) {
                rejected.add(new RejectedItem(item.lessonId(), "Leçon inconnue"));
                continue;
            }
            Lesson l = lesson.get();
            Course course = l.getCourse();
            if (!policy.canAccess(user, course) || !enrollments.isEnrolled(user, course)) {
                rejected.add(new RejectedItem(l.getId(), "Cours non accessible ou inscription absente"));
                continue;
            }
            if (!done.contains(l.getId())) {
                // controles serveur : la progression n'est jamais simplement declaree par le client
                Optional<String> lock = lockByCourse.computeIfAbsent(course.getId(), k -> enrollments.lockReason(user, course));
                if (lock.isPresent()) {
                    rejected.add(new RejectedItem(l.getId(), lock.get()));
                    continue;
                }
                boolean previousDone = course.getLessons().stream()
                        .filter(x -> x.getPosition() < l.getPosition()).allMatch(x -> done.contains(x.getId()));
                if (!previousDone) {
                    rejected.add(new RejectedItem(l.getId(), "Les leçons précédentes ne sont pas terminées"));
                    continue;
                }
                List<QuizQuestion> checks = course.getQuestions().stream()
                        .filter(q -> q.getLesson() != null && q.getLesson().getId().equals(l.getId())).toList();
                if (!checks.isEmpty() && !checkPassed(checks, item.checkAnswers(), course.getPassScore())) {
                    rejected.add(new RejectedItem(l.getId(), "Quiz de la leçon non réussi"));
                    continue;
                }
            }
            Instant completedAt = item.completedAt().isAfter(Instant.now()) ? Instant.now() : item.completedAt();
            LessonProgress p = progress.findByUserIdAndLessonId(user.getId(), item.lessonId()).orElseGet(() -> {
                LessonProgress np = new LessonProgress();
                np.setUser(user);
                np.setLesson(l);
                np.setCompletedAt(completedAt);
                return np;
            });
            if (p.getCompletedAt() == null || completedAt.isBefore(p.getCompletedAt())) {
                p.setCompletedAt(completedAt);
            }
            p.setTimeSpentSeconds(Math.max(p.getTimeSpentSeconds(), item.timeSpentSeconds()));
            p.setCompletedOffline(p.isCompletedOffline() || item.offline());
            p.setSyncedAt(Instant.now());
            progress.save(p);
            done.add(l.getId());
            touched.add(course);
            accepted++;
        }
        List<CertificateDto> issued = new ArrayList<>();
        for (Course c : touched) {
            issued.addAll(certification.evaluate(user, c));
        }
        if (!touched.isEmpty()) programs.evaluatePrograms(user);
        if (accepted > 0) {
            activity.save(new ActivityEvent(user.getId(), ActivityEvent.Type.SYNC, accepted));
        }
        touch(user);
        return new SyncResponse(accepted, serverProgress(user), issued, rejected);
    }

    /** Le quiz de la lecon est re-corrige par le serveur (le client ne fait que l'afficher). */
    static boolean checkPassed(List<QuizQuestion> checks, List<Integer> answers, int passScore) {
        if (answers == null || answers.size() != checks.size()) return false;
        int good = 0;
        for (int i = 0; i < checks.size(); i++) {
            Integer a = answers.get(i);
            if (a != null && a == checks.get(i).getCorrectIndex()) good++;
        }
        return Math.round(good * 100f / checks.size()) >= passScore;
    }

    @Transactional(readOnly = true)
    public List<ProgressItem> serverProgress(AppUser user) {
        return progress.findAllForUser(user.getId()).stream()
                .map(p -> new ProgressItem(p.getLesson().getId(), p.getCompletedAt(), p.getTimeSpentSeconds(), p.isCompletedOffline(), null))
                .toList();
    }

    public QuizResult submitQuiz(AppUser user, Long courseId, List<Integer> answers) {
        Course c = enrolledCourse(user, courseId);
        List<QuizQuestion> qs = c.examQuestions();
        if (qs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce cours n'a pas d'évaluation");
        }
        if (progress.countByUserIdAndLessonCourseId(user.getId(), c.getId()) < c.getLessons().size()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Terminez toutes les leçons avant l'évaluation finale");
        }
        if (answers.size() != qs.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre de reponses incorrect");
        }
        int good = 0;
        List<QuestionCorrection> corrections = new ArrayList<>();
        for (int i = 0; i < qs.size(); i++) {
            Integer a = answers.get(i);
            QuizQuestion q = qs.get(i);
            boolean ok = a != null && a == q.getCorrectIndex();
            if (ok) good++;
            corrections.add(new QuestionCorrection(q.getId(), q.getCorrectIndex(), ok, q.getExplanation()));
        }
        int score = Math.round(good * 100f / qs.size());

        QuizAttempt attempt = new QuizAttempt();
        attempt.setUser(user);
        attempt.setCourse(c);
        attempt.setScorePercent(score);
        attempt.setPassed(score >= c.getPassScore());
        attempt.setAnswers(answers.stream().map(a -> a == null ? "" : String.valueOf(a)).collect(Collectors.joining(",")));
        attempts.save(attempt);

        boolean allDone = progress.countByUserIdAndLessonCourseId(user.getId(), c.getId()) >= c.getLessons().size();
        List<CertificateDto> issued = certification.evaluate(user, c);
        programs.evaluatePrograms(user);
        touch(user);
        return new QuizResult(score, score >= c.getPassScore(), score >= c.getMasteryScore(), allDone, corrections, issued);
    }

    @Transactional(readOnly = true)
    public List<CertificateDto> myCertificates(AppUser user) {
        return certificates.findAllForUser(user.getId()).stream()
                .map(CertificationService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public CertificateDto verify(String code) {
        String k = code.trim().toUpperCase();
        return certificates.findByCode(k).map(CertificationService::toDto)
                .or(() -> programCerts.findByCode(k).map(pc -> new CertificateDto(pc.getCode(), null,
                        pc.getRank() == null ? "Certificat de parcours" : "Certificat de parcours · Lauréat·e (" + pc.getRank()
                                + (pc.getRank() == 1 ? "er" : "e") + " sur " + pc.getClassSize() + ")",
                        null, pc.getProgram().getTitle(), pc.getUser().getFullName(), 0, pc.getIssuedAt(),
                        pc.getRevokedAt(), pc.getRevokedReason())))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificat introuvable"));
    }

    public void saveFeedback(AppUser user, Long courseId, FeedbackInput in) {
        Course c = accessibleCourse(user, courseId);
        CourseFeedback f = feedbacks.findByUserIdAndCourseId(user.getId(), c.getId()).orElseGet(() -> {
            CourseFeedback nf = new CourseFeedback();
            nf.setUser(user);
            nf.setCourse(c);
            return nf;
        });
        f.setRating(in.rating());
        f.setClarity(in.clarity());
        f.setUsefulness(in.usefulness());
        f.setComment(in.comment() == null ? null : in.comment().trim());
        f.setCreatedAt(Instant.now());
        feedbacks.save(f);
    }

    @Transactional(readOnly = true)
    public Optional<FeedbackInput> myFeedback(AppUser user, Long courseId) {
        return feedbacks.findByUserIdAndCourseId(user.getId(), courseId)
                .map(f -> new FeedbackInput(f.getRating(), f.getClarity(), f.getUsefulness(), f.getComment()));
    }

    public Course accessibleCourse(AppUser user, Long courseId) {
        Course c = courses.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module introuvable"));
        if (!policy.canAccess(user, c)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Module non accessible");
        }
        return c;
    }

    private void touch(AppUser user) {
        user.setLastActiveAt(Instant.now());
        users.save(user);
    }
}
