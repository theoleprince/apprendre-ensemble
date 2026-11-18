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
    private final Set<String> licenceCodes;

    public EnrollmentService(CourseRepository courses, ProgramRepository programs, DomainRepository domains,
                             EnrollmentRepository enrollments, LessonProgressRepository progress, QuizAttemptRepository attempts,
                             CertificateRepository certificates, AccessPolicy policy, ClassroomLocks locks,
                             ProgramService programService, @Value("${app.licence-codes:GDP-2027}") String licenceCodes) {
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
        this.licenceCodes = Arrays.stream(licenceCodes.split(",")).map(String::trim).map(String::toUpperCase)
                .filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }

    // =====================================================================
    // Catalogue public (sans compte)
    // =====================================================================

    @Transactional(readOnly = true)
    public Catalog catalog(AppUser viewer) {
        List<CatalogCourse> cs = courses.findAllByOrderByIdAsc().stream()
                .filter(c -> listed(viewer, c)).map(this::card).toList();
        List<CatalogProgram> ps = programs.findAllByOrderByIdAsc().stream()
                .filter(p -> p.isPublished() && p.getCourses().stream().allMatch(c -> listed(viewer, c)))
                .map(this::card).toList();
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
        return new CourseDetail(card(c), syllabus, c.getPassScore(), c.getMasteryScore(), c.isExpertiseEnabled(), in);
    }

    @Transactional(readOnly = true)
    public ProgramPublicDetail programDetail(AppUser viewer, Long id) {
        Program p = programs.findById(id).filter(Program::isPublished)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable"));
        return new ProgramPublicDetail(card(p), p.getCourses().stream().map(this::card).toList());
    }

    private CatalogCourse card(Course c) {
        return new CatalogCourse(c.getId(), c.getTitle(), c.getDescription(), c.getIcon(),
                c.getDomain() == null ? null : c.getDomain().getId(), c.getDomain() == null ? null : c.getDomain().getName(),
                c.getType(), c.getLessons().size(), minutes(c), c.getQuestions().size(), c.getPrice(), c.getTargetRoles(),
                c.getLessons().stream().anyMatch(l -> l.getMediaType() == MediaType.VIDEO),
                c.getLessons().stream().anyMatch(l -> l.getMediaType() == MediaType.AUDIO),
                enrollments.countByCourseId(c.getId()));
    }

    private CatalogProgram card(Program p) {
        return new CatalogProgram(p.getId(), p.getTitle(), p.getDescription(), p.getIcon(), p.getDurationLabel(),
                p.getCourses().size(), p.getCourses().stream().mapToInt(EnrollmentService::minutes).sum(), p.getPrice(),
                p.getTargetRoles(), p.getRequiredLevel(),
                p.getCourses().stream().map(Course::getDomain).filter(Objects::nonNull).map(Domain::getName).distinct().toList());
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
            String ref = pay(p.getPrice(), req);
            int amount = p.getPrice() == 0 || req.method() == Enrollment.Method.CODE ? 0 : p.getPrice();
            Enrollment e = new Enrollment();
            e.setUser(u);
            e.setProgram(p);
            e.setMethod(p.getPrice() == 0 ? Enrollment.Method.GRATUIT : req.method());
            e.setAmount(amount);
            e.setPaymentRef(ref);
            enrollments.save(e);
            for (Course c : p.getCourses()) enrollCourse(u, c, p, Enrollment.Method.FORMATION, 0, ref);
            return new EnrollResult(null, p.getId(), amount, ref, "Inscription confirmée : " + p.getTitle());
        }
        Course c = courses.findById(req.courseId()).filter(x -> policy.canAccess(u, x))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cours introuvable"));
        if (enrollments.existsByUserIdAndCourseId(u.getId(), c.getId())) {
            return new EnrollResult(c.getId(), null, 0, null, "Vous êtes déjà inscrit·e à ce cours");
        }
        String ref = pay(c.getPrice(), req);
        int amount = c.getPrice() == 0 || req.method() == Enrollment.Method.CODE ? 0 : c.getPrice();
        enrollCourse(u, c, null, c.getPrice() == 0 ? Enrollment.Method.GRATUIT : req.method(), amount, ref);
        return new EnrollResult(c.getId(), null, amount, ref, "Inscription confirmée : " + c.getTitle());
    }

    /**
     * Paiement : en demonstration il est simule (reference SIM-...). En production : agregateur Mobile Money / carte
     * (ex. FedaPay, Kkiapay, Stripe) avec confirmation par webhook avant l'inscription.
     */
    private String pay(int price, EnrollRequest req) {
        if (price == 0) return null;
        return switch (req.method()) {
            case GRATUIT, FORMATION -> throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Ce contenu est payant");
            case CODE -> {
                String code = req.code() == null ? "" : req.code().trim().toUpperCase();
                if (!licenceCodes.contains(code)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code de licence invalide");
                }
                yield "LIC-" + code;
            }
            case MOBILE_MONEY -> {
                String phone = req.phone() == null ? "" : req.phone().replaceAll("\\s", "");
                if (!phone.matches("\\+?[0-9]{8,13}")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Numéro Mobile Money invalide");
                }
                yield "SIM-MM-" + programService.code(8);
            }
            case CARTE -> "SIM-CB-" + programService.code(8);
        };
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
        return certificates.findAllForUser(u.getId()).stream()
                .anyMatch(x -> x.getCourse().getId().equals(c.getId()) && x.getLevel().ordinal() >= required.ordinal());
    }

    @Transactional(readOnly = true)
    public MyLearning myLearning(AppUser u) {
        List<Enrollment> mine = enrollments.findAllForUser(u.getId());
        Map<Long, Long> done = progress.findAllForUser(u.getId()).stream()
                .collect(Collectors.groupingBy(p -> p.getLesson().getCourse().getId(), Collectors.counting()));
        Map<Long, Integer> best = new HashMap<>();
        for (QuizAttempt a : attempts.findByUserId(u.getId())) best.merge(a.getCourse().getId(), a.getScorePercent(), Math::max);
        Map<Long, List<CertificateLevel>> levels = certificates.findAllForUser(u.getId()).stream()
                .collect(Collectors.groupingBy(x -> x.getCourse().getId(), Collectors.mapping(Certificate::getLevel, Collectors.toList())));

        List<MyCourse> cs = new ArrayList<>();
        for (Enrollment e : mine) {
            if (e.getCourse() == null) continue;
            Course c = e.getCourse();
            int b = best.getOrDefault(c.getId(), -1);
            cs.add(new MyCourse(c.getId(), c.getTitle(), c.getIcon(), c.getDomain() == null ? null : c.getDomain().getName(),
                    c.getLessons().size(), done.getOrDefault(c.getId(), 0L).intValue(), c.getQuestions().size(), b,
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
