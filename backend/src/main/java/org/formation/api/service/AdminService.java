package org.formation.api.service;

import jakarta.persistence.EntityManager;
import org.formation.api.domain.*;
import org.formation.api.repository.AppUserRepository;
import org.formation.api.repository.CourseRepository;
import org.formation.api.repository.DomainRepository;
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
public class AdminService {

    private static final Set<Role> STAFF = EnumSet.of(Role.ADMIN, Role.FORMATEUR);

    private final CourseRepository courses;
    private final AppUserRepository users;
    private final DomainRepository domains;
    private final EntityManager em;

    public AdminService(CourseRepository courses, AppUserRepository users, DomainRepository domains, EntityManager em) {
        this.courses = courses;
        this.users = users;
        this.domains = domains;
        this.em = em;
    }

    // ---------- Modules ----------

    @Transactional(readOnly = true)
    public List<AdminCourse> listCourses() {
        return courses.findAllByOrderByIdAsc().stream().map(this::toAdmin).toList();
    }

    @Transactional(readOnly = true)
    public CourseInput getCourse(Long id) {
        Course c = find(id);
        return new CourseInput(c.getTitle(), c.getDescription(), c.getIcon(), c.getType(), c.getCountryCode(),
                c.getLanguageCode(), c.getTargetRoles(), c.getAllowedCohorts(), c.getAllowedRegions(),
                c.getPassScore(), c.getMasteryScore(), c.isExpertiseEnabled(), c.isPublished(),
                c.getLessons().stream().map(l -> new LessonInput(l.getTitle(), l.getMediaType(), l.getMediaUrl(),
                        l.getMediaSizeBytes(), l.getSubtitlesUrl(), l.getContent(), l.getPracticeTask(),
                        l.getDurationMinutes())).toList(),
                c.getQuestions().stream().map(q -> new QuestionInput(q.getQuestion(), List.copyOf(q.getOptions()),
                        q.getCorrectIndex(), q.getExplanation())).toList(),
                c.getDomain() == null ? null : c.getDomain().getId());
    }

    public AdminCourse create(CourseInput in) {
        Course c = new Course();
        apply(c, in);
        return toAdmin(courses.save(c));
    }

    /** Chaque modification produit une nouvelle version : les appareils hors ligne retelechargent le module. */
    public AdminCourse update(Long id, CourseInput in) {
        Course c = find(id);
        apply(c, in);
        c.setContentVersion(c.getContentVersion() + 1);
        return toAdmin(courses.save(c));
    }

    /** Un module deja suivi n'est pas supprime (donnees d'evaluation) : il faut le depublier. */
    public void delete(Long id) {
        Course c = find(id);
        long used = em.createQuery("select count(p) from LessonProgress p where p.lesson.course.id = :id", Long.class)
                .setParameter("id", id).getSingleResult()
                + em.createQuery("select count(a) from QuizAttempt a where a.course.id = :id", Long.class)
                .setParameter("id", id).getSingleResult();
        if (used > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Module deja suivi par des apprenants : depubliez-le au lieu de le supprimer");
        }
        courses.delete(c);
    }

    private Course find(Long id) {
        return courses.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Module introuvable"));
    }

    /** Lecons et questions mises a jour en place (par position) : la progression deja synchronisee reste valide. */
    private void apply(Course c, CourseInput in) {
        for (QuestionInput q : in.questions()) {
            if (q.correctIndex() >= q.options().size()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Index de bonne reponse invalide : " + q.question());
            }
        }
        if (in.masteryScore() < in.passScore()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le score de maitrise doit etre >= au score du badge");
        }
        c.setTitle(in.title().trim());
        c.setDescription(in.description());
        c.setIcon(blankToNull(in.icon()));
        c.setType(in.type());
        c.setCountryCode(blankToNull(in.countryCode()));
        c.setLanguageCode(blankToNull(in.languageCode()));
        c.getTargetRoles().clear();
        c.getTargetRoles().addAll(in.targetRoles());
        c.getAllowedCohorts().clear();
        if (in.allowedCohorts() != null) c.getAllowedCohorts().addAll(clean(in.allowedCohorts()));
        c.getAllowedRegions().clear();
        if (in.allowedRegions() != null) c.getAllowedRegions().addAll(clean(in.allowedRegions()));
        c.setPassScore(in.passScore());
        c.setMasteryScore(in.masteryScore());
        c.setExpertiseEnabled(in.expertiseEnabled());
        c.setPublished(in.published());
        c.setDomain(in.domainId() == null ? null : domains.findById(in.domainId()).orElse(null));
        c.setUpdatedAt(Instant.now());

        List<Lesson> ls = c.getLessons();
        while (ls.size() > in.lessons().size()) ls.removeLast();
        for (int i = 0; i < in.lessons().size(); i++) {
            LessonInput li = in.lessons().get(i);
            Lesson l;
            if (i < ls.size()) {
                l = ls.get(i);
            } else {
                l = new Lesson();
                l.setCourse(c);
                ls.add(l);
            }
            l.setPosition(i + 1);
            l.setTitle(li.title().trim());
            l.setMediaType(li.mediaType() == null ? MediaType.TEXT : li.mediaType());
            l.setMediaUrl(blankToNull(li.mediaUrl()));
            l.setMediaSizeBytes(Math.max(0, li.mediaSizeBytes()));
            l.setSubtitlesUrl(blankToNull(li.subtitlesUrl()));
            l.setContent(li.content());
            l.setPracticeTask(blankToNull(li.practiceTask()));
            l.setDurationMinutes(li.durationMinutes());
        }

        List<QuizQuestion> qs = c.getQuestions();
        while (qs.size() > in.questions().size()) qs.removeLast();
        for (int i = 0; i < in.questions().size(); i++) {
            QuestionInput qi = in.questions().get(i);
            QuizQuestion q;
            if (i < qs.size()) {
                q = qs.get(i);
            } else {
                q = new QuizQuestion();
                q.setCourse(c);
                qs.add(q);
            }
            q.setQuestion(qi.question().trim());
            q.getOptions().clear();
            q.getOptions().addAll(qi.options());
            q.setCorrectIndex(qi.correctIndex());
            q.setExplanation(blankToNull(qi.explanation()));
        }
    }

    private static Set<String> clean(Set<String> s) {
        return s.stream().filter(Objects::nonNull).map(String::trim).filter(x -> !x.isEmpty()).collect(Collectors.toSet());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private AdminCourse toAdmin(Course c) {
        return new AdminCourse(c.getId(), c.getTitle(), c.getIcon(), c.getType(), c.getCountryCode(), c.getLanguageCode(),
                c.getTargetRoles(), c.getAllowedCohorts(), c.isPublished(), c.getLessons().size(), c.getQuestions().size(),
                c.getContentVersion(), c.getDomain() == null ? null : c.getDomain().getName());
    }

    // ---------- Apprenants et groupes RCT ----------

    @Transactional(readOnly = true)
    public List<LearnerRow> learners() {
        return users.findByRoleNotIn(STAFF).stream()
                .sorted(Comparator.comparing(AppUser::getId))
                .map(u -> new LearnerRow(u.getId(), u.getFullName(), u.getRole(), u.getCountryCode(), u.getRegion(),
                        u.getCohort(), u.getLastActiveAt()))
                .toList();
    }

    public int assign(CohortAssign in) {
        String cohort = blankToNull(in.cohort());
        List<AppUser> list = users.findAllById(in.userIds()).stream().filter(u -> !STAFF.contains(u.getRole())).toList();
        list.forEach(u -> u.setCohort(cohort));
        users.saveAll(list);
        return list.size();
    }

    /**
     * Tirage aleatoire stratifie par zone geographique : dans chaque zone, les apprenants sont melanges
     * puis repartis a tour de role entre les groupes (effectifs equilibres a une unite pres).
     * Une graine (seed) rend le tirage reproductible et auditable.
     */
    public RandomizeResult randomize(RandomizeRequest in) {
        List<String> groups = in.groups().stream().map(String::trim).toList();
        Random rnd = in.seed() == null ? new Random() : new Random(in.seed());
        Map<String, List<AppUser>> byRegion = users.findByRoleNotIn(STAFF).stream()
                .filter(u -> in.role() == null || u.getRole() == in.role())
                .filter(u -> in.countryCode() == null || in.countryCode().isBlank() || in.countryCode().equals(u.getCountryCode()))
                .filter(u -> !in.onlyUnassigned() || u.getCohort() == null)
                .sorted(Comparator.comparing(AppUser::getId))
                .collect(Collectors.groupingBy(u -> Objects.requireNonNullElse(u.getRegion(), "-"), TreeMap::new, Collectors.toList()));
        Map<String, Map<String, Long>> summary = new TreeMap<>();
        int assigned = 0;
        int offset = 0;
        for (Map.Entry<String, List<AppUser>> e : byRegion.entrySet()) {
            List<AppUser> list = new ArrayList<>(e.getValue());
            Collections.shuffle(list, rnd);
            Map<String, Long> counts = new TreeMap<>();
            for (int i = 0; i < list.size(); i++) {
                String g = groups.get((i + offset) % groups.size());
                list.get(i).setCohort(g);
                counts.merge(g, 1L, Long::sum);
                assigned++;
            }
            offset += list.size(); // alterne le groupe qui recoit l'unite en plus d'une zone a l'autre
            users.saveAll(list);
            summary.put(e.getKey(), counts);
        }
        return new RandomizeResult(assigned, summary);
    }
}
