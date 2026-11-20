package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Catalogue public, inscriptions (gratuites, payantes ou par code de licence) et regles de progression :
 * on suit un cours lecon apres lecon, l'evaluation finale ouvre quand toutes les lecons sont terminees,
 * et dans une formation chaque cours ouvre quand le precedent est valide.
 */
@Service
@Transactional
public class EnrollmentService {

    private final CourseRepository courses;
    private final ProgramRepository programs;
    private final DomainRepository domains;
    private final EnrollmentRepository enrollments;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CertificateRepository certificates;
    private final AccessPolicy policy;
    private final ClassroomLocks locks;
    private final ProgramService programService;
    private final LicenceCodeRepository licences;
    private final SubscriptionRepository subscriptions;
    private final CourseFeedbackRepository feedbacks;
    private final AppUserRepository users;

    public EnrollmentService(CourseRepository courses, ProgramRepository programs, DomainRepository domains,
                             EnrollmentRepository enrollments, LessonProgressRepository progress, QuizAttemptRepository attempts,
                             CertificateRepository certificates, AccessPolicy policy, ClassroomLocks locks,
                             ProgramService programService, LicenceCodeRepository licences, SubscriptionRepository subscriptions,
                             CourseFeedbackRepository feedbacks, AppUserRepository users) {
        this.feedbacks = feedbacks;
        this.users = users;
        this.courses = courses;
        this.programs = programs;
        this.domains = domains;
        this.enrollments = enrollments;
        this.progress = progress;
        this.attempts = attempts;
        this.certificates = certificates;
        this.policy = policy;
        this.locks = locks;
        this.programService = programService;
        this.licences = licences;
        this.subscriptions = subscriptions;
    }

    // =====================================================================
    // Catalogue public (sans compte)
    // =====================================================================

    @Transactional(readOnly = true)
    public Catalog catalog(AppUser viewer) {
        Map<Long, double[]> stats = ratingStats();
        List<CatalogCourse> cs = courses.findAllByOrderByIdAsc().stream()
                .filter(c -> listed(viewer, c)).map(c -> card(c, stats)).toList();
        List<CatalogProgram> ps = programs.findAllByOrderByIdAsc().stream()
                .filter(p -> p.isPublished() && p.getCourses().stream().allMatch(c -> listed(viewer, c)))
                .map(p -> card(p, stats)).toList();
        List<DomainDto> ds = domains.findAllByOrderByPositionAsc().stream()
                .map(d -> new DomainDto(d.getId(), d.getName(), d.getDescription(), d.getIcon(), d.getPosition())).toList();
        return new Catalog(ps, cs, ds);
    }

    /** Visible au catalogue : publie, et pour un visiteur anonyme, sans restriction de zone ou de groupe d'evaluation. */
    private boolean listed(AppUser viewer, Course c) {
        if (viewer != null) return policy.canAccess(viewer, c);
        return c.isPublished() && c.getAllowedCohorts().isEmpty() && c.getAllowedRegions().isEmpty();
    }

    @Transactional(readOnly = true)
    public CourseDetail courseDetail(AppUser viewer, Long id) {
        Course c = courses.findById(id).filter(x -> listed(viewer, x))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        Map<Long, Long> checks = c.getQuestions().stream().filter(q -> q.getLesson() != null)
                .collect(Collectors.groupingBy(q -> q.getLesson().getId(), Collectors.counting()));
        List<SyllabusItem> syllabus = c.getLessons().stream()
                .map(l -> new SyllabusItem(l.getId(), l.getPosition(), l.getTitle(), l.getMediaType(), l.getDurationMinutes(),
                        checks.getOrDefault(l.getId(), 0L).intValue(), l.getPracticeTask() != null))
                .toList();
        List<ProgramRef> in = programs.findAllByOrderByIdAsc().stream()
                .filter(p -> p.isPublished() && p.getCourses().contains(c))
                .map(p -> new ProgramRef(p.getId(), p.getTitle())).toList();
        Map<Long, double[]> stats = ratingStats();
        Preview preview = c.getLessons().stream()
                .filter(l -> l.getMediaType() == MediaType.VIDEO && l.getMediaUrl() != null).findFirst()
                .map(l -> new Preview(l.getTitle(), l.getMediaUrl(), l.getSubtitlesUrl())).orElse(null);
        List<CatalogCourse> related = courses.findAllByOrderByIdAsc().stream()
                .filter(x -> !x.getId().equals(c.getId()) && listed(viewer, x))
                .sorted(Comparator.comparing((Course x) -> !Objects.equals(x.getDomain(), c.getDomain()))
                        .thenComparing(x -> -enrollments.countByCourseId(x.getId())))
                .limit(3).map(x -> card(x, stats)).toList();
        return new CourseDetail(card(c, stats), syllabus, c.getPassScore(), c.getMasteryScore(), c.isExpertiseEnabled(), in,
                Presentations.of(c), reviews(List.of(c.getId()), false), preview, related);
    }

    @Transactional(readOnly = true)
    public ProgramPublicDetail programDetail(AppUser viewer, Long id) {
        Program p = programs.findById(id).filter(Program::isPublished)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable"));
        Map<Long, double[]> stats = ratingStats();
        return new ProgramPublicDetail(card(p, stats), p.getCourses().stream().map(c -> card(c, stats)).toList(),
                Presentations.of(p), reviews(p.getCourses().stream().map(Course::getId).toList(), true));
    }

    /** Chiffres reels de la plateforme et temoignages (avis 4-5 etoiles commentes) pour la page d'accueil. */
    @Transactional(readOnly = true)
    public PublicStats publicStats() {
        long published = courses.findAllByOrderByIdAsc().stream().filter(Course::isPublished).count();
        double sum = 0;
        long n = 0;
        for (double[] s : ratingStats().values()) {
            sum += s[0] * s[1];
            n += (long) s[1];
        }
        List<ReviewDto> testimonials = feedbacks.testimonials(org.springframework.data.domain.PageRequest.of(0, 40)).stream()
                .filter(f -> f.getComment().length() >= 20)
                .collect(Collectors.toMap(CourseFeedback::getComment, f -> f, (a, b) -> a, LinkedHashMap::new))
                .values().stream().limit(6).map(this::review).toList();
        return new PublicStats(enrollments.countLearners(), certificates.countByRevokedAtIsNull(), published,
                users.countCountries(), n == 0 ? 0 : Math.round(sum / n * 10) / 10.0, n, testimonials);
    }

    /** [courseId] -> [moyenne, nombre d'avis]. */
    private Map<Long, double[]> ratingStats() {
        Map<Long, double[]> m = new HashMap<>();
        for (Object[] r : feedbacks.ratingStats()) {
            m.put((Long) r[0], new double[]{((Number) r[1]).doubleValue(), ((Number) r[2]).doubleValue()});
        }
        return m;
    }

    private Reviews reviews(List<Long> courseIds, boolean withCourse) {
        if (courseIds.isEmpty()) return new Reviews(0, 0, new long[5], List.of());
        List<CourseFeedback> all = feedbacks.forCourses(courseIds);
        long[] hist = new long[5];
        double sum = 0;
        for (CourseFeedback f : all) {
            int r = Math.max(1, Math.min(5, f.getRating()));
            hist[r - 1]++;
            sum += r;
        }
        List<ReviewDto> latest = all.stream().filter(f -> f.getComment() != null && !f.getComment().isBlank())
                .limit(6).map(f -> withCourse ? review(f) : new ReviewDto(shortName(f.getUser().getFullName()), f.getRating(),
                        f.getComment(), f.getCreatedAt(), null)).toList();
        return new Reviews(all.isEmpty() ? 0 : Math.round(sum / all.size() * 10) / 10.0, all.size(), hist, latest);
    }

    private ReviewDto review(CourseFeedback f) {
        return new ReviewDto(shortName(f.getUser().getFullName()), f.getRating(), f.getComment(), f.getCreatedAt(), f.getCourse().getTitle());
    }

    /** "Adjoa Mensah" devient "Adjoa M." : le nom complet d'un apprenant n'est jamais publie. */
    static String shortName(String full) {
        if (full == null || full.isBlank()) return "Apprenant·e";
        String[] w = full.trim().split("\\s+");
        return w.length == 1 ? w[0] : w[0] + " " + w[w.length - 1].charAt(0) + ".";
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> mediaManifest() {
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Course c : courses.findAllByOrderByIdAsc()) {
            if (!c.isPublished()) continue;
            for (Lesson l : c.getLessons()) {
                for (String u : new String[]{l.getMediaUrl(), l.getSubtitlesUrl()}) {
                    if (u != null && u.startsWith("/api/media/") && seen.add(u)) {
                        out.add(Map.of("url", u, "courseId", c.getId(), "sizeBytes", u.equals(l.getMediaUrl()) ? l.getMediaSizeBytes() : 0L));
                    }
                }
            }
        }
        return out;
    }

    private CatalogCourse card(Course c, Map<Long, double[]> stats) {
        double[] r = stats.getOrDefault(c.getId(), new double[]{0, 0});
        return new CatalogCourse(c.getId(), c.getTitle(), c.getDescription(), c.getIcon(),
                c.getDomain() == null ? null : c.getDomain().getId(), c.getDomain() == null ? null : c.getDomain().getName(),
                c.getType(), c.getLessons().size(), minutes(c), c.examQuestions().size(), c.getPrice(), c.getTargetRoles(),
                c.getLessons().stream().anyMatch(l -> l.getMediaType() == MediaType.VIDEO),
                c.getLessons().stream().anyMatch(l -> l.getMediaType() == MediaType.AUDIO),
                enrollments.countByCourseId(c.getId()), c.getLevel(), c.getLanguageCode(),
                Math.round(r[0] * 10) / 10.0, (long) r[1], c.getUpdatedAt());
    }

    private CatalogProgram card(Program p, Map<Long, double[]> stats) {
        double sum = 0;
        long n = 0;
        for (Course c : p.getCourses()) {
            double[] r = stats.get(c.getId());
            if (r != null) {
                sum += r[0] * r[1];
                n += (long) r[1];
            }
        }
        return new CatalogProgram(p.getId(), p.getTitle(), p.getDescription(), p.getIcon(), p.getDurationLabel(),
                p.getCourses().size(), p.getCourses().stream().mapToInt(EnrollmentService::minutes).sum(), p.getPrice(),
                p.getTargetRoles(), p.getRequiredLevel(),
                p.getCourses().stream().map(Course::getDomain).filter(Objects::nonNull).map(Domain::getName).distinct().toList(),
                p.getLevel(), enrollments.countByProgramIdAndCourseIsNull(p.getId()), n == 0 ? 0 : Math.round(sum / n * 10) / 10.0, n);
    }

    private static int minutes(Course c) {
        return c.getLessons().stream().mapToInt(Lesson::getDurationMinutes).sum();
    }

    // =====================================================================
    // Inscription
    // =====================================================================

    public EnrollResult enroll(AppUser u, EnrollRequest req) {
        if ((req.courseId() == null) == (req.programId() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez un cours ou une formation");
        }
        if (req.programId() != null) {
            Program p = programs.findById(req.programId()).filter(Program::isPublished)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable"));
            for (Course c : p.getCourses()) {
                if (!policy.canAccess(u, c)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Formation non accessible pour votre profil");
                }
            }
            if (enrollments.findByUserIdAndProgramIdAndCourseIsNull(u.getId(), p.getId()).isPresent()) {
                return new EnrollResult(null, p.getId(), 0, null, "Vous êtes déjà inscrit·e à cette formation");
            }
            String ref = entitle(u, p.getPrice(), req, p.getId());
            grantProgram(u, p, p.getPrice() == 0 ? Enrollment.Method.GRATUIT : req.method(), 0, ref);
            return new EnrollResult(null, p.getId(), 0, ref, "Inscription confirmée : " + p.getTitle());
        }
        Course c = courses.findById(req.courseId()).filter(x -> policy.canAccess(u, x))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        if (enrollments.existsByUserIdAndCourseId(u.getId(), c.getId())) {
            return new EnrollResult(c.getId(), null, 0, null, "Vous êtes déjà inscrit·e à ce cours");
        }
        Long scope = programs.findAllByOrderByIdAsc().stream().filter(p -> p.getCourses().contains(c)).map(Program::getId).findFirst().orElse(null);
        String ref = entitle(u, c.getPrice(), req, scope);
        grantCourse(u, c, c.getPrice() == 0 ? Enrollment.Method.GRATUIT : req.method(), 0, ref);
        return new EnrollResult(c.getId(), null, 0, ref, "Inscription confirmée : " + c.getTitle());
    }

    /** Droits accordes apres paiement confirme (PaymentService) ou inscription directe. */
    public void grantCourse(AppUser u, Course c, Enrollment.Method m, int amount, String ref) {
        enrollCourse(u, c, null, m, amount, ref);
    }

    public void grantProgram(AppUser u, Program p, Enrollment.Method m, int amount, String ref) {
        if (enrollments.findByUserIdAndProgramIdAndCourseIsNull(u.getId(), p.getId()).isEmpty()) {
            Enrollment e = new Enrollment();
            e.setUser(u);
            e.setProgram(p);
            e.setMethod(m);
            e.setAmount(amount);
            e.setPaymentRef(ref);
            enrollments.save(e);
        }
        for (Course c : p.getCourses()) enrollCourse(u, c, p, Enrollment.Method.FORMATION, 0, ref);
    }

    /** Abonnement en cours de validite. */
    @Transactional(readOnly = true)
    public boolean hasActiveSubscription(AppUser u) {
        return subscriptions.findByUserIdOrderByEndsAtDesc(u.getId()).stream().anyMatch(Subscription::isActive);
    }

    /**
     * Droit d'acceder a un contenu payant sans paiement en ligne : licence institutionnelle ou abonnement actif.
     * Le paiement Mobile Money / carte passe par PaymentService (FedaPay), confirme cote serveur.
     */
    private String entitle(AppUser u, int price, EnrollRequest req, Long programScope) {
        if (price == 0) return null;
        return switch (req.method()) {
            case CODE -> useLicence(req.code(), programScope);
            case ABONNEMENT -> {
                if (!hasActiveSubscription(u)) throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Aucun abonnement actif");
                yield "ABONNEMENT";
            }
            case MOBILE_MONEY, CARTE -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Paiement en ligne : passez par la page de paiement sécurisée");
            default -> throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Ce contenu est payant");
        };
    }

    /** Licence institutionnelle : active, non expiree, places disponibles, perimetre respecte. Une place est consommee. */
    private String useLicence(String raw, Long programScope) {
        String code = raw == null ? "" : raw.trim();
        LicenceCode l = licences.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code de licence invalide"));
        if (!l.isActive() || (l.getValidUntil() != null && l.getValidUntil().isBefore(java.time.LocalDate.now()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code de licence expiré ou désactivé");
        }
        if (l.getSeats() > 0 && l.getUsed() >= l.getSeats()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plus aucune place disponible sur cette licence");
        }
        if (l.getProgramId() != null && !l.getProgramId().equals(programScope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce code ne couvre pas ce contenu");
        }
        l.setUsed(l.getUsed() + 1);
        licences.save(l);
        return "LIC-" + l.getCode().toUpperCase();
    }

    private void enrollCourse(AppUser u, Course c, Program via, Enrollment.Method m, int amount, String ref) {
        Enrollment e = enrollments.findByUserIdAndCourseId(u.getId(), c.getId()).orElse(null);
        if (e != null) {
            if (via != null && e.getProgram() == null) {
                e.setProgram(via);
                enrollments.save(e);
            }
            return;
        }
        e = new Enrollment();
        e.setUser(u);
        e.setCourse(c);
        e.setProgram(via);
        e.setMethod(m);
        e.setAmount(amount);
        e.setPaymentRef(ref);
        enrollments.save(e);
    }

    /** Inscription prise en charge (membre d'une classe, jeu de demonstration). */
    public void enrollFree(AppUser u, Program p) {
        if (enrollments.findByUserIdAndProgramIdAndCourseIsNull(u.getId(), p.getId()).isEmpty()) {
            Enrollment e = new Enrollment();
            e.setUser(u);
            e.setProgram(p);
            e.setMethod(Enrollment.Method.CODE);
            e.setPaymentRef("CLASSE");
            enrollments.save(e);
        }
        for (Course c : p.getCourses()) enrollCourse(u, c, p, Enrollment.Method.FORMATION, 0, "CLASSE");
    }

    public void enrollFree(AppUser u, Course c) {
        enrollCourse(u, c, null, Enrollment.Method.GRATUIT, 0, null);
    }

    @Transactional(readOnly = true)
    public boolean isEnrolled(AppUser u, Course c) {
        return policy.isStaff(u) || enrollments.existsByUserIdAndCourseId(u.getId(), c.getId());
    }

    // =====================================================================
    // Progression
    // =====================================================================

    /**
     * Raison pour laquelle un cours n'est pas encore ouvert, ou vide :
     * calendrier de la classe, ou cours precedent de la formation non valide.
     */
    @Transactional(readOnly = true)
    public Optional<String> lockReason(AppUser u, Course c) {
        if (policy.isStaff(u)) return Optional.empty();
        Optional<java.time.LocalDate> until = locks.lockedUntil(u, c);
        if (until.isPresent()) {
            return Optional.of("Ce cours ouvrira le " + until.get().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) + " pour votre classe");
        }
        Enrollment e = enrollments.findByUserIdAndCourseId(u.getId(), c.getId()).orElse(null);
        if (e == null || e.getProgram() == null) return Optional.empty();
        Program p = e.getProgram();
        int i = p.getCourses().indexOf(c);
        if (i <= 0) return Optional.empty();
        Course prev = p.getCourses().get(i - 1);
        if (!validated(u, prev, p.getRequiredLevel())) {
            return Optional.of("Validez d'abord le cours « " + prev.getTitle() + " »");
        }
        return Optional.empty();
    }

    private boolean validated(AppUser u, Course c, CertificateLevel required) {
        return certificates.findValidForUser(u.getId()).stream()
                .anyMatch(x -> x.getCourse().getId().equals(c.getId()) && x.getLevel().ordinal() >= required.ordinal());
    }

    @Transactional(readOnly = true)
    public MyLearning myLearning(AppUser u) {
        List<Enrollment> mine = enrollments.findAllForUser(u.getId());
        Map<Long, Long> done = progress.findAllForUser(u.getId()).stream()
                .collect(Collectors.groupingBy(p -> p.getLesson().getCourse().getId(), Collectors.counting()));
        Map<Long, Integer> best = new HashMap<>();
        for (QuizAttempt a : attempts.findByUserId(u.getId())) best.merge(a.getCourse().getId(), a.getScorePercent(), Math::max);
        Map<Long, List<CertificateLevel>> levels = certificates.findValidForUser(u.getId()).stream()
                .collect(Collectors.groupingBy(x -> x.getCourse().getId(), Collectors.mapping(Certificate::getLevel, Collectors.toList())));

        List<MyCourse> cs = new ArrayList<>();
        for (Enrollment e : mine) {
            if (e.getCourse() == null) continue;
            Course c = e.getCourse();
            int b = best.getOrDefault(c.getId(), -1);
            cs.add(new MyCourse(c.getId(), c.getTitle(), c.getIcon(), c.getDomain() == null ? null : c.getDomain().getName(),
                    c.getLessons().size(), done.getOrDefault(c.getId(), 0L).intValue(), c.examQuestions().size(), b,
                    b >= c.getPassScore(), c.getPassScore(), levels.getOrDefault(c.getId(), List.of()).stream().sorted().toList(),
                    e.getProgram() == null ? null : e.getProgram().getId(), e.getProgram() == null ? null : e.getProgram().getTitle(),
                    lockReason(u, c).orElse(null), e.getEnrolledAt(), c.getContentVersion(), minutes(c)));
        }
        List<MyProgram> ps = new ArrayList<>();
        for (Enrollment e : mine) {
            if (e.getCourse() != null || e.getProgram() == null) continue;
            Program p = e.getProgram();
            int ok = (int) p.getCourses().stream().filter(c -> levels.getOrDefault(c.getId(), List.of()).stream()
                    .anyMatch(l -> l.ordinal() >= p.getRequiredLevel().ordinal())).count();
            ps.add(new MyProgram(p.getId(), p.getTitle(), p.getIcon(), p.getDurationLabel(),
                    p.getCourses().stream().map(Course::getId).toList(), ok,
                    p.getCourses().isEmpty() ? 0 : Math.round(ok * 100f / p.getCourses().size()), p.getRequiredLevel(),
                    programService.programCertificate(u, p).orElse(null), programService.classroomBriefFor(u, p)));
        }
        return new MyLearning(ps, cs);
    }
}
