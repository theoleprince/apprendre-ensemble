package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Programmes (parcours), classes (sessions), points et classement, certificats de programme,
 * suivi des equipes (direction d'ecole, conseiller·ere pedagogique).
 */
@Service
@Transactional
public class ProgramService {

    private static final Set<Role> STAFF = EnumSet.of(Role.ADMIN, Role.FORMATEUR);
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final ProgramRepository programs;
    private final ClassroomRepository classrooms;
    private final ProgramCertificateRepository programCerts;
    private final CertificateRepository certificates;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final PortfolioItemRepository portfolios;
    private final ForumPostRepository posts;
    private final AppUserRepository users;
    private final AccessPolicy policy;
    private final SecureRandom random = new SecureRandom();

    public ProgramService(ProgramRepository programs, ClassroomRepository classrooms, ProgramCertificateRepository programCerts,
                          CertificateRepository certificates, LessonProgressRepository progress, QuizAttemptRepository attempts,
                          PortfolioItemRepository portfolios, ForumPostRepository posts, AppUserRepository users,
                          AccessPolicy policy) {
        this.programs = programs;
        this.classrooms = classrooms;
        this.programCerts = programCerts;
        this.certificates = certificates;
        this.progress = progress;
        this.attempts = attempts;
        this.portfolios = portfolios;
        this.posts = posts;
        this.users = users;
        this.policy = policy;
    }

    // =====================================================================
    // Vue apprenant
    // =====================================================================

    /** Etat d'avancement d'un apprenant : lecons terminees et niveaux obtenus par module. */
    record UserState(Map<Long, Long> lessonsDone, Map<Long, Set<CertificateLevel>> levels) {
        static UserState of(List<LessonProgress> prog, List<Certificate> certs) {
            return new UserState(
                    prog.stream().collect(Collectors.groupingBy(p -> p.getLesson().getCourse().getId(), Collectors.counting())),
                    certs.stream().collect(Collectors.groupingBy(c -> c.getCourse().getId(),
                            Collectors.mapping(Certificate::getLevel, Collectors.toSet()))));
        }

        boolean moduleDone(Course c, CertificateLevel required) {
            Set<CertificateLevel> l = levels.getOrDefault(c.getId(), Set.of());
            return l.stream().anyMatch(x -> x.ordinal() >= required.ordinal());
        }
    }

    private UserState state(AppUser u) {
        return UserState.of(progress.findAllForUser(u.getId()), certificates.findAllForUser(u.getId()));
    }

    private boolean visible(AppUser u, Program p) {
        if (policy.isStaff(u)) return true;
        return p.isPublished() && p.getTargetRoles().contains(u.getRole())
                && (p.getCountryCode() == null || p.getCountryCode().equals(u.getCountryCode()));
    }

    @Transactional(readOnly = true)
    public List<ProgramSummary> myPrograms(AppUser u) {
        UserState st = state(u);
        List<Classroom> mine = classrooms.findForMember(u.getId());
        return programs.findAllByOrderByIdAsc().stream()
                .filter(p -> visible(u, p) || mine.stream().anyMatch(c -> c.getProgram().getId().equals(p.getId())))
                .map(p -> {
                    int done = (int) p.getCourses().stream().filter(c -> st.moduleDone(c, p.getRequiredLevel())).count();
                    Long next = p.getCourses().stream().filter(c -> !st.moduleDone(c, p.getRequiredLevel()))
                            .map(Course::getId).findFirst().orElse(null);
                    Classroom cl = classroomFor(u, p, mine);
                    return new ProgramSummary(p.getId(), p.getTitle(), p.getDescription(), p.getIcon(), p.getDurationLabel(),
                            p.getCourses().size(), done, pct(done, p.getCourses().size()), next,
                            cl == null ? null : brief(cl, u), programCerts.findByUserIdAndProgramId(u.getId(), p.getId())
                            .map(this::certDto).orElse(null));
                })
                // les programmes ou l'apprenant est inscrit en classe d'abord
                .sorted(Comparator.comparing((ProgramSummary s) -> s.classroom() == null).thenComparing(ProgramSummary::id))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProgramDetail program(AppUser u, Long id) {
        Program p = programs.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Programme introuvable"));
        List<Classroom> mine = classrooms.findForMember(u.getId());
        Classroom cl = classroomFor(u, p, mine);
        if (!visible(u, p) && cl == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Programme non accessible");
        UserState st = state(u);
        LocalDate today = LocalDate.now();
        List<ProgramModule> modules = new ArrayList<>();
        boolean classOpen = cl != null && !"CLOSED".equals(ClassroomLocks.status(cl, today));
        for (int i = 0; i < p.getCourses().size(); i++) {
            Course c = p.getCourses().get(i);
            LocalDate unlock = classOpen ? ClassroomLocks.unlockDate(cl, i) : null;
            int doneLessons = st.lessonsDone().getOrDefault(c.getId(), 0L).intValue();
            String state = st.moduleDone(c, p.getRequiredLevel()) ? "DONE"
                    : unlock != null && unlock.isAfter(today) ? "LOCKED"
                    : doneLessons > 0 ? "IN_PROGRESS" : "TODO";
            modules.add(new ProgramModule(c.getId(), c.getTitle(), c.getIcon(), c.getDomain() == null ? null : c.getDomain().getName(),
                    c.getType(), c.getLessons().size(), c.getLessons().stream().mapToInt(Lesson::getDurationMinutes).sum(),
                    doneLessons, st.levels().getOrDefault(c.getId(), Set.of()).stream().sorted().toList(), state, unlock));
        }
        List<String> domains = p.getCourses().stream().map(Course::getDomain).filter(Objects::nonNull)
                .map(Domain::getName).distinct().toList();
        return new ProgramDetail(p.getId(), p.getTitle(), p.getDescription(), p.getIcon(), p.getDurationLabel(), p.getRequiredLevel(),
                modules, domains, cl == null ? null : brief(cl, u),
                programCerts.findByUserIdAndProgramId(u.getId(), p.getId()).map(this::certDto).orElse(null));
    }

    /** Classe de l'apprenant pour ce programme : en cours, sinon a venir, sinon la plus recente. */
    private Classroom classroomFor(AppUser u, Program p, List<Classroom> mine) {
        LocalDate today = LocalDate.now();
        List<Classroom> forP = mine.stream().filter(c -> c.getProgram().getId().equals(p.getId())).toList();
        return forP.stream().filter(c -> "ACTIVE".equals(ClassroomLocks.status(c, today))).findFirst()
                .or(() -> forP.stream().filter(c -> "UPCOMING".equals(ClassroomLocks.status(c, today))).findFirst())
                .orElse(forP.isEmpty() ? null : forP.getFirst());
    }

    @Transactional(readOnly = true)
    public List<ClassroomBrief> myClassrooms(AppUser u) {
        return classrooms.findForMember(u.getId()).stream().map(c -> brief(c, u)).toList();
    }

    public ClassroomBrief join(AppUser u, String code) {
        Classroom c = classrooms.findByInviteCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Code de classe inconnu"));
        if ("CLOSED".equals(ClassroomLocks.status(c, LocalDate.now()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette classe est terminée");
        }
        if (!c.getProgram().getTargetRoles().contains(u.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette classe ne correspond pas à votre profil");
        }
        c.getMembers().add(u);
        classrooms.save(c);
        return brief(c, u);
    }

    // =====================================================================
    // Classement
    // =====================================================================

    record Score(AppUser user, int lessons, int quizPoints, int portfolios, int posts, int points, boolean completed) {
    }

    private List<Score> scores(Classroom c) {
        Set<Long> courseIds = c.getProgram().getCourses().stream().map(Course::getId).collect(Collectors.toSet());
        LocalDate today = LocalDate.now();
        Instant from = c.getStartDate().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant until = (today.isAfter(c.getEndDate()) || c.isClosed() ? c.getEndDate() : today)
                .plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<Score> out = new ArrayList<>();
        for (AppUser m : c.getMembers()) {
            if (STAFF.contains(m.getRole())) continue;
            int lessons = (int) progress.findAllForUser(m.getId()).stream()
                    .filter(p -> courseIds.contains(p.getLesson().getCourse().getId()))
                    .filter(p -> p.getCompletedAt() != null && p.getCompletedAt().isBefore(until)).count();
            Map<Long, Integer> best = new HashMap<>();
            for (Long cid : courseIds) {
                attempts.findTopByUserIdAndCourseIdOrderByScorePercentDesc(m.getId(), cid)
                        .filter(a -> a.getAttemptedAt().isBefore(until))
                        .ifPresent(a -> best.put(cid, a.getScorePercent()));
            }
            int quiz = best.values().stream().mapToInt(Integer::intValue).sum();
            int pf = (int) portfolios.countByUserIdAndStatusAndCourseIdIn(m.getId(), PortfolioItem.Status.VALIDE, courseIds);
            int pst = (int) posts.countByAuthorIdAndCreatedAtBetween(m.getId(), from, until);
            int pts = lessons * c.getPointsPerLesson() + quiz * c.getPointsPerQuizPercent()
                    + pf * c.getPointsPerPortfolio() + pst * c.getPointsPerPost();
            out.add(new Score(m, lessons, quiz * c.getPointsPerQuizPercent(), pf, pst, pts, programComplete(m, c.getProgram())));
        }
        out.sort(Comparator.comparingInt(Score::points).reversed().thenComparing(Comparator.comparingInt(Score::lessons).reversed())
                .thenComparing(s -> s.user().getFullName()));
        return out;
    }

    private boolean programComplete(AppUser u, Program p) {
        UserState st = state(u);
        return !p.getCourses().isEmpty() && p.getCourses().stream().allMatch(c -> st.moduleDone(c, p.getRequiredLevel()));
    }

    @Transactional
    public Leaderboard leaderboard(AppUser viewer, Long classroomId) {
        Classroom c = classrooms.findById(classroomId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        autoClose(c);
        boolean privileged = policy.isStaff(viewer) || (c.getFacilitator() != null && c.getFacilitator().getId().equals(viewer.getId()));
        boolean member = c.getMembers().stream().anyMatch(m -> m.getId().equals(viewer.getId()));
        if (!privileged && !member) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        Classroom.LeaderboardMode mode = privileged ? Classroom.LeaderboardMode.PUBLIC : c.getLeaderboardMode();
        List<Score> sc = scores(c);
        List<LeaderRow> rows = new ArrayList<>();
        LeaderRow mine = null;
        for (int i = 0; i < sc.size(); i++) {
            Score s = sc.get(i);
            boolean me = s.user().getId().equals(viewer.getId());
            String name = mode == Classroom.LeaderboardMode.PUBLIC || me ? s.user().getFullName() : "Participant·e " + (i + 1);
            LeaderRow r = new LeaderRow(i + 1, name, s.points(), s.lessons(), s.quizPoints(), s.portfolios(), s.posts(), me, s.completed());
            if (me) mine = r;
            if (mode != Classroom.LeaderboardMode.DISABLED) rows.add(r);
        }
        if (mode == Classroom.LeaderboardMode.ANONYMOUS) {
            // anonyme : seul le top 3 (sans nom) et sa propre ligne sont montres
            rows = rows.stream().filter(r -> r.rank() <= 3 || r.me()).toList();
        }
        if (mode == Classroom.LeaderboardMode.DISABLED && mine != null) {
            mine = new LeaderRow(0, mine.name(), mine.points(), mine.lessons(), mine.quizPoints(), mine.portfolios(), mine.posts(), true, mine.completed());
        }
        return new Leaderboard(brief(c, viewer), mode.name(), rows, mine);
    }

    private Optional<int[]> rankOf(Classroom c, AppUser u) {
        if (c.getLeaderboardMode() == Classroom.LeaderboardMode.DISABLED) return Optional.empty();
        List<Score> sc = scores(c);
        for (int i = 0; i < sc.size(); i++) {
            if (sc.get(i).user().getId().equals(u.getId())) return Optional.of(new int[]{i + 1, sc.get(i).points()});
        }
        return Optional.empty();
    }

    // =====================================================================
    // Cloture et certificats de programme
    // =====================================================================

    /** Classe terminee (date de fin depassee) : cloture automatique. */
    public void autoClose(Classroom c) {
        if (!c.isClosed() && LocalDate.now().isAfter(c.getEndDate())) close(c);
    }

    public void autoCloseAll() {
        classrooms.findAll().forEach(this::autoClose);
    }

    /** Fige le classement et delivre les certificats de programme (mention laureat·e pour le podium). */
    public void close(Classroom c) {
        List<Score> sc = scores(c);
        for (int i = 0; i < sc.size(); i++) {
            Score s = sc.get(i);
            if (!s.completed()) continue;
            ProgramCertificate pc = programCerts.findByUserIdAndProgramId(s.user().getId(), c.getProgram().getId())
                    .orElseGet(() -> newCert(s.user(), c.getProgram()));
            pc.setClassroom(c);
            pc.setClassSize(sc.size());
            pc.setPoints(s.points());
            boolean podium = c.getLeaderboardMode() != Classroom.LeaderboardMode.DISABLED && i < 3;
            pc.setRank(podium ? i + 1 : null);
            programCerts.save(pc);
        }
        c.setClosed(true);
        classrooms.save(c);
    }

    /** Appele apres chaque progression : delivre le certificat de programme des que tous les modules sont valides. */
    public void evaluatePrograms(AppUser u) {
        for (Program p : programs.findAllByOrderByIdAsc()) {
            if (programCerts.findByUserIdAndProgramId(u.getId(), p.getId()).isPresent()) continue;
            if ((visible(u, p) || isMemberOf(u, p)) && programComplete(u, p)) programCerts.save(newCert(u, p));
        }
    }

    private boolean isMemberOf(AppUser u, Program p) {
        return classrooms.findForMember(u.getId()).stream().anyMatch(c -> c.getProgram().getId().equals(p.getId()));
    }

    private ProgramCertificate newCert(AppUser u, Program p) {
        ProgramCertificate pc = new ProgramCertificate();
        pc.setUser(u);
        pc.setProgram(p);
        pc.setCode("P" + code(9));
        return pc;
    }

    public String code(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i == 4) sb.append('-');
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public List<ProgramCertDto> myProgramCertificates(AppUser u) {
        return programCerts.findAllForUser(u.getId()).stream().map(this::certDto).toList();
    }

    ProgramCertDto certDto(ProgramCertificate c) {
        return new ProgramCertDto(c.getCode(), c.getProgram().getTitle(), c.getUser().getFullName(), c.getRank(), c.getClassSize(),
                c.getPoints(), c.getIssuedAt(), c.getClassroom() == null ? null : c.getClassroom().getName());
    }

    // =====================================================================
    // Suivi : direction d'ecole, conseiller·ere
    // =====================================================================

    @Transactional(readOnly = true)
    public SchoolDashboard schoolDashboard(AppUser director) {
        School s = director.getSchool();
        if (s == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun établissement rattaché à votre compte");
        List<AppUser> staff = users.findBySchoolId(s.getId()).stream()
                .filter(u -> !u.getId().equals(director.getId()) && !STAFF.contains(u.getRole())).toList();
        List<LearnerProgress> rows = staff.stream().map(this::learnerProgress)
                .sorted(Comparator.comparing(LearnerProgress::status).reversed().thenComparing(LearnerProgress::name)).toList();
        Set<Long> ids = staff.stream().map(AppUser::getId).collect(Collectors.toSet());
        List<ClassroomBrief> cls = classrooms.findAllByOrderByStartDateDesc().stream()
                .filter(c -> c.getMembers().stream().anyMatch(m -> ids.contains(m.getId())))
                .map(c -> brief(c, director)).toList();
        return new SchoolDashboard(new SchoolDto(s.getId(), s.getName(), s.getCountryCode(), s.getRegion(), s.getCommune(), staff.size()),
                staff.size(), (int) rows.stream().filter(r -> "ACTIF".equals(r.status())).count(),
                (int) Math.round(rows.stream().mapToInt(LearnerProgress::programPercent).average().orElse(0)),
                (int) rows.stream().filter(r -> "DECROCHE".equals(r.status())).count(), rows, cls);
    }

    @Transactional(readOnly = true)
    public MentorDashboard mentorDashboard(AppUser mentor) {
        if (!policy.isMentor(mentor)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        LocalDate today = LocalDate.now();
        List<Classroom> mine = policy.isStaff(mentor)
                ? classrooms.findAllByOrderByStartDateDesc().stream().filter(c -> !"CLOSED".equals(ClassroomLocks.status(c, today))).toList()
                : classrooms.findForFacilitator(mentor.getId());
        Map<Long, AppUser> learners = new LinkedHashMap<>();
        for (Classroom c : mine) for (AppUser m : c.getMembers()) if (!STAFF.contains(m.getRole())) learners.putIfAbsent(m.getId(), m);
        List<LearnerProgress> rows = learners.values().stream().map(this::learnerProgress)
                .sorted(Comparator.comparingInt((LearnerProgress r) -> switch (r.status()) {
                    case "DECROCHE" -> 0;
                    case "RALENTI" -> 1;
                    default -> 2;
                }).thenComparing(LearnerProgress::name)).toList();
        long pending = portfolios.findByStatusForReview(PortfolioItem.Status.SOUMIS).stream()
                .filter(p -> policy.isStaff(mentor) || Objects.equals(p.getUser().getRegion(), mentor.getRegion())).count();
        return new MentorDashboard(mine.stream().map(c -> brief(c, mentor)).toList(), rows, pending,
                (int) rows.stream().filter(r -> "DECROCHE".equals(r.status())).count());
    }

    private LearnerProgress learnerProgress(AppUser u) {
        UserState st = state(u);
        List<Classroom> mine = classrooms.findForMember(u.getId());
        Program main = mine.isEmpty()
                ? programs.findAllByOrderByIdAsc().stream().filter(p -> p.getTargetRoles().contains(u.getRole())).findFirst().orElse(null)
                : mine.getFirst().getProgram();
        int percent = 0;
        if (main != null && !main.getCourses().isEmpty()) {
            long done = main.getCourses().stream().filter(c -> st.moduleDone(c, main.getRequiredLevel())).count();
            long lessonsTotal = main.getCourses().stream().mapToLong(c -> c.getLessons().size()).sum();
            long lessonsDone = main.getCourses().stream().mapToLong(c -> Math.min(c.getLessons().size(), st.lessonsDone().getOrDefault(c.getId(), 0L))).sum();
            percent = done == main.getCourses().size() ? 100 : lessonsTotal == 0 ? 0 : (int) Math.round(lessonsDone * 100.0 / lessonsTotal);
        }
        Instant last = u.getLastActiveAt();
        long idle = last == null ? 999 : Duration.between(last, Instant.now()).toDays();
        String status = idle > 14 ? "DECROCHE" : idle >= 7 ? "RALENTI" : "ACTIF";
        Classroom cl = mine.isEmpty() ? null : mine.getFirst();
        Integer rank = cl == null ? null : rankOf(cl, u).map(r -> r[0]).orElse(null);
        return new LearnerProgress(u.getId(), u.getFullName(), u.getRole(), u.getSchool() == null ? null : u.getSchool().getName(),
                u.getRegion(), percent, st.lessonsDone().values().stream().mapToInt(Long::intValue).sum(),
                st.levels().values().stream().mapToInt(Set::size).sum(), last, status, cl == null ? null : cl.getName(), rank);
    }

    // =====================================================================
    // Outils
    // =====================================================================

    public ClassroomBrief brief(Classroom c, AppUser viewer) {
        LocalDate today = LocalDate.now();
        Optional<int[]> r = c.getMembers().stream().anyMatch(m -> m.getId().equals(viewer.getId())) ? rankOf(c, viewer) : Optional.empty();
        boolean privileged = policy.isStaff(viewer) || (c.getFacilitator() != null && c.getFacilitator().getId().equals(viewer.getId()));
        return new ClassroomBrief(c.getId(), c.getName(), c.getProgram().getId(), c.getProgram().getTitle(), c.getStartDate(),
                c.getEndDate(), ClassroomLocks.status(c, today), ClassroomLocks.week(c, today), ClassroomLocks.totalWeeks(c),
                c.getFacilitator() == null ? null : c.getFacilitator().getFullName(),
                (int) c.getMembers().stream().filter(m -> !STAFF.contains(m.getRole())).count(),
                r.map(x -> x[0]).orElse(null), r.map(x -> x[1]).orElse(null), c.getLeaderboardMode().name(), c.getMeetingUrl(),
                privileged ? c.getInviteCode() : null);
    }

    private static int pct(long a, long b) {
        return b == 0 ? 0 : (int) Math.round(a * 100.0 / b);
    }
}
