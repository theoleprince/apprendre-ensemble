package org.formation.api.ai;

import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import org.formation.api.domain.Course;
import org.formation.api.domain.Lesson;
import org.formation.api.domain.QuizQuestion;
import org.formation.api.repository.CourseRepository;
import org.formation.api.service.AnalyticsService;
import org.formation.api.web.dto.Dtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Boucle d'amelioration continue des modules : l'IA analyse les erreurs les plus frequentes et les retours
 * des utilisateurs, puis PROPOSE des ajustements. Un humain (equipe pedagogique) decide et publie :
 * chaque publication cree une nouvelle version du module (contentVersion).
 */
@Service
public class ImprovementService {

    /** Schema de sortie impose au modele (structured outputs). */
    public record SuggestionOut(
            @JsonPropertyDescription("Element vise : 'Lecon N : titre' ou 'Question N'") String target,
            @JsonPropertyDescription("Probleme observe, chiffre a l'appui") String problem,
            @JsonPropertyDescription("Modification concrete proposee (texte a ajouter / reformuler)") String proposedChange,
            @JsonPropertyDescription("Pourquoi cette modification devrait reduire l'erreur") String rationale,
            @JsonPropertyDescription("haute, moyenne ou basse") String priority) {
    }

    public record SuggestionsOut(
            @JsonPropertyDescription("Synthese en 2-3 phrases") String summary,
            List<SuggestionOut> suggestions) {
    }

    private final AiClientProvider ai;
    private final AnalyticsService analytics;
    private final CourseRepository courses;
    private final TransactionTemplate tx;

    public ImprovementService(AiClientProvider ai, AnalyticsService analytics, CourseRepository courses,
                              TransactionTemplate tx) {
        this.ai = ai;
        this.analytics = analytics;
        this.courses = courses;
        this.tx = tx;
    }

    public AiSuggestions suggest(Long courseId) {
        CourseInsights insights = analytics.insights(courseId);
        String content = tx.execute(s -> {
            Course c = courses.findById(courseId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            StringBuilder sb = new StringBuilder("MODULE : ").append(c.getTitle()).append(" (version ")
                    .append(c.getContentVersion()).append(")\n");
            for (Lesson l : c.getLessons()) {
                sb.append("\nLecon ").append(l.getPosition()).append(" : ").append(l.getTitle()).append(" [")
                        .append(l.getMediaType()).append("]\n").append(Objects.requireNonNullElse(l.getContent(), "")).append('\n');
            }
            sb.append("\nEVALUATION :\n");
            List<QuizQuestion> qs = c.getQuestions();
            for (int i = 0; i < qs.size(); i++) {
                QuizQuestion q = qs.get(i);
                sb.append("Question ").append(i + 1).append(" : ").append(q.getQuestion()).append(" / bonne reponse : ")
                        .append(q.getOptions().get(q.getCorrectIndex())).append('\n');
            }
            return sb.toString();
        });

        StringBuilder data = new StringBuilder("DONNEES D'USAGE (").append(insights.attempts()).append(" tentatives)\n");
        for (int i = 0; i < insights.questions().size(); i++) {
            QuestionInsight q = insights.questions().get(i);
            data.append("Question ").append(i + 1).append(" : taux d'erreur ").append(Math.round(q.errorRate() * 100))
                    .append("% sur ").append(q.answers()).append(" reponses ; repartition : ");
            for (OptionStat o : q.distribution()) {
                data.append('"').append(o.option()).append("\" ").append(o.count()).append(o.correct() ? " (correcte)" : "").append("; ");
            }
            data.append('\n');
        }
        data.append("\nSatisfaction moyenne ").append(insights.avgRating()).append("/5, clarte ").append(insights.avgClarity())
                .append("/5, utilite ").append(insights.avgUsefulness()).append("/5\nCommentaires :\n");
        insights.comments().stream().limit(40).forEach(c -> data.append("- ").append(c).append('\n'));

        if (ai.client().isEmpty()) {
            return heuristic(insights);
        }
        StructuredMessageCreateParams<SuggestionsOut> params = MessageCreateParams.builder()
                .model(ai.model())
                .maxTokens(16000L)
                .system("""
                        Tu es ingenieur pedagogique pour une formation d'enseignant·es du primaire et de parents en Afrique
                        de l'Ouest (faible connectivite, litteratie variable). A partir du contenu d'un module et des donnees
                        d'usage, propose au plus 6 ajustements concrets et prioritaires pour reduire les erreurs frequentes et
                        ameliorer la clarte. Pour chaque question tres echouee, determine si le probleme vient de la lecon
                        (notion mal expliquee), de la question (ambigue) ou d'un distracteur trop proche. Reste factuel,
                        cite les chiffres. Ne propose rien qui demande de collecter des donnees personnelles.
                        Ecris en francais simple.""")
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                .outputConfig(SuggestionsOut.class)
                .addUserMessage(content + "\n\n" + data)
                .build();
        try {
            List<SuggestionsOut> out = new ArrayList<>();
            ai.client().get().messages().create(params).content().stream()
                    .flatMap(cb -> cb.text().stream())
                    .forEach(t -> out.add(t.text()));
            if (out.isEmpty()) return heuristic(insights);
            SuggestionsOut r = out.getFirst();
            return new AiSuggestions(r.summary(), r.suggestions().stream()
                    .map(x -> new Suggestion(x.target(), x.problem(), x.proposedChange(), x.rationale(), x.priority()))
                    .toList(), ai.model());
        } catch (RuntimeException e) {
            AiSuggestions h = heuristic(insights);
            return new AiSuggestions("IA indisponible (" + e.getClass().getSimpleName() + "). " + h.summary(), h.suggestions(), "regles");
        }
    }

    /** Analyse par regles quand l'IA n'est pas disponible : questions les plus echouees et distracteur dominant. */
    private AiSuggestions heuristic(CourseInsights in) {
        List<Suggestion> out = new ArrayList<>();
        for (int i = 0; i < in.questions().size(); i++) {
            QuestionInsight q = in.questions().get(i);
            if (q.answers() < 3 || q.errorRate() < 0.3) continue;
            OptionStat top = q.distribution().stream().filter(o -> !o.correct())
                    .max((a, b) -> Long.compare(a.count(), b.count())).orElse(null);
            out.add(new Suggestion("Question " + (i + 1),
                    Math.round(q.errorRate() * 100) + "% d'erreurs" + (top == null ? "" : " ; réponse fausse la plus choisie : « " + top.option() + " »"),
                    "Ajouter dans la leçon un exemple qui distingue clairement la bonne réponse de « " + (top == null ? "?" : top.option()) + " », ou reformuler la question.",
                    "Erreurs concentrées sur une même mauvaise réponse : confusion probable dans la leçon.",
                    q.errorRate() >= 0.5 ? "haute" : "moyenne"));
        }
        String summary = out.isEmpty() ? "Pas d'erreur fréquente détectée sur les données actuelles."
                : out.size() + " question(s) avec plus de 30 % d'erreurs.";
        return new AiSuggestions(summary, out, "regles");
    }
}
