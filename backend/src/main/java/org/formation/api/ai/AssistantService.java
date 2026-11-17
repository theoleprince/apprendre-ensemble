package org.formation.api.ai;

import com.anthropic.core.JsonValue;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.models.messages.CacheControlEphemeral;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.models.messages.TextBlockParam;
import org.formation.api.domain.*;
import org.formation.api.repository.AssistantLogRepository;
import org.formation.api.repository.ActivityEventRepository;
import org.formation.api.repository.LessonRepository;
import org.formation.api.repository.LessonProgressRepository;
import org.formation.api.service.LearningService;
import org.formation.api.web.dto.Dtos.ChatMessage;
import org.formation.api.web.dto.Dtos.ChatRequest;
import org.formation.api.web.dto.Dtos.CourseSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.*;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Assistant pedagogique present sur tout le parcours (choix du module -> certificat).
 * - Contexte : profil, modules visibles et progression, lecon en cours.
 * - Garde-fous : pas de collecte de donnees personnelles, orientation vers un adulte referent
 *   en cas de situation de violence ou de detresse (le message est signale pour supervision humaine).
 * - Repli local (sans IA en ligne) : recherche dans les contenus des modules.
 */
@Service
public class AssistantService {

    private static final Logger log = LoggerFactory.getLogger(AssistantService.class);

    /** Mots-cles declenchant un signalement pour revue humaine (protection de l'enfance / detresse). */
    private static final Pattern SENSITIVE = Pattern.compile(
            "\\b(viol|violee?s?|abus|abuse|frappe|battu|maltrait\\w*|agress\\w*|harcel\\w*|suicid\\w*|me tuer|"
                    + "attouch\\w*|exploit\\w*|mariage force|excision|menace\\w*)\\b");

    /** Partie stable du prompt systeme (mise en cache). */
    private static final String SYSTEM_RULES = """
            Tu es "Mentor", l'assistant pedagogique d'une plateforme de formation aux competences de vie,
            a la cooperation, a la gestion des emotions et a la prevention des violences. Les utilisateurs sont
            des enseignant·es du primaire, conseillers pedagogiques, directions d'ecole, parents, travailleurs sociaux
            et jeunes, d'abord au nord du Benin. Beaucoup lisent difficilement et utilisent un telephone simple.

            Ce que tu fais :
            - aider a choisir un module et expliquer comment fonctionne la plateforme (telechargement hors ligne,
              evaluation, portfolio, communautes, certificats) ;
            - expliquer simplement le contenu de la lecon en cours, donner des exemples concrets de classe ou de famille
              adaptes au contexte ouest-africain, proposer de petites activites ;
            - aider a reviser avant l'evaluation SANS donner les reponses du quiz ;
            - expliquer les 4 niveaux de certification : attestation de participation (toutes les lecons),
              badge (evaluation reussie), maitrise (toutes les lecons + score de maitrise), expertise (portfolio valide
              par un mentor).

            Style : phrases courtes, mots simples, tutoiement interdit (vouvoiement), 120 mots maximum sauf demande
            explicite, listes courtes. Reponds dans la langue de l'utilisateur. Pas de jargon.

            Regles de protection (prioritaires) :
            - Ne demande jamais de donnees personnelles (nom complet, telephone, adresse, ecole precise, photo d'enfant).
            - Si un message evoque une violence, un abus, une maltraitance ou une detresse concernant un enfant ou
              l'utilisateur : reponds avec bienveillance, sans enqueter ni juger, et oriente vers un adulte de confiance,
              le conseiller pedagogique, le directeur d'ecole ou les services sociaux / la ligne d'assistance a l'enfance
              du pays. Ne donne pas de conseil juridique ou medical.
            - Tu n'es pas un humain ; dis-le si on te le demande. Si tu ne sais pas, dis-le et propose la communaute
              de pratique ou le mentor.
            - Ne te prononce pas sur la politique, la religion ou des personnes reelles.
            - Ne parle pas des groupes d'evaluation (protocole de recherche) : tu n'y as pas acces.
            """;

    private final AiClientProvider ai;
    private final LearningService learning;
    private final LessonRepository lessons;
    private final LessonProgressRepository progress;
    private final AssistantLogRepository logs;
    private final ActivityEventRepository activity;
    private final TransactionTemplate tx;

    public AssistantService(AiClientProvider ai, LearningService learning, LessonRepository lessons,
                            LessonProgressRepository progress, AssistantLogRepository logs,
                            ActivityEventRepository activity, TransactionTemplate tx) {
        this.ai = ai;
        this.learning = learning;
        this.lessons = lessons;
        this.progress = progress;
        this.logs = logs;
        this.activity = activity;
        this.tx = tx;
    }

    /** Evenements envoyes au client pendant la generation. */
    public interface Sink {
        void delta(String text);

        void done(boolean flagged, String mode);
    }

    /** Contexte prepare dans une transaction courte (avant l'appel reseau, potentiellement long). */
    public record Context(String profile, String lessonText, List<CourseSummary> catalog, Long courseId) {
    }

    public Context prepare(AppUser user, ChatRequest req) {
        List<ChatMessage> msgs = req.messages();
        if (!"user".equals(msgs.getLast().role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le dernier message doit venir de l'utilisateur");
        }
        return tx.execute(s -> {
            List<CourseSummary> catalog = learning.visibleCourses(user);
            String lessonText = null;
            Long courseId = req.courseId();
            if (req.lessonId() != null) {
                Lesson l = lessons.findById(req.lessonId()).orElse(null);
                if (l != null && learning.accessibleCourse(user, l.getCourse().getId()) != null) {
                    courseId = l.getCourse().getId();
                    lessonText = "Module : " + l.getCourse().getTitle() + "\nLecon " + l.getPosition() + " : " + l.getTitle()
                            + "\n" + Objects.requireNonNullElse(l.getContent(), "")
                            + (l.getPracticeTask() != null ? "\nMise en pratique : " + l.getPracticeTask() : "");
                }
            } else if (courseId != null) {
                Course c = learning.accessibleCourse(user, courseId);
                lessonText = "Module consulte : " + c.getTitle() + "\n" + Objects.requireNonNullElse(c.getDescription(), "")
                        + "\nLecons : " + c.getLessons().stream().map(Lesson::getTitle).collect(Collectors.joining(" | "));
            }
            String profile = "Public : " + user.getRole() + " | Pays : " + user.getCountryCode()
                    + " | Langue : " + user.getLanguageCode();
            return new Context(profile, lessonText, catalog, courseId);
        });
    }

    public void chat(AppUser user, ChatRequest req, Context ctx, Sink sink) {
        String question = req.messages().getLast().content();
        boolean flagged = SENSITIVE.matcher(normalize(question)).find();
        StringBuilder answer = new StringBuilder();
        Consumer<String> emit = t -> {
            answer.append(t);
            sink.delta(t);
        };
        String mode = "claude";
        long[] usage = new long[2];
        try {
            if (ai.client().isEmpty()) throw new IllegalStateException("IA non configuree");
            streamClaude(req.messages(), ctx, flagged, emit, usage);
        } catch (RuntimeException e) {
            log.warn("Assistant : repli local ({})", e.getMessage());
            mode = "local";
            if (answer.isEmpty()) emit.accept(localAnswer(user, question, ctx, flagged));
        }
        saveLog(user, ctx.courseId(), question, answer.toString(), flagged, mode, usage);
        sink.done(flagged, mode);
    }

    private void streamClaude(List<ChatMessage> history, Context ctx, boolean flagged, Consumer<String> emit, long[] usage) {
        StringBuilder dynamic = new StringBuilder("Contexte de l'utilisateur (ne pas le repeter tel quel)\n")
                .append(ctx.profile()).append("\n\nModules disponibles (progression, niveaux obtenus) :\n");
        for (CourseSummary c : ctx.catalog()) {
            dynamic.append("- ").append(c.title()).append(" [").append(c.type()).append("] ")
                    .append(c.completedLessons()).append('/').append(c.lessonCount()).append(" lecons")
                    .append(c.levels().isEmpty() ? "" : ", obtenu : " + c.levels())
                    .append(c.recommended() ? " (recommande par le test d'entree)" : "").append('\n');
        }
        if (ctx.lessonText() != null) {
            dynamic.append("\nContenu affiche a l'ecran :\n").append(ctx.lessonText());
        }
        if (flagged) {
            dynamic.append("\n\nATTENTION : le dernier message peut concerner une situation de protection. "
                    + "Applique strictement les regles de protection.");
        }

        MessageCreateParams.Builder b = MessageCreateParams.builder()
                .model(ai.model())
                .maxTokens(2000L)
                .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.LOW).build())
                .systemOfTextBlockParams(List.of(
                        TextBlockParam.builder().text(SYSTEM_RULES)
                                .cacheControl(CacheControlEphemeral.builder().build()).build(),
                        TextBlockParam.builder().text(dynamic.toString()).build()))
                // Repli serveur automatique vers un autre modele en cas de refus du filtre de securite
                .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"));
        for (ChatMessage m : history) {
            if ("user".equals(m.role())) b.addUserMessage(m.content());
            else b.addAssistantMessage(m.content());
        }

        String[] stop = {null};
        try (StreamResponse<RawMessageStreamEvent> stream = ai.client().orElseThrow().messages().createStreaming(b.build())) {
            stream.stream().forEach(ev -> {
                ev.contentBlockDelta().flatMap(d -> d.delta().text()).ifPresent(t -> emit.accept(t.text()));
                ev.messageStart().ifPresent(ms -> usage[0] = ms.message().usage().inputTokens());
                ev.messageDelta().ifPresent(md -> {
                    usage[1] = md.usage().outputTokens();
                    md.delta().stopReason().ifPresent(r -> stop[0] = r.toString());
                });
            });
        }
        if (stop[0] != null && stop[0].toLowerCase().contains("refusal")) {
            emit.accept("\n\nJe ne peux pas répondre à cette demande. Vous pouvez en parler à votre conseiller pédagogique "
                    + "ou poser la question dans la communauté.");
        }
    }

    /** Reponse sans IA en ligne : passages les plus pertinents des lecons accessibles. */
    String localAnswer(AppUser user, String question, Context ctx, boolean flagged) {
        if (flagged) {
            return "Merci de votre confiance. Ce que vous décrivez est important. Parlez-en dès que possible à un adulte de "
                    + "confiance : votre conseiller pédagogique, la direction de l'école ou les services sociaux. "
                    + "Si un enfant est en danger immédiat, contactez la ligne d'assistance à l'enfance de votre pays.";
        }
        Set<String> words = tokens(question);
        record Hit(String course, String lesson, String text, int score) {
        }
        List<Hit> hits = tx.execute(s -> {
            List<Hit> out = new ArrayList<>();
            for (Course c : learning.visible(user)) {
                for (Lesson l : c.getLessons()) {
                    for (String para : Objects.requireNonNullElse(l.getContent(), "").split("\\n\\s*\\n|\\n")) {
                        Set<String> t = tokens(para + " " + l.getTitle());
                        int sc = (int) words.stream().filter(t::contains).count();
                        if (sc > 0 && para.strip().length() > 20) out.add(new Hit(c.getTitle(), l.getTitle(), para.strip(), sc));
                    }
                }
            }
            return out;
        });
        hits.sort(Comparator.comparingInt(Hit::score).reversed());
        if (hits.isEmpty()) {
            return "Je n'ai pas trouvé de réponse dans vos modules. Essayez avec d'autres mots, ou posez la question "
                    + "dans la communauté de pratique : un mentor vous répondra.";
        }
        StringBuilder sb = new StringBuilder("Voici ce que disent vos modules :\n");
        hits.stream().limit(3).forEach(h -> sb.append("\n• ").append(h.text())
                .append("\n  (").append(h.course()).append(" › ").append(h.lesson()).append(")"));
        return sb.toString();
    }

    private void saveLog(AppUser user, Long courseId, String q, String a, boolean flagged, String mode, long[] usage) {
        try {
            tx.executeWithoutResult(s -> {
                AssistantLog l = new AssistantLog();
                l.setUserId(user.getId());
                l.setCourseId(courseId);
                l.setQuestion(truncate(q, 2000));
                l.setAnswer(truncate(a, 4000));
                l.setFlagged(flagged);
                l.setModel("claude".equals(mode) ? ai.model() : "local");
                l.setInputTokens(usage[0]);
                l.setOutputTokens(usage[1]);
                logs.save(l);
                activity.save(new ActivityEvent(user.getId(), ActivityEvent.Type.ASSISTANT, 1));
            });
        } catch (RuntimeException e) {
            log.warn("Journal assistant non enregistre : {}", e.getMessage());
        }
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    static String normalize(String s) {
        return Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static final Set<String> STOP = Set.of("le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a",
            "en", "dans", "pour", "que", "qui", "quoi", "est", "ce", "cette", "comment", "pourquoi", "je", "vous", "il",
            "elle", "on", "mon", "ma", "mes", "sur", "par", "pas", "ne", "plus", "faire", "avec", "au", "aux");

    private static Set<String> tokens(String s) {
        return Arrays.stream(normalize(s).split("[^a-z0-9]+"))
                .filter(w -> w.length() > 2 && !STOP.contains(w))
                .map(w -> w.length() > 5 ? w.substring(0, 5) : w) // racinisation grossiere : emotion(s), emotionnel...
                .collect(Collectors.toSet());
    }
}
