package org.formation.api.config;

import org.formation.api.domain.*;
import org.formation.api.repository.*;
import org.formation.api.service.CertificationService;
import org.formation.api.service.ClassroomLocks;
import org.formation.api.service.ProgramService;
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
import java.time.*;
import java.util.*;

/**
 * Donnees de reference + jeu de demonstration (serveur de test, APP_SEED_DEMO=true) :
 * 6 domaines, 17 modules, 6 programmes, 6 ecoles, 8 fiches, 4 classes (en cours, terminee avec podium,
 * a venir, parents) et une activite simulee coherente avec le calendrier de chaque classe.
 */
@Component
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private static final String DEMO_PASSWORD = "Demo1234!";
    private static final String VIDEO = "5b3a9c71-2e6d-4a0f-8c47-9d1e3f6a2b33.mp4";
    private static final String AUDIO = "8f1c2a6e-0b4d-4c55-9a51-3c7e2b9d0a11.mp3";
    private static final String VTT = "2d7e9b40-5a3c-4f8e-b1d2-6c9a0e4f7b22.vtt";
    private static final String[] FIRST = {"Aminata", "Issa", "Rafiatou", "Moussa", "Félicité", "Boni", "Mariam", "Séidou",
            "Clarisse", "Yacoubou", "Nafissatou", "Gérard", "Haoua", "Orou", "Bernadette", "Soulé", "Adjara", "Dramane",
            "Victorine", "Karim", "Zénabou", "Pascal", "Assiba", "Idrissou", "Prudence", "Chabi", "Fati", "Lazare"};
    private static final String[] LAST = {"Bio", "Sabi", "Gounou", "Orou", "Yarou", "Kora", "Bagnan", "Tamou", "Worou",
            "Sanni", "Boukari", "Djibril", "Adamou", "Imorou", "Zato", "Moussa", "Kpéra", "Saka"};

    private final CountryRepository countries;
    private final LanguageRepository languages;
    private final AppUserRepository users;
    private final CourseRepository courses;
    private final PlacementQuestionRepository placement;
    private final ForumThreadRepository threads;
    private final ForumPostRepository posts;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final CourseFeedbackRepository feedbacks;
    private final ActivityEventRepository activity;
    private final PortfolioItemRepository portfolios;
    private final DomainRepository domains;
    private final ProgramRepository programs;
    private final SchoolRepository schools;
    private final ClassroomRepository classrooms;
    private final ResourceRepository resources;
    private final CertificationService certification;
    private final ProgramService programService;
    private final PasswordEncoder encoder;
    private final boolean demoData;
    private final String adminPassword;
    private final Path mediaDir;
    private final Random rnd = new Random(2026);
    private int nameSeq = 0;

    public DataInitializer(CountryRepository countries, LanguageRepository languages, AppUserRepository users,
                           CourseRepository courses, PlacementQuestionRepository placement, ForumThreadRepository threads,
                           ForumPostRepository posts, LessonProgressRepository progress, QuizAttemptRepository attempts,
                           CourseFeedbackRepository feedbacks, ActivityEventRepository activity,
                           PortfolioItemRepository portfolios, DomainRepository domains, ProgramRepository programs,
                           SchoolRepository schools, ClassroomRepository classrooms, ResourceRepository resources,
                           CertificationService certification, ProgramService programService, PasswordEncoder encoder,
                           @Value("${app.seed.demo-data:true}") boolean demoData,
                           @Value("${app.seed.admin-password}") String adminPassword,
                           @Value("${app.media.dir:./data/media}") String mediaDir) {
        this.countries = countries;
        this.languages = languages;
        this.users = users;
        this.courses = courses;
        this.placement = placement;
        this.threads = threads;
        this.posts = posts;
        this.progress = progress;
        this.attempts = attempts;
        this.feedbacks = feedbacks;
        this.activity = activity;
        this.portfolios = portfolios;
        this.domains = domains;
        this.programs = programs;
        this.schools = schools;
        this.classrooms = classrooms;
        this.resources = resources;
        this.certification = certification;
        this.programService = programService;
        this.encoder = encoder;
        this.demoData = demoData;
        this.adminPassword = adminPassword;
        this.mediaDir = Path.of(mediaDir);
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (countries.count() == 0) {
            countries.saveAll(List.of(new Country("BJ", "Bénin", true), new Country("CI", "Côte d'Ivoire", true),
                    new Country("CH", "Suisse", true), new Country("FR", "France", true)));
        }
        if (languages.count() == 0) {
            languages.saveAll(List.of(new Language("fr", "Français", true), new Language("en", "English", true),
                    new Language("bba", "Baatonum", true), new Language("ddn", "Dendi", true), new Language("fon", "Fongbe", true)));
        }
        if (!users.existsByEmailIgnoreCase("admin@demo.local")) {
            user("admin@demo.local", adminPassword, "Administrateur Démo", Role.ADMIN, "CH", null, null, null);
        }
        copyDemoMedia();
        migrateEmojiIcons();
        if (demoData && courses.count() == 0) {
            seed();
            log.info("Données de démonstration créées (mot de passe démo : {})", DEMO_PASSWORD);
        }
        programService.autoCloseAll();
    }

    // =====================================================================
    // Jeu de demonstration
    // =====================================================================

    private void seed() {
        // ---------- Domaines ----------
        Domain dSel = domain(1, "Compétences socio-émotionnelles", "cloud-sun", "Reconnaître et réguler ses émotions, celles des enfants.");
        Domain dCoop = domain(2, "Coopération et climat de classe", "handshake", "Apprendre ensemble, s'entraider, vivre un climat serein.");
        Domain dPrev = domain(3, "Prévention des violences", "shield", "Prévenir les conflits, protéger les enfants, orienter.");
        Domain dPar = domain(4, "Parentalité positive", "family", "Accompagner son enfant à la maison, sans violence.");
        Domain dNum = domain(5, "Numérique et insertion", "smartphone", "Utiliser le numérique, se remettre à niveau, trouver sa voie.");
        Domain dPil = domain(6, "Pilotage et accompagnement", "compass", "Accompagner les équipes, animer, piloter l'école.");

        // ---------- Etablissements ----------
        School sParakou = school("EPP Parakou Ganou", "Borgou", "Parakou");
        School sTchaourou = school("EPP Tchaourou Centre", "Borgou", "Tchaourou");
        School sKandi = school("EPP Kandi Centre", "Alibori", "Kandi");
        School sBanikoara = school("EPP Banikoara", "Alibori", "Banikoara");
        School sNatitingou = school("EPP Natitingou 2", "Atacora", "Natitingou");
        School sDjougou = school("EPP Djougou Est", "Donga", "Djougou");

        // ---------- Personnes de demonstration ----------
        AppUser formateur = user("formateur@demo.local", DEMO_PASSWORD, "Aïcha Formatrice", Role.FORMATEUR, "BJ", "Borgou", null, null);
        AppUser moussa = user("conseiller@demo.local", DEMO_PASSWORD, "Moussa Conseiller", Role.CONSEILLER_PEDAGOGIQUE, "BJ", "Borgou", null, null);
        AppUser fatou = user("conseillere2@demo.local", DEMO_PASSWORD, "Fatou Conseillère", Role.CONSEILLER_PEDAGOGIQUE, "BJ", "Atacora", null, null);
        AppUser rachida = user("enseignant@demo.local", DEMO_PASSWORD, "Rachida Enseignante", Role.ENSEIGNANT, "BJ", "Borgou", "TRAITEMENT", sParakou);
        AppUser parent = user("parent@demo.local", DEMO_PASSWORD, "Bio Parent", Role.PARENT, "BJ", "Borgou", null, null);
        user("jeune@demo.local", DEMO_PASSWORD, "Sani Jeune", Role.JEUNE, "BJ", "Alibori", null, null);
        user("direction@demo.local", DEMO_PASSWORD, "Directrice Démo", Role.DIRECTION_ECOLE, "BJ", "Borgou", "TRAITEMENT", sParakou);
        user("social@demo.local", DEMO_PASSWORD, "Awa Assistante sociale", Role.TRAVAILLEUR_SOCIAL, "BJ", "Borgou", null, null);

        Set<Role> teachers = Set.of(Role.ENSEIGNANT, Role.CONSEILLER_PEDAGOGIQUE, Role.DIRECTION_ECOLE);

        // =================== MODULES ===================
        // ---- 1. Gerer ses emotions en classe (texte + video + audio)
        Course m1 = course("Gérer ses émotions en classe", "cloud-sun", dSel,
                "Reconnaître, nommer et réguler les émotions pour un climat de classe apaisé. Vidéo, audio et fiches pratiques.",
                CourseType.THEORIQUE, teachers);
        text(m1, "Pourquoi parler des émotions ?", """
                Les émotions influencent l'attention, la mémoire et les relations.
                Un élève submergé par la colère ou la peur apprend moins bien.

                **À retenir**
                - Toutes les émotions sont légitimes, tous les comportements ne le sont pas.
                - L'adulte montre l'exemple par sa propre régulation.
                - Nommer une émotion aide déjà à la calmer.
                """, null, 6);
        media(m1, "La météo des émotions", MediaType.VIDEO, VIDEO, VTT, resource("demo-media/video-transcript.txt"), null, 2);
        media(m1, "Technique de retour au calme", MediaType.AUDIO, AUDIO, null, resource("demo-media/audio-transcript.txt"),
                "Pratiquez la respiration 4-6 avec votre classe trois matins de suite. Notez ce que vous observez.", 2);
        text(m1, "Réagir à une crise de colère", """
                Pendant la crise, la priorité est la sécurité et le calme, pas la leçon de morale.

                1. Se placer à hauteur de l'élève, parler doucement.
                2. Nommer l'émotion : « Je vois que tu es très en colère. »
                3. Proposer le coin calme ou la respiration apprise à froid.
                4. Parler de ce qui s'est passé plus tard, quand l'élève est calme.

                **Erreur fréquente** : punir pendant la crise. Cela augmente la tension.
                """, null, 8);
        question(m1, "Quand faut-il enseigner une technique de retour au calme ?",
                List.of("Pendant la crise", "À froid, quand tout va bien", "Uniquement aux élèves agités"), 1,
                "On l'apprend à froid pour pouvoir l'utiliser pendant la crise.");
        question(m1, "Pendant une crise de colère, la priorité est :",
                List.of("Faire la leçon de morale", "Punir immédiatement", "La sécurité et le retour au calme"), 2,
                "La discussion vient après, quand l'élève est calme.");
        question(m1, "La météo des émotions sert à :",
                List.of("Noter les élèves", "Aider les élèves à nommer ce qu'ils ressentent", "Remplacer la leçon"), 1,
                "Nommer ses émotions aide à les comprendre.");
        question(m1, "Quelle affirmation est juste ?",
                List.of("Certaines émotions sont interdites", "Toutes les émotions sont légitimes", "Il faut cacher ses émotions"), 1,
                "Ce sont les comportements qui se règlent, pas les émotions.");
        courses.save(m1);

        // ---- 2. Ecouter et communiquer avec bienveillance
        Course m2 = course("Écouter et communiquer avec bienveillance", "message-heart", dSel,
                "L'écoute active et le message « je » pour désamorcer les tensions et renforcer la confiance des élèves.",
                CourseType.THEORIQUE, teachers);
        text(m2, "L'écoute active en 3 gestes", """
                Écouter vraiment, c'est montrer à l'élève qu'il compte.

                1. **Regarder** l'élève, se mettre à sa hauteur.
                2. **Reformuler** : « Si je comprends bien, tu es déçu parce que… »
                3. **Ne pas juger tout de suite** : on cherche d'abord à comprendre.

                Un élève écouté accepte plus facilement les règles.
                """, null, 7);
        text(m2, "Le message « je »", """
                Au lieu de « Tu es insupportable ! », dites ce que vous ressentez et ce dont vous avez besoin :

                « **Je** suis inquiète quand tu cours dans la classe, **parce que** quelqu'un peut tomber. **J'ai besoin** que tu marches. »

                Le message « je » décrit un comportement, pas la personne. Il évite l'humiliation et laisse à l'élève une chance de changer.
                """, "Utilisez trois messages « je » cette semaine. Notez la réaction des élèves.", 8);
        text(m2, "Encourager plutôt que punir", """
                Un encouragement précis vaut mieux qu'un compliment général :
                - « Bravo » → peu d'effet.
                - « Tu as relu ta phrase et corrigé deux fautes, c'est du beau travail » → l'élève sait quoi refaire.

                Visez **4 encouragements pour 1 remarque** : le climat de la classe change en quelques semaines.
                """, null, 6);
        question(m2, "Reformuler ce que dit un élève permet surtout :",
                List.of("De gagner du temps", "De lui montrer qu'il est compris", "De le corriger"), 1,
                "La reformulation montre l'écoute et apaise.");
        question(m2, "Quel message est un message « je » ?",
                List.of("Tu es paresseux", "Je suis inquiète quand tu cours, quelqu'un peut tomber", "Tais-toi immédiatement"), 1,
                "Il décrit le comportement, l'émotion et le besoin, sans étiqueter l'élève.");
        question(m2, "Un encouragement efficace est :",
                List.of("Général : « bravo »", "Précis sur ce que l'élève a fait", "Réservé aux meilleurs élèves"), 1,
                "Précis, il indique ce qu'il faut refaire.");
        courses.save(m2);

        // ---- 3. Cooperer plutot que s'opposer (pratique)
        Course m3 = course("Coopérer plutôt que s'opposer", "handshake", dCoop,
                "Parcours pratique : animer des jeux coopératifs et documenter l'expérience dans son portfolio.",
                CourseType.PRATIQUE, Set.of(Role.ENSEIGNANT, Role.TRAVAILLEUR_SOCIAL, Role.CONSEILLER_PEDAGOGIQUE));
        text(m3, "Le principe des jeux coopératifs", """
                Dans un jeu coopératif, tout le monde gagne ou tout le monde perd ensemble.
                L'objectif est de développer l'entraide et l'écoute plutôt que la compétition.

                **Exemple** : la rivière. Le groupe doit traverser une « rivière » tracée au sol en n'utilisant que trois « pierres » (feuilles) qu'il faut faire passer de main en main.
                """, "Organisez un jeu coopératif de 15 minutes avec votre groupe. Filmez 30 secondes (sans visage d'enfant reconnaissable) ou décrivez ce que vous avez observé.", 10);
        text(m3, "Débriefer avec les participants", """
                Après le jeu, posez trois questions :
                1. Qu'est-ce qui a bien marché ?
                2. Qu'est-ce qui a été difficile ?
                3. Qu'est-ce qu'on ferait autrement ?
                """, "Faites un débriefing avec les trois questions et notez deux réponses marquantes.", 10);
        question(m3, "Dans un jeu coopératif :",
                List.of("Un seul joueur gagne", "Tout le groupe gagne ou perd ensemble", "Il n'y a pas de règles"), 1, "La réussite est collective.");
        question(m3, "Le débriefing sert à :",
                List.of("Désigner un gagnant", "Tirer des enseignements de l'expérience", "Sanctionner les erreurs"), 1, null);
        courses.save(m3);

        // ---- 4. Prevenir et resoudre les conflits
        Course m4 = course("Prévenir et résoudre les conflits entre élèves", "shield", dPrev,
                "Repérer les tensions tôt, arbitrer sans prendre parti et apprendre aux élèves à résoudre eux-mêmes leurs conflits.",
                CourseType.THEORIQUE, Set.of(Role.ENSEIGNANT, Role.CONSEILLER_PEDAGOGIQUE, Role.TRAVAILLEUR_SOCIAL));
        text(m4, "Un conflit n'est pas une violence", """
                Le désaccord est normal entre enfants. Il devient violence quand il y a **intention de faire mal** ou **rapport de force répété**.

                Signes à surveiller :
                - un élève toujours isolé à la récréation ;
                - des moqueries répétées sur le même enfant ;
                - un changement brusque d'humeur ou de résultats.
                """, null, 7);
        text(m4, "La méthode des 4 étapes", """
                Quand deux élèves se disputent :
                1. **Stop** : séparer, laisser redescendre la colère.
                2. **Chacun parle** à son tour, sans être coupé.
                3. **On cherche ensemble** au moins deux solutions.
                4. **On choisit** une solution et on vérifie plus tard qu'elle tient.

                L'adulte guide, mais ce sont les élèves qui trouvent la solution : ils apprennent à le faire seuls.
                """, "Appliquez la méthode des 4 étapes lors du prochain conflit. Décrivez ce qui s'est passé.", 9);
        text(m4, "Former des élèves médiateurs", """
                Dans les grandes classes, deux élèves volontaires par semaine peuvent aider leurs camarades à appliquer les 4 étapes pendant la récréation.

                Ils sont reconnaissables (un brassard), formés en 30 minutes et peuvent toujours appeler un adulte.
                """, null, 6);
        question(m4, "Un conflit devient une violence quand :",
                List.of("Deux élèves ne sont pas d'accord", "Il y a intention de faire mal ou rapport de force répété", "Les élèves parlent fort"), 1, null);
        question(m4, "Dans la méthode des 4 étapes, qui trouve la solution ?",
                List.of("L'enseignant seul", "Les élèves concernés, guidés par l'adulte", "Le directeur"), 1,
                "C'est ce qui leur apprend à résoudre seuls les conflits.");
        question(m4, "Quel signe doit alerter ?",
                List.of("Un élève toujours isolé à la récréation", "Un élève qui lève la main", "Un élève qui pose des questions"), 0, null);
        courses.save(m4);

        // ---- 5. Discipline positive
        Course m5 = course("Discipline positive : règles et conséquences", "target", dPrev,
                "Construire des règles avec les élèves, appliquer des conséquences éducatives et renoncer aux punitions corporelles.",
                CourseType.THEORIQUE, Set.of(Role.ENSEIGNANT, Role.DIRECTION_ECOLE, Role.CONSEILLER_PEDAGOGIQUE));
        text(m5, "Des règles construites ensemble", """
                Une règle comprise est mieux respectée qu'une règle imposée.

                En début d'année, demandez aux élèves : « De quoi avons-nous besoin pour bien apprendre ensemble ? »
                Gardez **5 règles maximum**, formulées positivement : « Nous levons la main pour parler » plutôt que « Ne pas crier ».
                """, "Construisez les règles de classe avec vos élèves et affichez-les.", 8);
        text(m5, "Conséquence éducative ou punition ?", """
                Une **conséquence éducative** est liée à la faute, respecte l'enfant et l'aide à réparer :
                - il a sali le mur → il aide à le nettoyer ;
                - il a blessé un camarade avec des mots → il cherche comment réparer.

                Les **punitions corporelles** sont interdites par la loi au Bénin, abîment la relation et n'apprennent rien à l'enfant, sauf la peur.
                """, null, 8);
        question(m5, "Une bonne règle de classe est :",
                List.of("Imposée sans explication", "Construite avec les élèves et formulée positivement", "Longue et détaillée"), 1, null);
        question(m5, "Un élève a sali le mur. Une conséquence éducative est :",
                List.of("Le frapper", "L'aider à nettoyer le mur", "Le priver de récréation pendant un mois"), 1,
                "La conséquence est liée à la faute et permet de réparer.");
        courses.save(m5);

        // ---- 6. Climat de classe (pratique)
        Course m6 = course("Un climat de classe où chacun apprend", "sprout", dCoop,
                "Rituels, coin calme, tutorat entre pairs : des pratiques simples pour une classe sereine, même avec 80 élèves.",
                CourseType.PRATIQUE, teachers);
        text(m6, "Les rituels qui sécurisent", """
                Les élèves apprennent mieux quand la journée est prévisible.
                - **Accueil** : un mot ou un geste pour chaque élève à l'entrée.
                - **Météo des émotions** le matin (2 minutes).
                - **Bilan** en fin de journée : « Qu'avons-nous appris ? »
                """, "Installez un rituel d'accueil pendant une semaine et décrivez l'effet sur la classe.", 6);
        text(m6, "Le tutorat entre pairs dans les grandes classes", """
                Avec 60 à 80 élèves, l'enseignant ne peut pas aider tout le monde.
                Formez des binômes : un élève qui a compris explique à un camarade. Les deux progressent.

                **Conseil** : changez les binômes chaque mois et valorisez l'aide apportée.
                """, "Organisez une séance de tutorat entre pairs. Combien d'élèves ont progressé ?", 8);
        question(m6, "Pourquoi installer des rituels ?",
                List.of("Pour remplir le temps", "Pour rendre la journée prévisible et rassurante", "Pour contrôler les élèves"), 1, null);
        question(m6, "Dans le tutorat entre pairs :",
                List.of("Seul l'élève aidé progresse", "Les deux élèves progressent", "Personne ne progresse"), 1,
                "Expliquer consolide aussi les connaissances du tuteur.");
        courses.save(m6);

        // ---- 7. Observer une classe (conseillers)
        Course m7 = course("Observer une classe et donner un retour utile", "eye", dPil,
                "Pour les conseiller·ères : préparer une visite, observer avec une grille simple, conduire un entretien qui fait progresser.",
                CourseType.THEORIQUE, Set.of(Role.CONSEILLER_PEDAGOGIQUE, Role.DIRECTION_ECOLE));
        text(m7, "Une grille d'observation en 4 points", """
                Observez ce qui compte pour le climat de classe :
                1. Les **rituels** (accueil, météo des émotions).
                2. La **gestion des conflits**.
                3. Les **encouragements** donnés (comptez-les).
                4. La **participation** des élèves en difficulté.
                """, null, 7);
        text(m7, "L'entretien qui fait progresser", """
                Après la visite :
                1. Laissez d'abord l'enseignant·e dire ce qui a marché.
                2. Donnez **un** point fort précis et **un** axe de progrès.
                3. Convenez ensemble d'une action pour la prochaine visite.

                On n'inspecte pas, on accompagne.
                """, "Conduisez un entretien de retour avec un·e enseignant·e et notez l'action convenue.", 8);
        question(m7, "Après une observation, on commence par :",
                List.of("La liste des erreurs", "Laisser l'enseignant·e dire ce qui a marché", "La note de l'inspection"), 1, null);
        question(m7, "Combien d'axes de progrès proposer à la fois ?",
                List.of("Un seul, précis", "Au moins cinq", "Aucun"), 0, "Un seul axe précis est plus facile à mettre en œuvre.");
        courses.save(m7);

        // ---- 8. Animer une communaute de pratique (pratique)
        Course m8 = course("Animer une communauté de pratique", "users", dPil,
                "Préparer et animer une séance d'échange entre enseignant·es, en présentiel ou en visioconférence.",
                CourseType.PRATIQUE, Set.of(Role.CONSEILLER_PEDAGOGIQUE, Role.FORMATEUR));
        text(m8, "Une séance en 45 minutes", """
                - 5 min : accueil et météo des émotions des participant·es.
                - 15 min : une enseignante partage une réussite (vidéo ou récit).
                - 15 min : questions et conseils entre pairs.
                - 10 min : chacun choisit une action à essayer avant la prochaine séance.
                """, "Animez une séance de communauté de pratique et partagez le compte rendu.", 8);
        question(m8, "Le cœur d'une communauté de pratique est :",
                List.of("Un cours magistral", "Le partage d'expériences entre pairs", "Une inspection"), 1, null);
        courses.save(m8);

        // ---- 9. Piloter un climat scolaire positif (directions)
        Course m9 = course("Piloter un climat scolaire positif", "school", dPil,
                "Pour les directions d'école : fixer des règles communes, suivre les incidents et soutenir les enseignant·es.",
                CourseType.THEORIQUE, Set.of(Role.DIRECTION_ECOLE, Role.CONSEILLER_PEDAGOGIQUE));
        text(m9, "Des règles communes à toute l'école", """
                Un climat apaisé repose sur quelques règles simples, connues de tous et appliquées de la même façon dans chaque classe.
                Construisez-les avec les enseignant·es et les élèves délégués.
                """, null, 8);
        text(m9, "Suivre les incidents sans stigmatiser", """
                Un cahier d'incidents simple (date, lieu, type, suite donnée) permet de repérer les lieux et moments à risque : toilettes, sortie, récréation.

                Analysez-le chaque mois en équipe : **on cherche des solutions, pas des coupables**.
                """, null, 7);
        question(m9, "Les règles d'école sont plus efficaces quand :",
                List.of("Chaque enseignant a les siennes", "Elles sont communes et construites ensemble", "Elles sont secrètes"), 1, null);
        question(m9, "Le cahier d'incidents sert surtout à :",
                List.of("Punir les élèves", "Repérer les lieux et moments à risque", "Remplir un rapport"), 1, null);
        courses.save(m9);

        // ---- 10. Soutenir la formation de son equipe (directions)
        Course m10 = course("Soutenir la formation de son équipe", "graduation", dPil,
                "Suivre la progression des enseignant·es sur la plateforme, libérer du temps de formation et valoriser les réussites.",
                CourseType.THEORIQUE, Set.of(Role.DIRECTION_ECOLE));
        text(m10, "Lire le tableau de suivi de son école", """
                Votre espace « Mon école » indique pour chaque enseignant·e : la progression, la dernière activité et le statut.
                - **Actif** : activité cette semaine.
                - **Ralenti** : pas d'activité depuis 7 jours.
                - **Décroche** : plus de 14 jours sans activité.

                Un mot d'encouragement suffit souvent à relancer un·e collègue.
                """, null, 6);
        text(m10, "Créer des temps de formation", """
                Proposez 30 minutes par semaine pendant le temps de concertation pour suivre une leçon ensemble, sur un seul téléphone si besoin.
                Les modules téléchargés fonctionnent sans connexion.
                """, "Organisez un temps de formation collectif et notez le nombre de participant·es.", 6);
        question(m10, "Un·e enseignant·e est « Ralenti » quand :",
                List.of("Il ou elle n'a pas eu d'activité depuis 7 jours", "Il ou elle a échoué au quiz", "Il ou elle est absent·e de l'école"), 0, null);
        courses.save(m10);

        // ---- 11. Accompagner son enfant sans violence (parents)
        Course m11 = course("Accompagner son enfant sans violence", "family", dPar,
                "Pour les parents : écouter, poser des limites claires et résoudre les conflits à la maison. Leçons courtes à écouter.",
                CourseType.THEORIQUE, Set.of(Role.PARENT, Role.TRAVAILLEUR_SOCIAL));
        media(m11, "Se calmer avant de réagir (audio)", MediaType.AUDIO, AUDIO, null, resource("demo-media/audio-transcript.txt"), null, 2);
        text(m11, "Écouter vraiment", """
                Se mettre à hauteur de l'enfant, le regarder, reformuler ce qu'il dit :
                « Tu es triste parce que ton frère a pris ton jouet. »
                L'enfant qui se sent compris se calme plus vite.
                """, null, 5);
        text(m11, "Poser des limites sans frapper", """
                Une limite claire, expliquée et toujours la même est plus efficace qu'une punition violente.
                Annoncer la conséquence avant, l'appliquer calmement après.
                """, null, 5);
        question(m11, "Reformuler ce que dit l'enfant permet :",
                List.of("De le faire taire", "Qu'il se sente compris", "De gagner du temps"), 1, null);
        question(m11, "Une limite efficace est :",
                List.of("Changeante selon l'humeur", "Claire, expliquée et constante", "Toujours accompagnée d'une punition physique"), 1, null);
        courses.save(m11);

        // ---- 12. Les emotions de mon enfant (parents)
        Course m12 = course("Les émotions de mon enfant", "heart", dPar,
                "Comprendre les colères, les peurs et les pleurs de son enfant, et l'aider à les traverser.",
                CourseType.THEORIQUE, Set.of(Role.PARENT));
        text(m12, "Pourquoi mon enfant fait des colères ?", """
                Avant 6 ans, le cerveau de l'enfant ne sait pas encore bien contrôler les émotions fortes.
                Une colère n'est pas un caprice contre vous : c'est une émotion trop grande pour lui.

                Votre calme est son modèle : respirez d'abord, parlez ensuite.
                """, null, 4);
        text(m12, "Aider son enfant à nommer ce qu'il ressent", """
                Le soir, demandez : « Aujourd'hui, tu as été plutôt soleil, nuage, pluie ou orage ? »
                Écoutez sans juger. Un enfant qui sait dire « je suis en colère » frappe moins.
                """, "Essayez la météo des émotions avec votre enfant pendant trois soirs.", 4);
        question(m12, "Une colère chez un enfant de 4 ans est le plus souvent :",
                List.of("Un caprice contre le parent", "Une émotion trop grande pour lui", "Une maladie"), 1, null);
        courses.save(m12);

        // ---- 13. Jouer et apprendre en famille (parents, pratique)
        Course m13 = course("Jouer et apprendre en famille", "smile", dPar,
                "Des jeux simples, sans matériel, pour apprendre en s'amusant et renforcer le lien avec ses enfants.",
                CourseType.PRATIQUE, Set.of(Role.PARENT));
        text(m13, "10 minutes de jeu par jour", """
                Jouer avec son enfant, c'est aussi l'éduquer : il apprend à attendre son tour, à perdre, à compter.

                Idées sans matériel :
                - compter les cailloux, les marches, les poules ;
                - raconter une histoire chacun son tour ;
                - le jeu du miroir : l'enfant imite vos gestes.
                """, "Jouez 10 minutes par jour avec votre enfant pendant une semaine. Qu'avez-vous remarqué ?", 5);
        courses.save(m13);

        // ---- 14. Premiers pas avec le telephone (jeunes)
        Course m14 = course("Premiers pas avec le téléphone", "smartphone", dNum,
                "Initiation numérique : utiliser son téléphone pour apprendre, communiquer et se protéger en ligne.",
                CourseType.THEORIQUE, Set.of(Role.JEUNE));
        text(m14, "Protéger ses informations", """
                Ne partagez jamais votre mot de passe, même avec un ami.
                Une personne inconnue qui demande des photos ou de l'argent en ligne : on bloque et on en parle à un adulte de confiance.
                """, null, 5);
        text(m14, "Apprendre sans connexion", """
                Sur cette application, appuyez sur « Télécharger » quand vous avez du réseau.
                Ensuite, vous pouvez apprendre partout, même sans connexion. Votre progression sera envoyée plus tard.
                """, null, 4);
        question(m14, "Un inconnu vous demande une photo en ligne. Que faire ?",
                List.of("Envoyer la photo", "Bloquer et en parler à un adulte de confiance", "Répondre pour savoir qui c'est"), 1, null);
        courses.save(m14);

        // ---- 15. Lire, ecrire, compter au quotidien (jeunes)
        Course m15 = course("Lire, écrire, compter au quotidien", "book-open", dNum,
                "Remise à niveau pratique : lire une affiche, remplir un formulaire, calculer un prix et un rendu de monnaie.",
                CourseType.THEORIQUE, Set.of(Role.JEUNE));
        text(m15, "Calculer un rendu de monnaie", """
                Un client achète pour **750 F** et donne un billet de **1 000 F**.
                On compte à partir du prix : 750 → 800 (50) → 1 000 (200). On rend **250 F**.

                Cette méthode, « compter en avançant », évite les erreurs au marché.
                """, "Faites trois rendus de monnaie au marché ou à la boutique et vérifiez-les.", 6);
        text(m15, "Remplir un formulaire", """
                Avant d'écrire, lisez tout le formulaire. Repérez les cases obligatoires (souvent avec une étoile *).
                Écrivez en majuscules si c'est demandé. Ne signez jamais un papier que vous ne comprenez pas : demandez de l'aide.
                """, null, 5);
        question(m15, "Prix 750 F, billet de 1 000 F. Combien rendre ?",
                List.of("150 F", "250 F", "350 F"), 1, "750 → 1 000 : on rend 250 F.");
        question(m15, "Face à un papier que vous ne comprenez pas, il faut :",
                List.of("Signer quand même", "Demander de l'aide avant de signer", "Le jeter"), 1, null);
        courses.save(m15);

        // ---- 16. Trouver sa voie (jeunes)
        Course m16 = course("Trouver sa voie : métiers et formations", "compass", dNum,
                "Découvrir les métiers de sa région, les formations professionnelles et préparer un premier entretien.",
                CourseType.PRATIQUE, Set.of(Role.JEUNE));
        text(m16, "Les métiers près de chez moi", """
                Couture, mécanique, agriculture, commerce, réparation de téléphones, transformation du karité…
                Beaucoup de métiers s'apprennent en **apprentissage** auprès d'un patron, ou dans un centre de formation professionnelle.

                Commencez par lister trois métiers qui vous intéressent et une personne qui les exerce.
                """, "Rencontrez une personne qui exerce un métier qui vous intéresse et posez-lui trois questions.", 6);
        text(m16, "Se présenter en 30 secondes", """
                Préparez une présentation courte :
                1. Qui je suis.
                2. Ce que je sais faire (même hors de l'école).
                3. Ce que je cherche.

                Entraînez-vous à voix haute devant un ami.
                """, null, 5);
        question(m16, "Pour découvrir un métier, le plus utile est de :",
                List.of("Rencontrer quelqu'un qui l'exerce", "Attendre qu'on vous appelle", "Ne rien demander"), 0, null);
        courses.save(m16);

        // ---- 17. Reperer et orienter (travailleurs sociaux)
        Course m17 = course("Repérer et orienter un enfant en danger", "alert", dPrev,
                "Reconnaître les signes de maltraitance, recueillir la parole d'un enfant et orienter vers les bons services.",
                CourseType.THEORIQUE, Set.of(Role.TRAVAILLEUR_SOCIAL, Role.ENSEIGNANT, Role.DIRECTION_ECOLE, Role.CONSEILLER_PEDAGOGIQUE));
        text(m17, "Les signes qui doivent alerter", """
                Aucun signe ne prouve seul une maltraitance, mais plusieurs signes ensemble doivent alerter :
                - blessures inexpliquées ou répétées ;
                - peur de rentrer à la maison ;
                - repli soudain, absences fréquentes ;
                - fatigue, faim, hygiène très dégradée.
                """, null, 7);
        text(m17, "Recueillir la parole sans enquêter", """
                Si un enfant se confie :
                - écoutez calmement, croyez-le, remerciez-le de sa confiance ;
                - ne posez pas de questions orientées, ne promettez pas le secret ;
                - notez ses mots exacts et signalez **le jour même** à la direction et aux services sociaux.

                Votre rôle n'est pas d'enquêter mais de **protéger et orienter**.
                """, null, 8);
        question(m17, "Un enfant vous confie qu'il est frappé. Vous devez :",
                List.of("Lui promettre de garder le secret", "L'écouter, le croire et signaler le jour même", "Mener l'enquête vous-même"), 1,
                "On protège et on oriente ; l'enquête revient aux services compétents.");
        question(m17, "Un seul signe isolé (une blessure) suffit-il à conclure ?",
                List.of("Oui, toujours", "Non, mais plusieurs signes ensemble doivent alerter", "Il ne faut jamais s'en préoccuper"), 1, null);
        courses.save(m17);

        // =================== PROGRAMMES ===================
        Program pTeach = program("Formation initiale · Enseignant·e du primaire", "graduation",
                "Le parcours certifiant de référence : gestion des émotions, communication, coopération, prévention des conflits, discipline positive et climat de classe.",
                "6 modules · 8 semaines", Set.of(Role.ENSEIGNANT), CertificateLevel.BADGE, m1, m2, m3, m4, m5, m6);
        Program pCons = program("Accompagner les enseignant·es", "compass",
                "Pour les conseiller·ères pédagogiques : observer, donner un retour utile, animer une communauté de pratique et accompagner la prévention des conflits.",
                "3 modules · 4 semaines", Set.of(Role.CONSEILLER_PEDAGOGIQUE), CertificateLevel.ATTESTATION, m7, m8, m4);
        Program pDir = program("Diriger une école bienveillante", "school",
                "Pour les directions d'école : piloter le climat scolaire, soutenir la formation de l'équipe et mettre en place la discipline positive.",
                "3 modules · 4 semaines", Set.of(Role.DIRECTION_ECOLE), CertificateLevel.ATTESTATION, m9, m10, m5);
        Program pPar = program("Grandir ensemble · Parents", "family",
                "Des leçons courtes à écouter pour accompagner son enfant sans violence, comprendre ses émotions et apprendre en jouant.",
                "3 modules · 3 semaines", Set.of(Role.PARENT), CertificateLevel.ATTESTATION, m11, m12, m13);
        Program pYouth = program("Rebondir · Jeunes", "sprout",
                "Initiation numérique, remise à niveau en lecture-calcul et découverte des métiers pour construire son projet.",
                "3 modules · 6 semaines", Set.of(Role.JEUNE), CertificateLevel.ATTESTATION, m14, m15, m16);
        Program pSoc = program("Accompagner les familles · Travail social", "heart",
                "Repérer et orienter un enfant en danger, accompagner les parents, prévenir les conflits.",
                "3 modules · 4 semaines", Set.of(Role.TRAVAILLEUR_SOCIAL), CertificateLevel.ATTESTATION, m17, m11, m4);

        // =================== RESSOURCES ===================
        res("La météo des émotions · fiche activité", "cloud-sun", dSel, Set.of(Role.ENSEIGNANT, Role.PARENT, Role.CONSEILLER_PEDAGOGIQUE),
                "Une activité de 2 minutes pour aider les enfants à nommer ce qu'ils ressentent.", """
                **Durée** : 2 minutes, chaque matin.

                1. Dessinez au tableau un soleil, un nuage, la pluie et l'orage.
                2. Chaque enfant montre sa météo du moment, sans se justifier.
                3. L'adulte remercie et repère les enfants « orage » pour leur parler discrètement plus tard.

                **Variante grande classe** : lever la main par météo.
                """);
        res("Respiration 4-6 · affiche pour la classe", "wind", dSel, Set.of(Role.ENSEIGNANT, Role.PARENT, Role.JEUNE),
                "Affiche à recopier au tableau pour pratiquer le retour au calme.", """
                **Inspirer par le nez : 1, 2, 3, 4.**
                **Souffler par la bouche : 1, 2, 3, 4, 5, 6.**

                Recommencer trois fois. S'entraîner chaque matin, quand tout va bien, pour savoir le faire pendant une colère.
                """);
        res("5 jeux coopératifs sans matériel", "handshake", dCoop, Set.of(Role.ENSEIGNANT, Role.TRAVAILLEUR_SOCIAL, Role.CONSEILLER_PEDAGOGIQUE),
                "Des jeux pour la cour, de 10 à 80 participant·es.", """
                1. **La rivière** : traverser avec trois « pierres » qu'on se passe.
                2. **Le nœud humain** : se démêler sans se lâcher les mains.
                3. **Le compte collectif** : compter jusqu'à 20, un élève à la fois, sans se concerter.
                4. **La chaise musicale coopérative** : on retire des chaises mais personne n'est éliminé.
                5. **Le miroir** : par deux, imiter les gestes de l'autre.

                Toujours finir par un débriefing de 3 questions.
                """);
        res("5 phrases qui apaisent · fiche parents", "message-heart", dPar, Set.of(Role.PARENT, Role.TRAVAILLEUR_SOCIAL),
                "À garder près de soi pour les moments difficiles.", """
                - « Je vois que tu es en colère. »
                - « Je suis là, on va trouver une solution. »
                - « Respire avec moi. »
                - « Tu as le droit d'être triste. »
                - « On en reparle quand tu seras calme. »
                """);
        res("Poser une limite sans frapper · fiche parents", "shield", dPar, Set.of(Role.PARENT, Role.TRAVAILLEUR_SOCIAL),
                "Trois étapes pour se faire respecter sans violence.", """
                1. **Dire la règle** simplement : « On ne frappe pas sa sœur. »
                2. **Annoncer la conséquence** avant : « Si tu recommences, tu iras t'asseoir à côté de moi. »
                3. **L'appliquer calmement**, à chaque fois, sans crier.

                Frapper apprend à l'enfant que la force règle les problèmes. La constance lui apprend la règle.
                """);
        res("Repérer et orienter · aide-mémoire", "alert", dPrev, Set.of(Role.TRAVAILLEUR_SOCIAL, Role.ENSEIGNANT, Role.DIRECTION_ECOLE, Role.CONSEILLER_PEDAGOGIQUE),
                "Les bons réflexes quand un enfant semble en danger.", """
                **Écouter** · **Croire** · **Ne pas promettre le secret** · **Noter les mots exacts** · **Signaler le jour même**.

                À qui signaler : la direction de l'école, le centre de promotion sociale, la ligne nationale d'assistance à l'enfance (numéro à compléter selon le pays).
                """);
        res("Guide de l'animateur·rice de communauté", "users", dPil, Set.of(Role.CONSEILLER_PEDAGOGIQUE, Role.FORMATEUR, Role.DIRECTION_ECOLE),
                "Préparer et animer une séance d'échange de 45 minutes.", """
                **Avant** : choisir un thème, inviter une enseignante à partager une réussite.
                **Pendant** : accueil (5 min), récit (15 min), échanges (15 min), engagements (10 min).
                **Après** : publier un compte rendu dans la discussion de la classe.
                """);
        res("Mon téléphone en sécurité", "smartphone", dNum, Set.of(Role.JEUNE),
                "Les 5 règles d'or pour se protéger en ligne.", """
                1. Un mot de passe que personne ne connaît.
                2. Pas de photo intime envoyée, jamais.
                3. On bloque et on signale les inconnus insistants.
                4. On vérifie une information avant de la partager.
                5. En cas de problème, on en parle à un adulte de confiance.
                """);

        // =================== TEST D'ENTREE ===================
        placementQ(1, "Qu'aimeriez-vous améliorer en premier ?", Set.of(),
                new PlacementOption("Le calme dans ma classe", "wind", m1.getTitle()),
                new PlacementOption("La communication avec les élèves", "message-heart", m2.getTitle()),
                new PlacementOption("L'entraide entre les élèves", "handshake", m3.getTitle()),
                new PlacementOption("Les relations à la maison", "home", m11.getTitle()),
                new PlacementOption("Utiliser mon téléphone", "smartphone", m14.getTitle()));
        placementQ(2, "Quand un élève se met en colère, vous vous sentez :", Set.of(Role.ENSEIGNANT, Role.DIRECTION_ECOLE),
                new PlacementOption("À l'aise", "smile", m4.getTitle()),
                new PlacementOption("Parfois dépassé·e", "meh", m1.getTitle()),
                new PlacementOption("Souvent dépassé·e", "frown", m1.getTitle()));
        placementQ(3, "Avez-vous déjà animé un jeu coopératif ?", Set.of(Role.ENSEIGNANT, Role.TRAVAILLEUR_SOCIAL),
                new PlacementOption("Jamais", "hand", m3.getTitle()),
                new PlacementOption("Quelquefois", "thumbs-up", m6.getTitle()),
                new PlacementOption("Souvent", "star", m4.getTitle()));
        placementQ(4, "Comment préférez-vous apprendre ?", Set.of(),
                new PlacementOption("En écoutant", "headphones", null),
                new PlacementOption("En regardant des vidéos", "video", null),
                new PlacementOption("En lisant", "book-open", null));

        // =================== APPRENANTS SIMULES ===================
        List<School> borgouAlibori = List.of(sParakou, sTchaourou, sKandi, sBanikoara);
        List<AppUser> promoA = new ArrayList<>(List.of(rachida));
        for (int i = 0; i < 24; i++) promoA.add(teacher(borgouAlibori.get(i % 4), "TRAITEMENT"));
        List<AppUser> promoB = new ArrayList<>();
        for (int i = 0; i < 18; i++) promoB.add(teacher(i % 2 == 0 ? sNatitingou : sDjougou, "PILOTE"));
        List<AppUser> promoC = new ArrayList<>();
        for (int i = 0; i < 12; i++) promoC.add(teacher(i % 3 == 0 ? sNatitingou : sDjougou, "CONTROLE"));
        for (int i = 0; i < 6; i++) teacher(borgouAlibori.get(i % 4), null); // en autonomie, sans classe
        List<AppUser> parents = new ArrayList<>(List.of(parent));
        for (int i = 0; i < 14; i++) parents.add(simUser(Role.PARENT, "Borgou", null, null));

        // =================== CLASSES ===================
        LocalDate today = LocalDate.now();
        Classroom cA = classroom("Promo Borgou-Alibori · automne 2026", pTeach, moussa, today.minusDays(29), today.plusDays(26),
                Classroom.UnlockMode.WEEKLY, 7, Classroom.LeaderboardMode.PUBLIC, "https://meet.jit.si/promo-borgou-alibori-demo", promoA);
        Classroom cB = classroom("Promo pilote Atacora-Donga · été 2026", pTeach, fatou, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 8, 14),
                Classroom.UnlockMode.WEEKLY, 7, Classroom.LeaderboardMode.PUBLIC, null, promoB);
        Classroom cC = classroom("Promo Donga · janvier 2027 (groupe contrôle)", pTeach, fatou, LocalDate.of(2027, 1, 11), LocalDate.of(2027, 3, 5),
                Classroom.UnlockMode.WEEKLY, 7, Classroom.LeaderboardMode.DISABLED, null, promoC);
        Classroom cD = classroom("Groupe parents · Parakou", pPar, moussa, today.minusDays(10), today.plusDays(25),
                Classroom.UnlockMode.ALL, 7, Classroom.LeaderboardMode.ANONYMOUS, null, parents);

        // =================== COMMUNAUTE ===================
        ForumThread live = thread(moussa, "Séance en direct : la météo des émotions en classe",
                "Rejoignez la visioconférence de la promo. Venez avec vos questions et vos réussites !", m1.getId(),
                cA.getMeetingUrl(), Instant.now().plus(Duration.ofDays(2)).plus(Duration.ofHours(3)), true);
        post(live, rachida, "J'ai essayé la météo des émotions ce matin : les élèves ont adoré ! Comment faire avec 80 élèves ?", 30);
        post(live, moussa, "Bravo Rachida ! Avec un grand effectif, faites lever la main par météo : soleil, nuage, pluie, orage. 2 minutes suffisent.", 20);
        ForumThread games = thread(promoA.get(3), "Idées de jeux coopératifs sans matériel ?",
                "Partagez vos jeux qui marchent dans une cour sans matériel.", m3.getId(), null, null, false);
        ForumThread conflicts = thread(promoA.get(5), "Conflits à la récréation : vos astuces ?",
                "Depuis la rentrée, les disputes à la sortie se multiplient. Comment faites-vous ?", m4.getId(), null, null, false);
        thread(parent, "Mon fils fait des colères le soir", "Il a 5 ans. Je ne sais plus quoi faire, je crie et c'est pire.", m12.getId(), null, null, false);

        // =================== ACTIVITE SIMULEE ===================
        simulateClass(cA, promoA.subList(1, promoA.size()), moussa, List.of(games, conflicts, live));
        simulateClass(cB, promoB, fatou, List.of(), 0.5);
        simulateClass(cD, parents.subList(1, parents.size()), moussa, List.of());
        // la cloture de la promo d'ete (date depassee) fige le podium et delivre les certificats de laureat
        programService.autoCloseAll();
    }

    /**
     * Activite realiste dans une classe : chaque membre avance module par module selon le calendrier d'ouverture,
     * avec un engagement variable (quelques decrocheurs), usage hors ligne, quiz (la question 2 du premier module
     * piege une partie des apprenants), portfolios, avis et messages dans les discussions.
     */
    private void simulateClass(Classroom c, List<AppUser> members, AppUser mentor, List<ForumThread> discussion) {
        simulateClass(c, members, mentor, discussion, 0.0);
    }

    /** minEngagement : promotion pilote tres engagee (presque tous terminent le parcours). */
    private void simulateClass(Classroom c, List<AppUser> members, AppUser mentor, List<ForumThread> discussion, double minEngagement) {
        LocalDate today = LocalDate.now();
        LocalDate end = today.isBefore(c.getEndDate()) ? today : c.getEndDate();
        List<Course> mods = c.getProgram().getCourses();
        String[] comments = {"Très utile, j'ai essayé dès le lendemain.", "La vidéo est claire mais un peu longue à charger.",
                "J'aimerais plus d'exemples pour les grandes classes.", "La partie sur la crise de colère n'est pas assez claire.",
                "Bien expliqué, merci.", "L'audio est pratique, je l'écoute sur le chemin de l'école.",
                "Je ne comprends pas la différence entre punir et poser une limite."};
        for (AppUser u : members) {
            double engagement = minEngagement + (1 - minEngagement) * rnd.nextDouble();
            boolean dropout = engagement < 0.15;
            Instant last = null;
            for (int i = 0; i < mods.size(); i++) {
                Course m = mods.get(i);
                LocalDate open = ClassroomLocks.unlockDate(c, i);
                if (open.isAfter(end)) break;
                if (dropout && i >= 1) break;
                if (engagement < 0.45 && i >= 2 + rnd.nextInt(2)) break;
                LocalDate startDay = open.plusDays(rnd.nextInt(4));
                if (startDay.isAfter(end)) break;
                int nLessons = engagement > 0.3 || rnd.nextBoolean() ? m.getLessons().size() : 1 + rnd.nextInt(Math.max(1, m.getLessons().size()));
                Instant t = startDay.atTime(7 + rnd.nextInt(12), rnd.nextInt(60)).toInstant(ZoneOffset.UTC);
                Instant limit = end.atTime(23, 0).toInstant(ZoneOffset.UTC).isAfter(Instant.now()) ? Instant.now() : end.atTime(23, 0).toInstant(ZoneOffset.UTC);
                for (int l = 0; l < nLessons; l++) {
                    if (t.isAfter(limit)) break;
                    LessonProgress p = new LessonProgress();
                    p.setUser(u);
                    p.setLesson(m.getLessons().get(l));
                    p.setCompletedAt(t);
                    p.setTimeSpentSeconds(m.getLessons().get(l).getDurationMinutes() * 60 + rnd.nextInt(600));
                    p.setCompletedOffline(rnd.nextDouble() < 0.55);
                    progress.save(p);
                    last = t;
                    t = t.plus(Duration.ofHours(4 + rnd.nextInt(30)));
                }
                boolean allDone = nLessons == m.getLessons().size() && !t.isAfter(limit.plus(Duration.ofDays(3)));
                if (allDone && !m.getQuestions().isEmpty() && rnd.nextDouble() < 0.9) {
                    Instant at = t.isAfter(limit) ? limit : t;
                    int score = quiz(u, m, mods.getFirst() == m, at, engagement);
                    // un apprenant engage relit la lecon et retente l'evaluation
                    if (score < m.getPassScore() && engagement > 0.4) {
                        Instant retry = at.plus(Duration.ofDays(1));
                        quiz(u, m, false, retry.isAfter(Instant.now()) ? Instant.now() : retry, 1.0);
                    }
                }
                if (allDone && m.getType() == CourseType.PRATIQUE && rnd.nextDouble() < 0.45) {
                    PortfolioItem pi = new PortfolioItem();
                    pi.setUser(u);
                    pi.setCourse(m);
                    pi.setLesson(m.getLessons().getFirst());
                    pi.setText(portfolioText(m));
                    pi.setSubmittedAt(t.isAfter(limit) ? limit : t);
                    boolean reviewed = rnd.nextDouble() < 0.65;
                    pi.setStatus(reviewed ? PortfolioItem.Status.VALIDE : PortfolioItem.Status.SOUMIS);
                    if (reviewed) {
                        pi.setMentor(mentor);
                        pi.setMentorFeedback("Belle mise en pratique. Pensez à noter la durée et le nombre d'enfants.");
                        pi.setReviewedAt(pi.getSubmittedAt().plus(Duration.ofDays(2)));
                    }
                    portfolios.save(pi);
                }
                if (allDone && rnd.nextDouble() < 0.5) {
                    CourseFeedback f = new CourseFeedback();
                    f.setUser(u);
                    f.setCourse(m);
                    f.setRating(3 + rnd.nextInt(3));
                    f.setClarity(2 + rnd.nextInt(4));
                    f.setUsefulness(3 + rnd.nextInt(3));
                    f.setComment(rnd.nextDouble() < 0.5 ? comments[rnd.nextInt(comments.length)] : null);
                    f.setCreatedAt(t.isAfter(limit) ? limit : t);
                    feedbacks.save(f);
                }
                certification.evaluate(u, m);
            }
            if (!discussion.isEmpty() && engagement > 0.5 && rnd.nextDouble() < 0.6) {
                String[] replies = {"Merci pour le partage, je vais essayer !", "Chez nous, le jeu de la rivière marche très bien.",
                        "Les élèves médiateurs ont changé l'ambiance de notre cour.", "Même problème ici, je suis preneuse de conseils."};
                post(discussion.get(rnd.nextInt(discussion.size())), u, replies[rnd.nextInt(replies.length)], 1 + rnd.nextInt(20));
            }
            int logins = dropout ? 1 + rnd.nextInt(2) : 3 + rnd.nextInt(12);
            for (int k = 0; k < logins; k++) {
                ActivityEvent e = new ActivityEvent(u.getId(), ActivityEvent.Type.LOGIN, 0);
                long span = Math.max(1, Duration.between(c.getStartDate().atStartOfDay(), end.atStartOfDay()).toHours());
                e.setAt(c.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC).plus(Duration.ofHours(rnd.nextLong(span))));
                activity.save(e);
            }
            u.setPlacementDone(true);
            u.setLastActiveAt(last == null ? c.getStartDate().atStartOfDay().toInstant(ZoneOffset.UTC) : last);
            users.save(u);
            programService.evaluatePrograms(u);
        }
    }

    private int quiz(AppUser u, Course m, boolean trapModule, Instant at, double engagement) {
        List<String> answers = new ArrayList<>();
        int good = 0;
        for (int qi = 0; qi < m.getQuestions().size(); qi++) {
            QuizQuestion q = m.getQuestions().get(qi);
            boolean trap = trapModule && qi == 1;
            double pWrong = trap ? 0.55 : 0.25 - engagement * 0.15;
            boolean ok = rnd.nextDouble() > pWrong;
            int a = ok ? q.getCorrectIndex() : (trap ? 0 : (q.getCorrectIndex() + 1 + rnd.nextInt(q.getOptions().size() - 1)) % q.getOptions().size());
            if (ok) good++;
            answers.add(String.valueOf(a));
        }
        QuizAttempt at2 = new QuizAttempt();
        at2.setUser(u);
        at2.setCourse(m);
        at2.setScorePercent(Math.round(good * 100f / m.getQuestions().size()));
        at2.setPassed(at2.getScorePercent() >= m.getPassScore());
        at2.setAnswers(String.join(",", answers));
        at2.setAttemptedAt(at);
        attempts.save(at2);
        return at2.getScorePercent();
    }

    private static String portfolioText(Course m) {
        return switch (m.getTitle().substring(0, 4)) {
            case "Coop" -> "Jeu de la rivière avec ma classe de CE1 : les élèves ont d'abord voulu passer seuls, puis ont compris qu'il fallait s'organiser ensemble.";
            case "Un c" -> "Rituel d'accueil installé : je salue chaque élève à la porte. Les retards ont diminué et l'entrée en classe est plus calme.";
            case "Joue" -> "Nous avons compté les cailloux et raconté une histoire chacun son tour. Mon fils réclame le jeu tous les soirs.";
            default -> "Activité réalisée en classe, observations notées dans mon cahier.";
        };
    }

    // =====================================================================
    // Outils de creation
    // =====================================================================

    private AppUser teacher(School s, String cohort) {
        return simUser(Role.ENSEIGNANT, s.getRegion(), cohort, s);
    }

    private AppUser simUser(Role role, String region, String cohort, School s) {
        int n = ++nameSeq;
        // combinaisons prenom / nom toutes differentes (28 x 18 possibilites)
        String name = FIRST[n % FIRST.length] + " " + LAST[(n / FIRST.length + n * 7) % LAST.length];
        AppUser u = user(String.format("apprenant%03d@demo.local", n), DEMO_PASSWORD, name, role, "BJ", region, cohort, s);
        u.setCreatedAt(Instant.now().minus(Duration.ofDays(30 + rnd.nextInt(150))));
        return u;
    }

    private AppUser user(String email, String password, String name, Role role, String country, String region, String cohort, School school) {
        AppUser u = new AppUser();
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setFullName(name);
        u.setRole(role);
        u.setCountryCode(country);
        u.setLanguageCode("fr");
        u.setRegion(region);
        u.setCohort(cohort);
        u.setSchool(school);
        u.setDataConsent(true);
        return users.save(u);
    }

    private Domain domain(int pos, String name, String icon, String desc) {
        Domain d = new Domain();
        d.setPosition(pos);
        d.setName(name);
        d.setIcon(icon);
        d.setDescription(desc);
        return domains.save(d);
    }

    private School school(String name, String region, String commune) {
        School s = new School();
        s.setName(name);
        s.setCountryCode("BJ");
        s.setRegion(region);
        s.setCommune(commune);
        return schools.save(s);
    }

    private Course course(String title, String icon, Domain domain, String desc, CourseType type, Set<Role> roles) {
        Course c = new Course();
        c.setTitle(title);
        c.setIcon(icon);
        c.setDomain(domain);
        c.setDescription(desc);
        c.setType(type);
        c.setLanguageCode("fr");
        c.getTargetRoles().addAll(roles);
        return c;
    }

    private Program program(String title, String icon, String desc, String duration, Set<Role> roles, CertificateLevel level, Course... mods) {
        Program p = new Program();
        p.setTitle(title);
        p.setIcon(icon);
        p.setDescription(desc);
        p.setDurationLabel(duration);
        p.setCountryCode("BJ");
        p.getTargetRoles().addAll(roles);
        p.getCourses().addAll(List.of(mods));
        p.setRequiredLevel(level);
        return programs.save(p);
    }

    private void res(String title, String icon, Domain d, Set<Role> roles, String summary, String content) {
        Resource r = new Resource();
        r.setTitle(title);
        r.setIcon(icon);
        r.setDomain(d);
        r.getTargetRoles().addAll(roles);
        r.setSummary(summary);
        r.setContent(content.strip());
        resources.save(r);
    }

    private Classroom classroom(String name, Program p, AppUser facilitator, LocalDate start, LocalDate end, Classroom.UnlockMode mode,
                                int interval, Classroom.LeaderboardMode lb, String meeting, List<AppUser> members) {
        Classroom c = new Classroom();
        c.setName(name);
        c.setProgram(p);
        c.setFacilitator(facilitator);
        c.setStartDate(start);
        c.setEndDate(end);
        c.setUnlockMode(mode);
        c.setUnlockIntervalDays(interval);
        c.setLeaderboardMode(lb);
        c.setMeetingUrl(meeting);
        c.setInviteCode(programService.code(6).replace("-", ""));
        c.getMembers().addAll(members);
        return classrooms.save(c);
    }

    private ForumThread thread(AppUser author, String title, String body, Long courseId, String meetingUrl, Instant meetingAt, boolean pinned) {
        ForumThread t = new ForumThread();
        t.setTitle(title);
        t.setBody(body);
        t.setAuthor(author);
        t.setCountryCode("BJ");
        t.setCourseId(courseId);
        t.setMeetingUrl(meetingUrl);
        t.setMeetingAt(meetingAt);
        t.setPinned(pinned);
        return threads.save(t);
    }

    private void post(ForumThread t, AppUser author, String body, int daysAgo) {
        ForumPost p = new ForumPost();
        p.setThread(t);
        p.setAuthor(author);
        p.setBody(body);
        p.setCreatedAt(Instant.now().minus(Duration.ofDays(daysAgo)));
        posts.save(p);
        t.setLastActivityAt(Instant.now());
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

    // =====================================================================
    // Medias de demonstration et migration
    // =====================================================================

    /** Anciennes versions : pictogrammes en emoji. L'interface utilise desormais des icones SVG nommees. */
    private static final Map<String, String> EMOJI_TO_ICON = Map.ofEntries(
            Map.entry("🌦️", "cloud-sun"), Map.entry("🌦", "cloud-sun"), Map.entry("🤝", "handshake"), Map.entry("👪", "family"),
            Map.entry("📱", "smartphone"), Map.entry("🏫", "school"), Map.entry("📘", "book-open"), Map.entry("🧘", "wind"),
            Map.entry("🏠", "home"), Map.entry("🙂", "smile"), Map.entry("😟", "meh"), Map.entry("😣", "frown"),
            Map.entry("✋", "hand"), Map.entry("👍", "thumbs-up"), Map.entry("⭐", "star"), Map.entry("🎧", "headphones"),
            Map.entry("🎬", "video"), Map.entry("📖", "book-open"));

    private void migrateEmojiIcons() {
        for (Course c : courses.findAll()) {
            if (c.getIcon() != null && !c.getIcon().matches("[a-z-]+")) c.setIcon(EMOJI_TO_ICON.getOrDefault(c.getIcon(), "book-open"));
        }
        for (PlacementQuestion q : placement.findAll()) {
            for (PlacementOption o : q.getOptions()) {
                if (o.getIcon() != null && !o.getIcon().matches("[a-z-]+")) o.setIcon(EMOJI_TO_ICON.getOrDefault(o.getIcon(), "circle"));
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
}
