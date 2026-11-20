package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.web.dto.Dtos.CertificateDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * Attribution automatique et idempotente des 4 niveaux de certification d'un module,
 * selon les criteres parametres dans le module (scores, portfolio).
 */
@Service
@Transactional
public class CertificationService {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I : lisible a l'oral
    private final SecureRandom random = new SecureRandom();

    private final CertificateRepository certificates;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final PortfolioItemRepository portfolios;

    public CertificationService(CertificateRepository certificates, LessonProgressRepository progress,
                                QuizAttemptRepository attempts, PortfolioItemRepository portfolios) {
        this.certificates = certificates;
        this.progress = progress;
        this.attempts = attempts;
        this.portfolios = portfolios;
    }

    /** Evalue tous les niveaux pour un apprenant et un module ; renvoie les certificats nouvellement delivres. */
    public List<CertificateDto> evaluate(AppUser user, Course course) {
        List<CertificateDto> issued = new ArrayList<>();
        boolean allLessons = !course.getLessons().isEmpty()
                && progress.countByUserIdAndLessonCourseId(user.getId(), course.getId()) >= course.getLessons().size();
        int best = attempts.findTopByUserIdAndCourseIdOrderByScorePercentDesc(user.getId(), course.getId())
                .map(QuizAttempt::getScorePercent).orElse(-1);
        boolean hasQuiz = !course.examQuestions().isEmpty();

        if (allLessons) {
            issue(user, course, CertificateLevel.ATTESTATION, Math.max(best, 0), issued);
        }
        if (hasQuiz && best >= course.getPassScore()) {
            issue(user, course, CertificateLevel.BADGE, best, issued);
        }
        boolean mastery = allLessons && (!hasQuiz || best >= course.getMasteryScore());
        if (mastery) {
            issue(user, course, CertificateLevel.MAITRISE, Math.max(best, 0), issued);
        }
        if (mastery && course.isExpertiseEnabled()
                && portfolios.existsByUserIdAndCourseIdAndStatus(user.getId(), course.getId(), PortfolioItem.Status.VALIDE)) {
            issue(user, course, CertificateLevel.EXPERTISE, Math.max(best, 0), issued);
        }
        return issued;
    }

    private void issue(AppUser user, Course course, CertificateLevel level, int score, List<CertificateDto> out) {
        if (certificates.existsByUserIdAndCourseIdAndLevel(user.getId(), course.getId(), level)) {
            return;
        }
        Certificate c = new Certificate();
        c.setUser(user);
        c.setCourse(course);
        c.setLevel(level);
        c.setScorePercent(score);
        c.setCode(newCode());
        certificates.save(c);
        out.add(toDto(c));
    }

    private String newCode() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            if (i == 5) sb.append('-');
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    public static CertificateDto toDto(Certificate c) {
        return new CertificateDto(c.getCode(), c.getLevel(), c.getLevel().label(), c.getCourse().getId(),
                c.getCourse().getTitle(), c.getUser().getFullName(), c.getScorePercent(), c.getIssuedAt(),
                c.getRevokedAt(), c.getRevokedReason());
    }
}
