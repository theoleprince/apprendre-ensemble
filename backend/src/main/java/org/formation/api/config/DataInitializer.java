package org.formation.api.config;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.service.CertificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.Map;

/**
 * Donnees de reference + jeu de demonstration (serveur de test uniquement, APP_SEED_DEMO=true) :
 * modules texte / audio / video, test d'entree, communaute, et 60 apprenants simules
 * pour illustrer le tableau de bord et la boucle d'amelioration.
 */
@Component
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final String DEMO_PASSWORD = "Demo1234!";
    private static final String VIDEO = "5b3a9c71-2e6d-4a0f-8c47-9d1e3f6a2b33.mp4";
    private static final String AUDIO = "8f1c2a6e-0b4d-4c55-9a51-3c7e2b9d0a11.mp3";
    private static final String VTT = "2d7e9b40-5a3c-4f8e-b1d2-6c9a0e4f7b22.vtt";
    private static final List<String> REGIONS = List.of("Alibori", "Atacora", "Borgou", "Donga");

    private final CountryRepository countries;
    private final LanguageRepository languages;
    private final AppUserRepository users;
    private final CourseRepository courses;
    private final PlacementQuestionRepository placement;
    private final ForumThreadRepository threads;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CourseFeedbackRepository feedbacks;
    private final ActivityEventRepository activity;
    private final PortfolioItemRepository portfolios;
    private final CertificationService certification;
    private final PasswordEncoder encoder;
    private final boolean demoData;
    private final String adminPassword;
    private final Path mediaDir;

    public DataInitializer(CountryRepository countries, LanguageRepository languages, AppUserRepository users,
                           CourseRepository courses, PlacementQuestionRepository placement, ForumThreadRepository threads,
                           LessonProgressRepository progress, QuizAttemptRepository attempts,
                           CourseFeedbackRepository feedbacks, ActivityEventRepository activity,
                           PortfolioItemRepository portfolios, CertificationService certification,
                           PasswordEncoder encoder,
                           @Value("${app.seed.demo-data:true}") boolean demoData,
                           @Value("${app.seed.admin-password}") String adminPassword,
                           @Value("${app.media.dir:./data/media}") String mediaDir) {
        this.countries = countries;
        this.languages = languages;
        this.users = users;
        this.courses = courses;
        this.placement = placement;
        this.threads = threads;
        this.progress = progress;
        this.attempts = attempts;
        this.feedbacks = feedbacks;
        this.activity = activity;
        this.portfolios = portfolios;
        this.certification = certification;
        this.encoder = encoder;
        this.demoData = demoData;
        this.adminPassword = adminPassword;
        this.mediaDir = Path.of(mediaDir);
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (countries.count() == 0) {
            countries.saveAll(List.of(
                    new Country("BJ", "Bénin", true),
                    new Country("CI", "Côte d'Ivoire", true),
                    new Country("CH", "Suisse", true),
                    new Country("FR", "France", true)));
        }
        if (languages.count() == 0) {
            languages.saveAll(List.of(
                    new Language("fr", "Français", true),
                    new Language("en", "English", true),
                    new Language("bba", "Baatonum", true),
                    new Language("ddn", "Dendi", true),
                    new Language("fon", "Fongbe", true)));
        }
        if (!users.existsByEmailIgnoreCase("admin@demo.local")) {
            user("admin@demo.local", adminPassword, "Administrateur Démo", Role.ADMIN, "CH", null, null);
        }
        copyDemoMedia();
        migrateEmojiIcons();
        if (!demoData || courses.count() > 0) {
            return;
        }

        user("formateur@demo.local", DEMO_PASSWORD, "Aïcha Formatrice", Role.FORMATEUR, "BJ", "Borgou", null);
        AppUser conseiller = user("conseiller@demo.local", DEMO_PASSWORD, "Moussa Conseiller", Role.CONSEILLER_PEDAGOGIQUE, "BJ", "Borgou", null);
        AppUser enseignant = user("enseignant@demo.local", DEMO_PASSWORD, "Rachida Enseignante", Role.ENSEIGNANT, "BJ", "Borgou", "TRAITEMENT");
        user("parent@demo.local", DEMO_PASSWORD, "Bio Parent", Role.PARENT, "BJ", "Atacora", null);
        user("jeune@demo.local", DEMO_PASSWORD, "Sani Jeune", Role.JEUNE, "BJ", "Alibori", null);
        user("direction@demo.local", DEMO_PASSWORD, "Directrice Démo", Role.DIRECTION_ECOLE, "BJ", "Borgou", "TRAITEMENT");

        Set<Role> teachers = Set.of(Role.ENSEIGNANT, Role.CONSEILLER_PEDAGOGIQUE, Role.DIRECTION_ECOLE);

        // ---------- Module 1 : texte + video + audio ----------
        Course c1 = course("Gérer ses émotions en classe", "cloud-sun",
                "Reconnaître, nommer et réguler les émotions pour un climat de classe apaisé. Vidéo, audio et fiches pratiques.",
                CourseType.THEORIQUE, null, teachers);
        text(c1, "Pourquoi parler des émotions ?", """
                Les émotions influencent l'attention, la mémoire et les relations.
                Un élève submergé par la colère ou la peur apprend moins bien.

                **À retenir**
                - Toutes les émotions sont légitimes, tous les comportements ne le sont pas.
                - L'adulte montre l'exemple par sa propre régulation.
                - Nommer une émotion aide déjà à la calmer.
                """, null, 6);
        media(c1, "La météo des émotions", MediaType.VIDEO, VIDEO, VTT, resource("demo-media/video-transcript.txt"), null, 2);
        media(c1, "Technique de retour au calme", MediaType.AUDIO, AUDIO, null, resource("demo-media/audio-transcript.txt"),
                "Pratiquez la respiration 4-6 avec votre classe trois matins de suite. Notez ce que vous observez.", 2);
        text(c1, "Réagir à une crise de colère", """
                Pendant la crise, la priorité est la sécurité et le calme, pas la leçon de morale.

                1. Se placer à hauteur de l'élève, parler doucement.
                2. Nommer l'émotion : « Je vois que tu es très en colère. »
                3. Proposer le coin calme ou la respiration apprise à froid.
                4. Parler de ce qui s'est passé plus tard, quand l'élève est calme.

                **Erreur fréquente** : punir pendant la crise. Cela augmente la tension.
                """, null, 8);
        question(c1, "Quand faut-il enseigner une technique de retour au calme ?",
                List.of("Pendant la crise", "À froid, quand tout va bien", "Uniquement aux élèves agités"), 1,
                "On l'apprend à froid pour pouvoir l'utiliser pendant la crise.");
        question(c1, "Pendant une crise de colère, la priorité est :",
                List.of("Faire la leçon de morale", "Punir immédiatement", "La sécurité et le retour au calme"), 2,
                "La discussion vient après, quand l'élève est calme.");
        question(c1, "La météo des émotions sert à :",
                List.of("Noter les élèves", "Aider les élèves à nommer ce qu'ils ressentent", "Remplacer la leçon"), 1,
                "Nommer ses émotions aide à les comprendre.");
        question(c1, "Quelle affirmation est juste ?",
                List.of("Certaines émotions sont interdites", "Toutes les émotions sont légitimes", "Il faut cacher ses émotions"), 1,
                "Ce sont les comportements qui se règlent, pas les émotions.");
        courses.save(c1);

        // ---------- Module 2 : parcours pratique ----------
        Course c2 = course("Coopérer plutôt que s'opposer", "handshake",
                "Parcours pratique : animer des jeux coopératifs et documenter l'expérience dans son portfolio.",
                CourseType.PRATIQUE, "BJ", Set.of(Role.ENSEIGNANT, Role.TRAVAILLEUR_SOCIAL));
        text(c2, "Le principe des jeux coopératifs", """
                Dans un jeu coopératif, tout le monde gagne ou tout le monde perd ensemble.
                L'objectif est de développer l'entraide et l'écoute plutôt que la compétition.

                **Exemple** : la rivière. Le groupe doit traverser une « rivière » tracée au sol en n'utilisant que trois « pierres » (feuilles) qu'il faut faire passer de main en main.
                """, "Organisez un jeu coopératif de 15 minutes avec votre groupe. Filmez 30 secondes (sans visage d'enfant reconnaissable) ou décrivez ce que vous avez observé.", 10);
        text(c2, "Débriefer avec les participants", """
                Après le jeu, posez trois questions :
                1. Qu'est-ce qui a bien marché ?
                2. Qu'est-ce qui a été difficile ?
                3. Qu'est-ce qu'on ferait autrement ?
                """, "Faites un débriefing avec les trois questions et notez deux réponses marquantes.", 10);
        question(c2, "Dans un jeu coopératif :",
                List.of("Un seul joueur gagne", "Tout le groupe gagne ou perd ensemble", "Il n'y a pas de règles"), 1,
                "La réussite est collective.");
        question(c2, "Le débriefing sert à :",
                List.of("Désigner un gagnant", "Tirer des enseignements de l'expérience", "Sanctionner les erreurs"), 1, null);
        courses.save(c2);

        // ---------- Module 3 : parents, audio d'abord ----------
        Course c3 = course("Accompagner son enfant sans violence", "family",
                "Pour les parents : écouter, poser des limites claires et résoudre les conflits à la maison. Leçons courtes à écouter.",
                CourseType.THEORIQUE, null, Set.of(Role.PARENT));
        media(c3, "Se calmer avant de réagir (audio)", MediaType.AUDIO, AUDIO, null, resource("demo-media/audio-transcript.txt"), null, 2);
        text(c3, "Écouter vraiment", """
                Se mettre à hauteur de l'enfant, le regarder, reformuler ce qu'il dit :
                « Tu es triste parce que ton frère a pris ton jouet. »
                L'enfant qui se sent compris se calme plus vite.
                """, null, 5);
        text(c3, "Poser des limites sans frapper", """
                Une limite claire, expliquée et toujours la même est plus efficace qu'une punition violente.
                Annoncer la conséquence avant, l'appliquer calmement après.
                """, null, 5);
        question(c3, "Reformuler ce que dit l'enfant permet :",
                List.of("De le faire taire", "Qu'il se sente compris", "De gagner du temps"), 1, null);
        question(c3, "Une limite efficace est :",
                List.of("Changeante selon l'humeur", "Claire, expliquée et constante", "Toujours accompagnée d'une punition physique"), 1, null);
        courses.save(c3);

        // ---------- Module 4 : jeunes ----------
        Course c4 = course("Premiers pas avec le téléphone", "smartphone",
                "Initiation numérique : utiliser son téléphone pour apprendre, communiquer et se protéger en ligne.",
                CourseType.THEORIQUE, null, Set.of(Role.JEUNE));
        text(c4, "Protéger ses informations", """
                Ne partagez jamais votre mot de passe, même avec un ami.
                Une personne inconnue qui demande des photos ou de l'argent en ligne : on bloque et on en parle à un adulte de confiance.
                """, null, 5);
        text(c4, "Apprendre sans connexion", """
                Sur cette application, appuyez sur « Télécharger » quand vous avez du réseau.
                Ensuite, vous pouvez apprendre partout, même sans connexion. Votre progression sera envoyée plus tard.
                """, null, 4);
        question(c4, "Un inconnu vous demande une photo en ligne. Que faire ?",
                List.of("Envoyer la photo", "Bloquer et en parler à un adulte de confiance", "Répondre pour savoir qui c'est"), 1, null);
        courses.save(c4);

        // ---------- Module 5 : directions ----------
        Course c5 = course("Piloter un climat scolaire positif", "school",
                "Pour les directions d'école : fixer des règles communes, suivre les incidents et soutenir les enseignant·es.",
                CourseType.THEORIQUE, "BJ", Set.of(Role.DIRECTION_ECOLE, Role.CONSEILLER_PEDAGOGIQUE));
        text(c5, "Des règles communes à toute l'école", """
                Un climat apaisé repose sur quelques règles simples, connues de tous et appliquées de la même façon dans chaque classe.
                Construisez-les avec les enseignant·es et les élèves délégués.
                """, null, 8);
        question(c5, "Les règles d'école sont plus efficaces quand :",
                List.of("Chaque enseignant a les siennes", "Elles sont communes et construites ensemble", "Elles sont secrètes"), 1, null);
        courses.save(c5);

        // ---------- Test d'entree ----------
        placementQ(1, "Qu'aimeriez-vous améliorer en premier ?", Set.of(),
                new PlacementOption("Le calme dans ma classe", "wind", c1.getTitle()),
                new PlacementOption("L'entraide entre les élèves", "handshake", c2.getTitle()),
                new PlacementOption("Les relations à la maison", "home", c3.getTitle()),
                new PlacementOption("Utiliser mon téléphone", "smartphone", c4.getTitle()));
        placementQ(2, "Quand un élève se met en colère, vous vous sentez :", Set.of(Role.ENSEIGNANT, Role.DIRECTION_ECOLE),
                new PlacementOption("À l'aise", "smile", c2.getTitle()),
                new PlacementOption("Parfois dépassé·e", "meh", c1.getTitle()),
                new PlacementOption("Souvent dépassé·e", "frown", c1.getTitle()));
        placementQ(3, "Avez-vous déjà animé un jeu coopératif ?", Set.of(Role.ENSEIGNANT, Role.TRAVAILLEUR_SOCIAL),
                new PlacementOption("Jamais", "hand", c2.getTitle()),
                new PlacementOption("Quelquefois", "thumbs-up", c1.getTitle()),
                new PlacementOption("Souvent", "star", null));
        placementQ(4, "Comment préférez-vous apprendre ?", Set.of(),
                new PlacementOption("En écoutant", "headphones", null),
                new PlacementOption("En regardant des vidéos", "video", null),
                new PlacementOption("En lisant", "book-open", null));

        // ---------- Communaute ----------
        ForumThread welcome = new ForumThread();
        welcome.setTitle("Séance en direct : la météo des émotions en classe");
        welcome.setBody("Rejoignez la visioconférence mensuelle de la communauté du Borgou. Venez avec vos questions et vos réussites !");
        welcome.setAuthor(conseiller);
        welcome.setCountryCode("BJ");
        welcome.setCourseId(c1.getId());
        welcome.setPinned(true);
        welcome.setMeetingUrl("https://meet.jit.si/communaute-pratique-borgou-demo");
        welcome.setMeetingAt(Instant.now().plus(Duration.ofDays(3)));
        ForumPost p1 = new ForumPost();
        p1.setThread(welcome);
        p1.setAuthor(enseignant);
        p1.setBody("J'ai essayé la météo des émotions ce matin : les élèves ont adoré dessiner leur soleil ! Comment faire avec 80 élèves ?");
        welcome.getPosts().add(p1);
        ForumPost p2 = new ForumPost();
        p2.setThread(welcome);
        p2.setAuthor(conseiller);
        p2.setBody("Bravo Rachida ! Avec un grand effectif, faites lever la main par météo : soleil, nuage, pluie, orage. 2 minutes suffisent.");
        welcome.getPosts().add(p2);
        threads.save(welcome);

        ForumThread q = new ForumThread();
        q.setTitle("Idées de jeux coopératifs sans matériel ?");
        q.setBody("Partagez vos jeux qui marchent dans une cour sans matériel.");
        q.setAuthor(enseignant);
        q.setCountryCode("BJ");
        q.setCourseId(c2.getId());
        threads.save(q);

        simulateCohort(List.of(c1, c2), conseiller);
        log.info("Données de démonstration créées (mot de passe démo : {})", DEMO_PASSWORD);
    }

    /**
     * 60 enseignant·es fictifs repartis dans 4 departements, groupes TRAITEMENT / CONTROLE, avec une activite
     * realiste : progression partielle, usage hors ligne, tentatives au quiz (la question 2 du module 1 piege
     * volontairement une partie des apprenants pour illustrer l'analyse des erreurs), retours d'experience.
     */
    private void simulateCohort(List<Course> mods, AppUser mentor) {
        Random rnd = new Random(42);
        Instant now = Instant.now();
        String[] comments = {"Très utile, j'ai essayé dès le lendemain.", "La vidéo est claire mais un peu longue à charger.",
                "J'aimerais plus d'exemples pour les grandes classes.", "La partie sur la crise de colère n'est pas assez claire.",
                "Bien expliqué, merci.", "L'audio est pratique, je l'écoute sur le chemin de l'école.",
                "Je ne comprends pas la différence entre punir et poser une limite."};
        for (int i = 1; i <= 60; i++) {
            String region = REGIONS.get(i % REGIONS.size());
            AppUser u = user(String.format("apprenant%03d@demo.local", i), DEMO_PASSWORD, String.format("Enseignant·e %03d", i),
                    Role.ENSEIGNANT, "BJ", region, i % 2 == 0 ? "TRAITEMENT" : "CONTROLE");
            u.setPlacementDone(true);
            u.setCreatedAt(now.minus(Duration.ofDays(30 + rnd.nextInt(10))));
            int logins = 2 + rnd.nextInt(14);
            Instant last = now.minus(Duration.ofDays(rnd.nextInt(25)));
            for (int k = 0; k < logins; k++) {
                ActivityEvent e = new ActivityEvent(u.getId(), ActivityEvent.Type.LOGIN, 0);
                e.setAt(now.minus(Duration.ofHours(rnd.nextInt(24 * 27))));
                activity.save(e);
            }
            u.setLastActiveAt(last);
            for (Course c : mods) {
                double engagement = rnd.nextDouble();
                if (engagement < 0.15) continue; // jamais commence
                int done = engagement > 0.45 ? c.getLessons().size() : 1 + rnd.nextInt(Math.max(1, c.getLessons().size() - 1));
                // activite etalee sur les 3 dernieres semaines (courbe d'activite du tableau de bord)
                Instant t = now.minus(Duration.ofDays(4 + rnd.nextInt(18)));
                for (int l = 0; l < done; l++) {
                    LessonProgress p = new LessonProgress();
                    p.setUser(u);
                    p.setLesson(c.getLessons().get(l));
                    t = t.plus(Duration.ofHours(6 + rnd.nextInt(60)));
                    p.setCompletedAt(t.isAfter(now) ? now.minus(Duration.ofHours(rnd.nextInt(48))) : t);
                    p.setTimeSpentSeconds(c.getLessons().get(l).getDurationMinutes() * 60 + rnd.nextInt(600));
                    p.setCompletedOffline(rnd.nextDouble() < 0.55);
                    progress.save(p);
                }
                if (done == c.getLessons().size()) {
                    int n = c.getQuestions().size();
                    List<String> answers = new ArrayList<>();
                    int good = 0;
                    for (int qi = 0; qi < n; qi++) {
                        QuizQuestion qq = c.getQuestions().get(qi);
                        boolean trap = c == mods.getFirst() && qi == 1;
                        boolean ok = rnd.nextDouble() > (trap ? 0.58 : 0.18);
                        int a = ok ? qq.getCorrectIndex() : (trap ? 0 : (qq.getCorrectIndex() + 1 + rnd.nextInt(qq.getOptions().size() - 1)) % qq.getOptions().size());
                        if (ok) good++;
                        answers.add(String.valueOf(a));
                    }
                    QuizAttempt at = new QuizAttempt();
                    at.setUser(u);
                    at.setCourse(c);
                    at.setScorePercent(Math.round(good * 100f / n));
                    at.setPassed(at.getScorePercent() >= c.getPassScore());
                    at.setAnswers(String.join(",", answers));
                    at.setAttemptedAt(t.plus(Duration.ofHours(2)));
                    attempts.save(at);
                    if (rnd.nextDouble() < 0.6) {
                        CourseFeedback f = new CourseFeedback();
                        f.setUser(u);
                        f.setCourse(c);
                        f.setRating(3 + rnd.nextInt(3));
                        f.setClarity(2 + rnd.nextInt(4));
                        f.setUsefulness(3 + rnd.nextInt(3));
                        f.setComment(rnd.nextDouble() < 0.6 ? comments[rnd.nextInt(comments.length)] : null);
                        feedbacks.save(f);
                    }
                    if (c.getType() == CourseType.PRATIQUE && rnd.nextDouble() < 0.4) {
                        PortfolioItem pi = new PortfolioItem();
                        pi.setUser(u);
                        pi.setCourse(c);
                        pi.setLesson(c.getLessons().getFirst());
                        pi.setText("Jeu de la rivière avec ma classe de CE1 : les élèves ont d'abord voulu passer seuls, puis ont compris qu'il fallait s'organiser ensemble.");
                        boolean reviewed = rnd.nextBoolean();
                        pi.setStatus(reviewed ? PortfolioItem.Status.VALIDE : PortfolioItem.Status.SOUMIS);
                        if (reviewed) {
                            pi.setMentor(mentor);
                            pi.setMentorFeedback("Belle observation. Pensez à noter la durée et le nombre d'élèves.");
                            pi.setReviewedAt(t.plus(Duration.ofDays(2)));
                        }
                        portfolios.save(pi);
                    }
                }
                certification.evaluate(u, c);
            }
            users.save(u);
        }
    }

    /** Anciennes versions : pictogrammes en emoji. L'interface utilise desormais des icones SVG nommees. */
    private static final Map<String, String> EMOJI_TO_ICON = Map.ofEntries(
            Map.entry("🌦️", "cloud-sun"), Map.entry("🌦", "cloud-sun"), Map.entry("🤝", "handshake"), Map.entry("👪", "family"),
            Map.entry("📱", "smartphone"), Map.entry("🏫", "school"), Map.entry("📘", "book-open"), Map.entry("🧘", "wind"),
            Map.entry("🏠", "home"), Map.entry("🙂", "smile"), Map.entry("😟", "meh"), Map.entry("😣", "frown"),
            Map.entry("✋", "hand"), Map.entry("👍", "thumbs-up"), Map.entry("⭐", "star"), Map.entry("🎧", "headphones"),
            Map.entry("🎬", "video"), Map.entry("📖", "book-open"));

    private void migrateEmojiIcons() {
        for (Course c : courses.findAll()) {
            if (c.getIcon() != null && !c.getIcon().matches("[a-z-]+")) {
                c.setIcon(EMOJI_TO_ICON.getOrDefault(c.getIcon(), "book-open"));
            }
        }
        for (PlacementQuestion q : placement.findAll()) {
            for (PlacementOption o : q.getOptions()) {
                if (o.getIcon() != null && !o.getIcon().matches("[a-z-]+")) {
                    o.setIcon(EMOJI_TO_ICON.getOrDefault(o.getIcon(), "circle"));
                }
            }
        }
    }

    private void copyDemoMedia() throws IOException {
        Files.createDirectories(mediaDir);
        for (String f : List.of(VIDEO, AUDIO, VTT)) {
            Path target = mediaDir.resolve(f);
            if (Files.exists(target)) continue;
            try (InputStream in = getClass().getResourceAsStream("/demo-media/" + f)) {
                if (in != null) Files.copy(in, target);
            }
        }
    }

    private String resource(String path) {
        try (InputStream in = getClass().getResourceAsStream("/" + path)) {
            return in == null ? "" : new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }

    private long size(String file) {
        try {
            return Files.size(mediaDir.resolve(file));
        } catch (IOException e) {
            return 0;
        }
    }

    private AppUser user(String email, String password, String name, Role role, String country, String region, String cohort) {
        AppUser u = new AppUser();
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setFullName(name);
        u.setRole(role);
        u.setCountryCode(country);
        u.setLanguageCode("fr");
        u.setRegion(region);
        u.setCohort(cohort);
        u.setDataConsent(true);
        return users.save(u);
    }

    private Course course(String title, String icon, String desc, CourseType type, String country, Set<Role> roles) {
        Course c = new Course();
        c.setTitle(title);
        c.setIcon(icon);
        c.setDescription(desc);
        c.setType(type);
        c.setCountryCode(country);
        c.setLanguageCode("fr");
        c.getTargetRoles().addAll(roles);
        return c;
    }

    private void text(Course c, String title, String content, String task, int minutes) {
        media(c, title, MediaType.TEXT, null, null, content, task, minutes);
    }

    private void media(Course c, String title, MediaType type, String file, String vtt, String content, String task, int minutes) {
        Lesson l = new Lesson();
        l.setCourse(c);
        l.setPosition(c.getLessons().size() + 1);
        l.setTitle(title);
        l.setMediaType(type);
        if (file != null) {
            l.setMediaUrl("/api/media/" + file);
            l.setMediaSizeBytes(size(file));
        }
        if (vtt != null) l.setSubtitlesUrl("/api/media/" + vtt);
        l.setContent(content.strip());
        l.setPracticeTask(task);
        l.setDurationMinutes(minutes);
        c.getLessons().add(l);
    }

    private void question(Course c, String text, List<String> options, int correct, String explanation) {
        QuizQuestion q = new QuizQuestion();
        q.setCourse(c);
        q.setQuestion(text);
        q.getOptions().addAll(options);
        q.setCorrectIndex(correct);
        q.setExplanation(explanation);
        c.getQuestions().add(q);
    }

    private void placementQ(int pos, String text, Set<Role> roles, PlacementOption... options) {
        PlacementQuestion q = new PlacementQuestion();
        q.setPosition(pos);
        q.setQuestion(text);
        q.getRoles().addAll(roles);
        q.getOptions().addAll(List.of(options));
        placement.save(q);
    }
}
