package org.formation.api.service;

import jakarta.persistence.EntityManager;
import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

/**
 * Cycle de vie des comptes : creation et modification par l'administration, desactivation,
 * deconnexion globale, effacement (droit a l'effacement RGPD art. 17 / nLPD art. 32) et export des donnees personnelles.
 */
@Service
@Transactional
public class AccountService {

    private static final Set<Role> STAFF = EnumSet.of(Role.ADMIN, Role.FORMATEUR);

    private final AppUserRepository users;
    private final SchoolRepository schools;
    private final MediaFileRepository mediaFiles;
    private final MediaStorage storage;
    private final PasswordResetTokenRepository resetTokens;
    private final PasswordResetService resets;
    private final PasswordEncoder encoder;
    private final EntityManager em;
    private final SecureRandom random = new SecureRandom();

    public AccountService(AppUserRepository users, SchoolRepository schools, MediaFileRepository mediaFiles, MediaStorage storage,
                          PasswordResetTokenRepository resetTokens, PasswordResetService resets, PasswordEncoder encoder,
                          EntityManager em) {
        this.users = users;
        this.schools = schools;
        this.mediaFiles = mediaFiles;
        this.storage = storage;
        this.resetTokens = resetTokens;
        this.resets = resets;
        this.encoder = encoder;
        this.em = em;
    }

    // =====================================================================
    // Administration
    // =====================================================================

    @Transactional(readOnly = true)
    public UserPage list(String q, Role role, Boolean enabled, int page, int size) {
        int s = Math.min(Math.max(size, 1), 200);
        int p = Math.max(page, 0);
        String like = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase() + "%";
        String where = " where u.deletedAt is null"
                + (like != null ? " and (lower(u.fullName) like :q or lower(u.email) like :q)" : "")
                + (role != null ? " and u.role = :role" : "")
                + (enabled != null ? " and u.enabled = :enabled" : "");
        var count = em.createQuery("select count(u) from AppUser u" + where, Long.class);
        var query = em.createQuery("select u from AppUser u left join fetch u.school" + where + " order by u.fullName", AppUser.class);
        if (like != null) { count.setParameter("q", like); query.setParameter("q", like); }
        if (role != null) { count.setParameter("role", role); query.setParameter("role", role); }
        if (enabled != null) { count.setParameter("enabled", enabled); query.setParameter("enabled", enabled); }
        List<AdminUser> items = query.setFirstResult(p * s).setMaxResults(s).getResultList().stream().map(AccountService::toAdmin).toList();
        return new UserPage(items, count.getSingleResult(), p, s);
    }

    public AdminUser create(AppUser actor, AdminUserInput in) {
        requireCanManage(actor, in.role());
        String email = in.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un compte existe déjà avec cet email");
        }
        AppUser u = new AppUser();
        u.setEmail(email);
        u.setDataConsent(true);
        apply(u, in);
        // sans mot de passe fourni : mot de passe aleatoire inconnu, a definir via le lien de reinitialisation
        String pwd = in.password() == null || in.password().isBlank() ? randomSecret() : in.password();
        if (pwd.length() < 8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mot de passe : 8 caractères minimum");
        u.setPasswordHash(encoder.encode(pwd));
        return toAdmin(users.save(u));
    }

    public AdminUser update(AppUser actor, Long id, AdminUserInput in) {
        AppUser u = found(id);
        requireCanManage(actor, u.getRole());
        requireCanManage(actor, in.role());
        String email = in.email().trim().toLowerCase();
        if (!email.equalsIgnoreCase(u.getEmail()) && users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un compte existe déjà avec cet email");
        }
        if (u.getId().equals(actor.getId()) && in.role() != u.getRole()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas modifier votre propre rôle");
        }
        u.setEmail(email);
        apply(u, in);
        return toAdmin(users.save(u));
    }

    public AdminUser setEnabled(AppUser actor, Long id, boolean enabled) {
        AppUser u = found(id);
        requireCanManage(actor, u.getRole());
        if (u.getId().equals(actor.getId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas désactiver votre propre compte");
        u.setEnabled(enabled);
        u.revokeSessions();
        return toAdmin(users.save(u));
    }

    public ResetLinkDto resetLink(AppUser actor, Long id) {
        AppUser u = found(id);
        requireCanManage(actor, u.getRole());
        if (!u.isEnabled()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Compte désactivé");
        return new ResetLinkDto(resets.adminLink(u), Instant.now().plus(PasswordResetService.ADMIN_VALIDITY));
    }

    public void eraseByAdmin(AppUser actor, Long id) {
        AppUser u = found(id);
        requireCanManage(actor, u.getRole());
        if (u.getId().equals(actor.getId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Utilisez « Supprimer mon compte »");
        erase(u);
    }

    // =====================================================================
    // Self-service
    // =====================================================================

    public void logoutEverywhere(AppUser u) {
        u.revokeSessions();
        users.save(u);
    }

    public void eraseSelf(AppUser u, String password) {
        if (password == null || !encoder.matches(password, u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Mot de passe incorrect");
        }
        if (u.getRole() == Role.ADMIN && users.countByRoleAndEnabledTrue(Role.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Dernier administrateur : suppression impossible");
        }
        erase(u);
    }

    /**
     * Effacement : les donnees personnelles sont supprimees ou anonymisees.
     * Conserves sous forme pseudonyme (identifiant interne seul) : progression, tentatives et inscriptions, necessaires
     * aux statistiques et a l'evaluation d'impact ; ils ne permettent plus d'identifier la personne.
     */
    void erase(AppUser u) {
        Long id = u.getId();
        // medias personnels (videos de pratique) : fichiers detruits
        for (MediaFile m : mediaFiles.findByOwnerId(id)) {
            storage.delete(m.getName());
            mediaFiles.delete(m);
        }
        em.createQuery("select p.mediaUrl from PortfolioItem p where p.user.id = :id and p.mediaUrl is not null", String.class)
                .setParameter("id", id).getResultList()
                .forEach(url -> storage.delete(url.substring(url.lastIndexOf('/') + 1)));
        em.createQuery("delete from PortfolioItem p where p.user.id = :id").setParameter("id", id).executeUpdate();
        em.createQuery("update PortfolioItem p set p.mentor = null where p.mentor.id = :id").setParameter("id", id).executeUpdate();
        em.createQuery("delete from Certificate c where c.user.id = :id").setParameter("id", id).executeUpdate();
        em.createQuery("delete from ProgramCertificate c where c.user.id = :id").setParameter("id", id).executeUpdate();
        em.createQuery("delete from AssistantLog a where a.userId = :id").setParameter("id", id).executeUpdate();
        em.createQuery("update CourseFeedback f set f.comment = null where f.user.id = :id").setParameter("id", id).executeUpdate();
        em.createQuery("update ForumPost p set p.body = :b where p.author.id = :id")
                .setParameter("b", "[message supprimé à la demande de son auteur]").setParameter("id", id).executeUpdate();
        em.createQuery("update ForumThread t set t.body = :b where t.author.id = :id")
                .setParameter("b", "[message supprimé à la demande de son auteur]").setParameter("id", id).executeUpdate();
        em.createQuery("update Classroom c set c.facilitator = null where c.facilitator.id = :id").setParameter("id", id).executeUpdate();
        em.createNativeQuery("delete from classroom_member where members_id = :id").setParameter("id", id).executeUpdate();
        resetTokens.deleteByUserId(id);

        u.setEmail("supprime-" + id + "@invalid.local");
        u.setFullName("Compte supprimé");
        u.setPasswordHash(encoder.encode(randomSecret()));
        u.setRegion(null);
        u.setSchool(null);
        u.setRecommendedCourseIds(null);
        u.setEnabled(false);
        u.setDataConsent(false);
        u.setDeletedAt(Instant.now());
        u.revokeSessions();
        users.save(u);
    }

    /** Droit d'acces et de portabilite : toutes les donnees de la personne, en JSON. */
    @Transactional(readOnly = true)
    public Map<String, Object> export(AppUser u) {
        Long id = u.getId();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("exportedAt", Instant.now());
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("email", u.getEmail());
        profile.put("fullName", u.getFullName());
        profile.put("role", u.getRole());
        profile.put("countryCode", u.getCountryCode());
        profile.put("languageCode", u.getLanguageCode());
        profile.put("region", u.getRegion());
        profile.put("school", u.getSchool() == null ? null : u.getSchool().getName());
        profile.put("cohort", u.getCohort());
        profile.put("createdAt", u.getCreatedAt());
        profile.put("lastActiveAt", u.getLastActiveAt());
        out.put("profile", profile);
        out.put("enrollments", rows("select e.course.title, e.program.title, e.method, e.amount, e.enrolledAt from Enrollment e left join e.course left join e.program where e.user.id = :id", id,
                "course", "program", "method", "amount", "enrolledAt"));
        out.put("lessonsCompleted", rows("select p.lesson.course.title, p.lesson.title, p.completedAt, p.timeSpentSeconds, p.completedOffline from LessonProgress p where p.user.id = :id", id,
                "course", "lesson", "completedAt", "timeSpentSeconds", "offline"));
        out.put("finalEvaluations", rows("select a.course.title, a.scorePercent, a.passed, a.attemptedAt from QuizAttempt a where a.user.id = :id", id,
                "course", "scorePercent", "passed", "attemptedAt"));
        out.put("certificates", rows("select c.code, c.level, c.course.title, c.issuedAt, c.revokedAt from Certificate c where c.user.id = :id", id,
                "code", "level", "course", "issuedAt", "revokedAt"));
        out.put("portfolio", rows("select p.course.title, p.text, p.mediaUrl, p.status, p.mentorFeedback, p.submittedAt from PortfolioItem p where p.user.id = :id", id,
                "course", "text", "mediaUrl", "status", "mentorFeedback", "submittedAt"));
        out.put("forumPosts", rows("select p.thread.title, p.body, p.createdAt from ForumPost p where p.author.id = :id", id,
                "thread", "body", "createdAt"));
        out.put("feedback", rows("select f.course.title, f.rating, f.comment, f.createdAt from CourseFeedback f where f.user.id = :id", id,
                "course", "rating", "comment", "createdAt"));
        out.put("assistantConversations", rows("select a.question, a.answer, a.at from AssistantLog a where a.userId = :id", id,
                "question", "answer", "at"));
        return out;
    }

    private List<Map<String, Object>> rows(String jpql, Long id, String... names) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object r : em.createQuery(jpql).setParameter("id", id).getResultList()) {
            Object[] cols = r instanceof Object[] a ? a : new Object[]{r};
            Map<String, Object> m = new LinkedHashMap<>();
            for (int i = 0; i < names.length && i < cols.length; i++) m.put(names[i], cols[i]);
            out.add(m);
        }
        return out;
    }

    // =====================================================================

    /** Un formateur gere apprenants et mentors ; seuls les administrateurs gerent les comptes ADMIN et FORMATEUR. */
    private void requireCanManage(AppUser actor, Role target) {
        if (STAFF.contains(target) && actor.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé aux administrateurs");
        }
    }

    private void apply(AppUser u, AdminUserInput in) {
        u.setFullName(in.fullName().trim());
        u.setRole(in.role());
        u.setCountryCode(blank(in.countryCode()));
        u.setLanguageCode(blank(in.languageCode()) == null ? "fr" : in.languageCode());
        u.setRegion(blank(in.region()));
        u.setCohort(blank(in.cohort()));
        u.setSchool(in.schoolId() == null ? null : schools.findById(in.schoolId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Établissement inconnu")));
    }

    private AppUser found(Long id) {
        return users.findById(id).filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Compte introuvable"));
    }

    private String randomSecret() {
        byte[] b = new byte[24];
        random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    static AdminUser toAdmin(AppUser u) {
        return new AdminUser(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.getCountryCode(), u.getLanguageCode(),
                u.getRegion(), u.getSchool() == null ? null : u.getSchool().getId(), u.getSchool() == null ? null : u.getSchool().getName(),
                u.getCohort(), u.isEnabled(), u.getCreatedAt(), u.getLastActiveAt());
    }
}
