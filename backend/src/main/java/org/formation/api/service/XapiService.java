package org.formation.api.service;

import org.formation.api.domain.Certificate;
import org.formation.api.domain.Course;
import org.formation.api.domain.Lesson;
import org.formation.api.domain.LessonProgress;
import org.formation.api.domain.QuizAttempt;
import org.formation.api.repository.CertificateRepository;
import org.formation.api.repository.LessonProgressRepository;
import org.formation.api.repository.QuizAttemptRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Traces d'apprentissage au standard xAPI 1.0.3 (ADL) : lecons terminees, evaluations finales, certificats.
 * Importables dans n'importe quel LRS (Learning Record Store) ou outil d'analyse ; identifiants stables (rejeu sans doublon).
 * Les personnes sont pseudonymisees (compte "learner-{id}", meme identifiant que les autres exports) : aucun nom ni e-mail.
 */
@Service
public class XapiService {

    public static final String VERSION = "1.0.3";
    static final String COMPLETED = "http://adlnet.gov/expapi/verbs/completed";
    static final String PASSED = "http://adlnet.gov/expapi/verbs/passed";
    static final String FAILED = "http://adlnet.gov/expapi/verbs/failed";
    static final String EARNED = "http://id.tincanapi.com/verb/earned";

    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CertificateRepository certificates;
    private final String publicUrl;

    public XapiService(LessonProgressRepository progress, QuizAttemptRepository attempts, CertificateRepository certificates,
                       @Value("${app.public-url:http://localhost:4200}") String publicUrl) {
        this.progress = progress;
        this.attempts = attempts;
        this.certificates = certificates;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> statements() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (LessonProgress p : progress.findAllForExport()) {
            if (p.getCompletedAt() == null) continue;
            Lesson l = p.getLesson();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("completion", true);
            if (p.getTimeSpentSeconds() > 0) result.put("duration", "PT" + p.getTimeSpentSeconds() + "S");
            Map<String, Object> context = context(l.getCourse());
            context.put("extensions", Map.of(publicUrl + "/xapi/extensions/offline", p.isCompletedOffline()));
            out.add(statement("progress-" + p.getId(), p.getUser().getId(), COMPLETED, "a terminé",
                    activity("lesson/" + l.getId(), "http://adlnet.gov/expapi/activities/lesson", l.getTitle()),
                    result, context, p.getCompletedAt().toString()));
        }
        for (QuizAttempt a : attempts.findAllForExport()) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("score", Map.of("scaled", a.getScorePercent() / 100.0, "raw", a.getScorePercent(), "min", 0, "max", 100));
            result.put("success", a.isPassed());
            result.put("completion", true);
            out.add(statement("quiz-" + a.getId(), a.getUser().getId(), a.isPassed() ? PASSED : FAILED,
                    a.isPassed() ? "a réussi" : "a échoué à",
                    activity("course/" + a.getCourse().getId() + "/assessment", "http://adlnet.gov/expapi/activities/assessment",
                            "Évaluation finale - " + a.getCourse().getTitle()),
                    result, context(a.getCourse()), a.getAttemptedAt().toString()));
        }
        for (Certificate c : certificates.findAllForExport()) {
            if (c.isRevoked()) continue;
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            if (c.getScorePercent() > 0) result.put("score", Map.of("scaled", c.getScorePercent() / 100.0));
            out.add(statement("certificate-" + c.getId(), c.getUser().getId(), EARNED, "a obtenu",
                    activity("achievement/" + c.getCourse().getId() + "/" + c.getLevel().name(), "http://id.tincanapi.com/activitytype/badge",
                            c.getLevel().label() + " - " + c.getCourse().getTitle()),
                    result, context(c.getCourse()), c.getIssuedAt().toString()));
        }
        out.sort(Comparator.comparing(s -> (String) s.get("timestamp")));
        return out;
    }

    private Map<String, Object> statement(String key, Long userId, String verb, String verbFr, Map<String, Object> object,
                                          Map<String, Object> result, Map<String, Object> context, String timestamp) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("id", UUID.nameUUIDFromBytes((publicUrl + "/" + key).getBytes(StandardCharsets.UTF_8)).toString());
        s.put("actor", Map.of("objectType", "Agent", "account", Map.of("homePage", publicUrl, "name", "learner-" + userId)));
        s.put("verb", Map.of("id", verb, "display", Map.of("fr-FR", verbFr)));
        s.put("object", object);
        s.put("result", result);
        s.put("context", context);
        s.put("timestamp", timestamp);
        s.put("version", VERSION);
        return s;
    }

    private Map<String, Object> activity(String path, String type, String name) {
        Map<String, Object> def = new LinkedHashMap<>();
        def.put("type", type);
        def.put("name", Map.of("fr-FR", name));
        return Map.of("objectType", "Activity", "id", publicUrl + "/xapi/activities/" + path, "definition", def);
    }

    private Map<String, Object> context(Course c) {
        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("platform", "Plateforme de formation");
        if (c.getLanguageCode() != null) ctx.put("language", c.getLanguageCode());
        ctx.put("contextActivities", Map.of("parent", List.of(activity("course/" + c.getId(), "http://adlnet.gov/expapi/activities/course", c.getTitle()))));
        return ctx;
    }
}
