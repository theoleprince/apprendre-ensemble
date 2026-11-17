package org.formation.api.service;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

/**
 * Exports en formats ouverts (CSV ; separateur, et JSON) pour l'evaluation d'impact J-PAL.
 * Donnees pseudonymisees : identifiant technique, jamais de nom ni d'email.
 */
@Service
@Transactional(readOnly = true)
public class ExportService {

    public static final Set<String> DATASETS = Set.of("learners", "progress", "quiz", "feedback", "certificates");
    private static final Set<Role> STAFF = EnumSet.of(Role.ADMIN, Role.FORMATEUR);

    private final AppUserRepository users;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CourseFeedbackRepository feedbacks;
    private final CertificateRepository certificates;

    public ExportService(AppUserRepository users, LessonProgressRepository progress, QuizAttemptRepository attempts,
                         CourseFeedbackRepository feedbacks, CertificateRepository certificates) {
        this.users = users;
        this.progress = progress;
        this.attempts = attempts;
        this.feedbacks = feedbacks;
        this.certificates = certificates;
    }

    /** Lignes du jeu de donnees : la premiere ligne contient les en-tetes. */
    public List<List<Object>> rows(String dataset) {
        List<List<Object>> out = new ArrayList<>();
        switch (dataset) {
            case "learners" -> {
                out.add(List.of("learner_id", "role", "country", "region", "cohort", "language", "created_at", "last_active_at", "placement_done"));
                users.findByRoleNotIn(STAFF).forEach(u -> out.add(list(u.getId(), u.getRole(), u.getCountryCode(), u.getRegion(),
                        u.getCohort(), u.getLanguageCode(), u.getCreatedAt(), u.getLastActiveAt(), u.isPlacementDone())));
            }
            case "progress" -> {
                out.add(List.of("learner_id", "cohort", "region", "course_id", "lesson_id", "lesson_position", "completed_at", "time_spent_s", "offline"));
                progress.findAllForExport().forEach(p -> out.add(list(p.getUser().getId(), p.getUser().getCohort(), p.getUser().getRegion(),
                        p.getLesson().getCourse().getId(), p.getLesson().getId(), p.getLesson().getPosition(),
                        p.getCompletedAt(), p.getTimeSpentSeconds(), p.isCompletedOffline())));
            }
            case "quiz" -> {
                out.add(List.of("learner_id", "cohort", "region", "course_id", "score_percent", "passed", "answers", "attempted_at"));
                attempts.findAllForExport().forEach(a -> out.add(list(a.getUser().getId(), a.getUser().getCohort(), a.getUser().getRegion(),
                        a.getCourse().getId(), a.getScorePercent(), a.isPassed(), a.getAnswers(), a.getAttemptedAt())));
            }
            case "feedback" -> {
                out.add(List.of("learner_id", "cohort", "course_id", "rating", "clarity", "usefulness", "comment", "created_at"));
                feedbacks.findAllForExport().forEach(f -> out.add(list(f.getUser().getId(), f.getUser().getCohort(), f.getCourse().getId(),
                        f.getRating(), f.getClarity(), f.getUsefulness(), f.getComment(), f.getCreatedAt())));
            }
            case "certificates" -> {
                out.add(List.of("learner_id", "cohort", "course_id", "level", "score_percent", "issued_at"));
                certificates.findAllForExport().forEach(c -> out.add(list(c.getUser().getId(), c.getUser().getCohort(), c.getCourse().getId(),
                        c.getLevel(), c.getScorePercent(), c.getIssuedAt())));
            }
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Jeu de donnees inconnu");
        }
        return out;
    }

    public String csv(String dataset) {
        StringBuilder sb = new StringBuilder();
        for (List<Object> row : rows(dataset)) {
            StringJoiner j = new StringJoiner(";");
            for (Object v : row) j.add(csvCell(v));
            sb.append(j).append('\n');
        }
        return sb.toString();
    }

    /** JSON (tableau d'objets) ecrit a la main : pas de dependance a une version de Jackson. */
    public String json(String dataset) {
        List<List<Object>> rows = rows(dataset);
        List<Object> head = rows.getFirst();
        StringBuilder sb = new StringBuilder("[");
        for (int r = 1; r < rows.size(); r++) {
            if (r > 1) sb.append(',');
            sb.append("\n  {");
            List<Object> row = rows.get(r);
            for (int c = 0; c < head.size(); c++) {
                if (c > 0) sb.append(", ");
                sb.append(jsonString(String.valueOf(head.get(c)))).append(": ").append(jsonValue(row.get(c)));
            }
            sb.append('}');
        }
        return sb.append("\n]\n").toString();
    }

    private static List<Object> list(Object... v) {
        return Arrays.asList(v);
    }

    private static String csvCell(Object v) {
        if (v == null) return "";
        String s = v.toString();
        return s.matches(".*[;\"\\n\\r].*") ? '"' + s.replace("\"", "\"\"") + '"' : s;
    }

    private static String jsonValue(Object v) {
        if (v == null) return "null";
        if (v instanceof Number || v instanceof Boolean) return v.toString();
        return jsonString(v.toString());
    }

    private static String jsonString(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
                    else sb.append(ch);
                }
            }
        }
        return sb.append('"').toString();
    }
}
