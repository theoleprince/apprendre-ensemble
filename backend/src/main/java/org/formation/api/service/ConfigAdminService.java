package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.*;

/**
 * Parametrage sans developpement : domaines de competences, programmes, etablissements, classes
 * (dates, animateur, calendrier, bareme de points, classement, membres) et ressources.
 */
@Service
@Transactional
public class ConfigAdminService {

    private static final Set<Role> STAFF = EnumSet.of(Role.ADMIN, Role.FORMATEUR);

    private final DomainRepository domains;
    private final ProgramRepository programs;
    private final SchoolRepository schools;
    private final ClassroomRepository classrooms;
    private final ResourceRepository resources;
    private final CourseRepository courses;
    private final AppUserRepository users;
    private final ProgramService programService;
    private final EnrollmentService enrollments;

    public ConfigAdminService(DomainRepository domains, ProgramRepository programs, SchoolRepository schools,
                              ClassroomRepository classrooms, ResourceRepository resources, CourseRepository courses,
                              AppUserRepository users, ProgramService programService,
                              EnrollmentService enrollments) {
        this.domains = domains;
        this.programs = programs;
        this.schools = schools;
        this.classrooms = classrooms;
        this.resources = resources;
        this.courses = courses;
        this.users = users;
        this.programService = programService;
        this.enrollments = enrollments;
    }

    private static <T> T found(Optional<T> o) {
        return o.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    // ---------- Domaines ----------
    @Transactional(readOnly = true)
    public List<DomainDto> domains() {
        return domains.findAllByOrderByPositionAsc().stream()
                .map(d -> new DomainDto(d.getId(), d.getName(), d.getDescription(), d.getIcon(), d.getPosition())).toList();
    }

    public DomainDto saveDomain(Long id, DomainInput in) {
        Domain d = id == null ? new Domain() : found(domains.findById(id));
        d.setName(in.name().trim());
        d.setDescription(in.description());
        d.setIcon(blank(in.icon()));
        d.setPosition(in.position());
        domains.save(d);
        return new DomainDto(d.getId(), d.getName(), d.getDescription(), d.getIcon(), d.getPosition());
    }

    public void deleteDomain(Long id) {
        Domain d = found(domains.findById(id));
        courses.findAll().stream().filter(c -> c.getDomain() != null && c.getDomain().getId().equals(id)).forEach(c -> c.setDomain(null));
        resources.findAll().stream().filter(r -> r.getDomain() != null && r.getDomain().getId().equals(id)).forEach(r -> r.setDomain(null));
        domains.delete(d);
    }

    // ---------- Programmes ----------
    @Transactional(readOnly = true)
    public List<ProgramAdmin> programs() {
        return programs.findAllByOrderByIdAsc().stream().map(this::toAdmin).toList();
    }

    @Transactional(readOnly = true)
    public ProgramAdmin program(Long id) {
        return toAdmin(found(programs.findById(id)));
    }

    public ProgramAdmin saveProgram(Long id, ProgramInput in) {
        Program p = id == null ? new Program() : found(programs.findById(id));
        p.setTitle(in.title().trim());
        p.setDescription(in.description());
        p.setIcon(blank(in.icon()));
        p.setDurationLabel(blank(in.durationLabel()));
        p.setCountryCode(blank(in.countryCode()));
        p.getTargetRoles().clear();
        p.getTargetRoles().addAll(in.targetRoles());
        p.getCourses().clear();
        for (Long cid : in.courseIds()) p.getCourses().add(found(courses.findById(cid)));
        p.setRequiredLevel(in.requiredLevel());
        p.setPublished(in.published());
        p.setPrice(Math.max(0, in.price()));
        return toAdmin(programs.save(p));
    }

    public void deleteProgram(Long id) {
        if (classrooms.findAll().stream().anyMatch(c -> c.getProgram().getId().equals(id))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Programme utilisé par une classe : dépubliez-le plutôt");
        }
        programs.deleteById(id);
    }

    private ProgramAdmin toAdmin(Program p) {
        long n = classrooms.findAll().stream().filter(c -> c.getProgram().getId().equals(p.getId())).count();
        return new ProgramAdmin(p.getId(), p.getTitle(), p.getDescription(), p.getIcon(), p.getDurationLabel(), p.getCountryCode(),
                p.getTargetRoles(), p.getCourses().stream().map(Course::getId).toList(),
                p.getCourses().stream().map(Course::getTitle).toList(), p.getRequiredLevel(), p.isPublished(), n, p.getPrice());
    }

    // ---------- Etablissements ----------
    @Transactional(readOnly = true)
    public List<SchoolDto> schools() {
        Map<Long, Long> counts = new HashMap<>();
        users.findAll().forEach(u -> { if (u.getSchool() != null) counts.merge(u.getSchool().getId(), 1L, Long::sum); });
        return schools.findAllByOrderByNameAsc().stream()
                .map(s -> new SchoolDto(s.getId(), s.getName(), s.getCountryCode(), s.getRegion(), s.getCommune(), counts.getOrDefault(s.getId(), 0L)))
                .toList();
    }

    public SchoolDto saveSchool(Long id, SchoolInput in) {
        School s = id == null ? new School() : found(schools.findById(id));
        s.setName(in.name().trim());
        s.setCountryCode(blank(in.countryCode()));
        s.setRegion(blank(in.region()));
        s.setCommune(blank(in.commune()));
        schools.save(s);
        return new SchoolDto(s.getId(), s.getName(), s.getCountryCode(), s.getRegion(), s.getCommune(), 0);
    }

    // ---------- Classes ----------
    @Transactional(readOnly = true)
    public List<ClassroomAdmin> classrooms() {
        return classrooms.findAllByOrderByStartDateDesc().stream().map(this::toAdmin).toList();
    }

    @Transactional(readOnly = true)
    public ClassroomAdmin classroom(Long id) {
        return toAdmin(found(classrooms.findById(id)));
    }

    public ClassroomAdmin saveClassroom(Long id, ClassroomInput in) {
        if (in.endDate().isBefore(in.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La date de fin doit suivre la date de début");
        }
        Classroom c = id == null ? new Classroom() : found(classrooms.findById(id));
        c.setName(in.name().trim());
        c.setProgram(found(programs.findById(in.programId())));
        c.setFacilitator(in.facilitatorId() == null ? null : found(users.findById(in.facilitatorId())));
        c.setStartDate(in.startDate());
        c.setEndDate(in.endDate());
        c.setUnlockMode(in.unlockMode());
        c.setUnlockIntervalDays(in.unlockIntervalDays());
        c.setLeaderboardMode(in.leaderboardMode());
        c.setPointsPerLesson(in.pointsPerLesson());
        c.setPointsPerQuizPercent(in.pointsPerQuizPercent());
        c.setPointsPerPortfolio(in.pointsPerPortfolio());
        c.setPointsPerPost(in.pointsPerPost());
        c.setMeetingUrl(blank(in.meetingUrl()));
        if (c.getInviteCode() == null) c.setInviteCode(programService.code(6).replace("-", ""));
        // reouverture si la date de fin est repoussee
        if (c.isClosed() && !LocalDate.now().isAfter(c.getEndDate())) c.setClosed(false);
        return toAdmin(classrooms.save(c));
    }

    /** Ajoute une liste explicite, ou tous les apprenants correspondant aux filtres (public, zone, ecole, groupe RCT). */
    public ClassroomAdmin addMembers(Long id, MembersRequest in) {
        Classroom c = found(classrooms.findById(id));
        List<AppUser> add;
        if (in.userIds() != null && !in.userIds().isEmpty()) {
            add = users.findAllById(in.userIds());
        } else {
            add = users.findByRoleNotIn(STAFF).stream()
                    .filter(u -> c.getProgram().getTargetRoles().contains(u.getRole()))
                    .filter(u -> in.role() == null || u.getRole() == in.role())
                    .filter(u -> blank(in.region()) == null || in.region().equals(u.getRegion()))
                    .filter(u -> in.schoolId() == null || (u.getSchool() != null && u.getSchool().getId().equals(in.schoolId())))
                    .filter(u -> blank(in.cohort()) == null || in.cohort().equals(u.getCohort()))
                    .toList();
        }
        // membre d'une classe = inscrit a la formation (prise en charge par le programme)
        add.stream().filter(u -> !STAFF.contains(u.getRole())).forEach(u -> {
            c.getMembers().add(u);
            enrollments.enrollFree(u, c.getProgram());
        });
        return toAdmin(classrooms.save(c));
    }

    public ClassroomAdmin removeMember(Long id, Long userId) {
        Classroom c = found(classrooms.findById(id));
        c.getMembers().removeIf(u -> u.getId().equals(userId));
        return toAdmin(classrooms.save(c));
    }

    public ClassroomAdmin close(Long id) {
        Classroom c = found(classrooms.findById(id));
        programService.close(c);
        return toAdmin(c);
    }

    private ClassroomAdmin toAdmin(Classroom c) {
        return new ClassroomAdmin(c.getId(), c.getName(), c.getProgram().getId(), c.getProgram().getTitle(),
                c.getFacilitator() == null ? null : c.getFacilitator().getId(),
                c.getFacilitator() == null ? null : c.getFacilitator().getFullName(), c.getStartDate(), c.getEndDate(),
                c.getUnlockMode(), c.getUnlockIntervalDays(), c.getLeaderboardMode(), c.getPointsPerLesson(),
                c.getPointsPerQuizPercent(), c.getPointsPerPortfolio(), c.getPointsPerPost(), c.getMeetingUrl(), c.getInviteCode(),
                ClassroomLocks.status(c, LocalDate.now()), c.isClosed(),
                c.getMembers().stream().map(AppUser::getId).sorted().toList());
    }

    // ---------- Ressources ----------
    @Transactional(readOnly = true)
    public List<ResourceDto> resources() {
        return resources.findAllByOrderByIdAsc().stream().map(ConfigAdminService::toDto).toList();
    }

    public ResourceDto saveResource(Long id, ResourceInput in) {
        Resource r = id == null ? new Resource() : found(resources.findById(id));
        r.setTitle(in.title().trim());
        r.setSummary(in.summary());
        r.setIcon(blank(in.icon()));
        r.setContent(in.content());
        r.setFileUrl(blank(in.fileUrl()));
        r.setDomain(in.domainId() == null ? null : domains.findById(in.domainId()).orElse(null));
        r.getTargetRoles().clear();
        if (in.targetRoles() != null) r.getTargetRoles().addAll(in.targetRoles());
        return toDto(resources.save(r));
    }

    public void deleteResource(Long id) {
        resources.deleteById(id);
    }

    static ResourceDto toDto(Resource r) {
        return new ResourceDto(r.getId(), r.getTitle(), r.getSummary(), r.getIcon(), r.getContent(), r.getFileUrl(),
                r.getDomain() == null ? null : r.getDomain().getId(), r.getDomain() == null ? null : r.getDomain().getName(),
                r.getTargetRoles());
    }

    /** Ressources visibles par un apprenant (vide = tous les publics). */
    @Transactional(readOnly = true)
    public List<ResourceDto> resourcesFor(AppUser u) {
        return resources.findAllByOrderByIdAsc().stream()
                .filter(r -> r.getTargetRoles().isEmpty() || r.getTargetRoles().contains(u.getRole()) || STAFF.contains(u.getRole()))
                .map(ConfigAdminService::toDto).toList();
    }

    // ---------- Utilisateurs (choix de l'animateur, des membres) ----------
    @Transactional(readOnly = true)
    public List<UserBrief> users(Role role) {
        return users.findAll().stream()
                .filter(u -> role == null || u.getRole() == role)
                .sorted(Comparator.comparing(AppUser::getFullName))
                .map(u -> new UserBrief(u.getId(), u.getFullName(), u.getRole(), u.getRegion(),
                        u.getSchool() == null ? null : u.getSchool().getName(), u.getCohort()))
                .toList();
    }
}
