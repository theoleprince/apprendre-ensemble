package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.LessonRepository;
import org.formation.api.repository.PortfolioItemRepository;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/** Depot de preuves de pratique (texte, video de classe) et evaluation par les mentors (conseillers pedagogiques). */
@Service
@Transactional
public class PortfolioService {

    private final PortfolioItemRepository items;
    private final LessonRepository lessons;
    private final LearningService learning;
    private final CertificationService certification;
    private final AccessPolicy policy;
    private final ProgramService programs;
    private final org.formation.api.repository.MediaFileRepository mediaFiles;
    private final org.formation.api.security.MediaSigner signer;

    public PortfolioService(PortfolioItemRepository items, LessonRepository lessons, LearningService learning,
                            CertificationService certification, AccessPolicy policy, ProgramService programs,
                            org.formation.api.repository.MediaFileRepository mediaFiles, org.formation.api.security.MediaSigner signer) {
        this.mediaFiles = mediaFiles;
        this.signer = signer;
        this.items = items;
        this.lessons = lessons;
        this.learning = learning;
        this.certification = certification;
        this.policy = policy;
        this.programs = programs;
    }

    public PortfolioDto submit(AppUser user, PortfolioInput in) {
        if ((in.text() == null || in.text().isBlank()) && (in.mediaUrl() == null || in.mediaUrl().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ajoutez un texte ou une video");
        }
        Course course = learning.accessibleCourse(user, in.courseId());
        PortfolioItem p = new PortfolioItem();
        p.setUser(user);
        p.setCourse(course);
        if (in.lessonId() != null) {
            Lesson l = lessons.findById(in.lessonId())
                    .filter(x -> x.getCourse().getId().equals(course.getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lecon invalide"));
            p.setLesson(l);
        }
        p.setText(in.text() == null ? null : in.text().trim());
        String media = blankToNull(in.mediaUrl());
        if (media != null) {
            // seule une video televersee par l'apprenant lui-meme peut etre jointe (pas le fichier d'un autre)
            String name = media.replaceFirst("^/api/media/", "").replaceFirst("[?].*$", "");
            boolean own = media.startsWith("/api/media/") && mediaFiles.findById(name)
                    .map(m -> m.getOwner() != null && m.getOwner().getId().equals(user.getId())).orElse(false);
            if (!own) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vidéo invalide");
            media = "/api/media/" + name;
        }
        p.setMediaUrl(media);
        return toDto(items.save(p));
    }

    @Transactional(readOnly = true)
    public List<PortfolioDto> mine(AppUser user) {
        return items.findAllForUser(user.getId()).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<PortfolioDto> toReview(AppUser mentor) {
        requireMentor(mentor);
        return items.findByStatusForReview(PortfolioItem.Status.SOUMIS).stream()
                .filter(p -> policy.isStaff(mentor) || sameZone(mentor, p.getUser()))
                .map(this::toDto).toList();
    }

    public PortfolioDto review(AppUser mentor, Long id, PortfolioReview in) {
        requireMentor(mentor);
        if (in.status() == PortfolioItem.Status.SOUMIS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide");
        }
        PortfolioItem p = items.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!policy.isStaff(mentor) && !sameZone(mentor, p.getUser())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Apprenant hors de votre zone");
        }
        p.setStatus(in.status());
        p.setMentorFeedback(in.feedback());
        p.setMentor(mentor);
        p.setReviewedAt(Instant.now());
        items.save(p);
        if (in.status() == PortfolioItem.Status.VALIDE) {
            certification.evaluate(p.getUser(), p.getCourse());
            programs.evaluatePrograms(p.getUser());
        }
        return toDto(p);
    }

    /** Un conseiller pedagogique suit les enseignant·es de sa zone. */
    private boolean sameZone(AppUser mentor, AppUser learner) {
        return mentor.getCountryCode() != null && mentor.getCountryCode().equals(learner.getCountryCode())
                && (mentor.getRegion() == null || mentor.getRegion().equals(learner.getRegion()));
    }

    private void requireMentor(AppUser u) {
        if (!policy.isMentor(u)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Reserve aux mentors");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Le lien de la video est signe et temporaire : seuls l'auteur et ses mentors le recoivent. */
    PortfolioDto toDto(PortfolioItem p) {
        return new PortfolioDto(p.getId(), p.getCourse().getId(), p.getCourse().getTitle(),
                p.getLesson() == null ? null : p.getLesson().getId(),
                p.getLesson() == null ? null : p.getLesson().getTitle(),
                p.getUser().getFullName(), p.getText(), signer.sign(p.getMediaUrl()), p.getStatus(), p.getMentorFeedback(),
                p.getMentor() == null ? null : p.getMentor().getFullName(), p.getSubmittedAt(), p.getReviewedAt());
    }
}
