# Audit d'architecture — Plateforme de formation « Apprendre Ensemble »

| | |
|---|---|
| Version auditée | commit `6efa8e9` (branche `working`) |
| Date | 18/11/2026 |
| Référentiel | Termes de référence Graines de Paix (`docs/TDR.txt`, prioritaire) + annonce |
| Nature | Inspection statique du code et de la configuration. **Aucun test exécuté à ce stade.** |
| Légende | **[CONSTATÉ]** lu dans le code · **[HYPOTHÈSE]** à confirmer par test · **[ABSENT]** non trouvé dans le code |

> Avertissement d'indépendance : l'auditeur est aussi l'outil qui a généré ce code dans les sessions précédentes. Ce biais est déclaré. Il est compensé par une règle stricte : rien n'est jugé conforme sans test exécuté et preuve archivée.

---

## 1. Architecture générale

```
Navigateur / téléphone (PWA Angular)
  ├─ Service worker Angular (ngsw) : coquille applicative en cache
  ├─ IndexedDB (OfflineStore) : paquets de cours, progression, file d'attente
  └─ Cache API (MediaCacheService) : vidéos, audios, sous-titres
        │ HTTPS (JSON, SSE)
        ▼
Reverse proxy nginx (docker-compose)  —ou—  Spring sert l'Angular (image unique Railway)
        ▼
API Spring Boot 4.1.2 / Java 21 (monolithe, sans état, JWT)
  ├─ JPA/Hibernate ─► PostgreSQL 16 (prod)  |  H2 fichier (dev)
  ├─ Système de fichiers local /data/media (médias téléversés)
  ├─ JasperReports 7.1 (PDF certificats, relevés, rapports)
  └─ API Anthropic (assistant IA, suggestions) — facultative, mode local sinon
```

- **Monolithe** à 2 conteneurs applicatifs (nginx + API) + PostgreSQL. **[CONSTATÉ]**
- 2 modes de déploiement : `docker-compose.yml` (3 services) et `Dockerfile` racine (1 service, utilisé sur Railway). **[CONSTATÉ]**
- 250 fichiers versionnés ; environ 60 classes Java ; 33 composants de page Angular.

## 2. Technologies frontend

| Élément | Valeur | Source |
|---|---|---|
| Framework | Angular 22, composants autonomes, signals | `frontend/package.json` |
| PWA | `@angular/service-worker`, `ngsw-config.json` | `frontend/ngsw-config.json` |
| Stockage local | IndexedDB (`core/offline-store.ts`), Cache API (`core/media-cache.service.ts`), `localStorage` (jeton, profil) | |
| UI | CSS maison (`styles.scss`), icônes SVG, sans bibliothèque UI | |
| i18n | Dictionnaire maison `core/i18n.ts` : environ 18 clés FR/EN, **utilisé dans 1 composant sur 33** | **[CONSTATÉ]** |
| Tests | Vitest déclaré dans `package.json`, **0 fichier `.spec.ts`** | **[CONSTATÉ]** |

## 3. Technologies backend

| Élément | Valeur |
|---|---|
| Framework | Spring Boot 4.1.2, Spring Security 7, Spring Data JPA, Bean Validation |
| Langage | Java 21, threads virtuels activés |
| Sécurité | OAuth2 Resource Server (JWT HS256 Nimbus), BCrypt |
| Rapports | JasperReports 7.1.1 (+ jdt, fonts), ZXing (QR codes) |
| IA | SDK Java Anthropic 3.9.0 |
| Observabilité | Actuator, endpoint `health` exposé seul ; pas de métriques ni de traces |
| Tests | JUnit 5 / SpringBootTest : **1 classe, 6 tests** (`CoreRulesTest`) |

## 4. Base de données

- PostgreSQL 16 en production, H2 en développement. **Schéma généré par Hibernate `ddl-auto=update`.** Aucun outil de migration (Flyway ou Liquibase). **[CONSTATÉ]**
- 25 entités. Principales relations :

| Entité | Relations |
|---|---|
| `AppUser` | → `School` (N-1) ; rôle, zone, pays, langue, groupe RCT |
| `Domain` | 1-N `Course` |
| `Course` (module / cours) | 1-N `Lesson`, 1-N `QuizQuestion` ; prix, seuils, restrictions zone / groupe |
| `QuizQuestion` | → `Course`, → `Lesson` (facultatif : quiz de la leçon) |
| `Program` (formation) | N-N `Course` ordonné (`program_course.position`) |
| `Classroom` | → `Program`, → facilitateur `AppUser`, N-N membres |
| `Enrollment` | → `AppUser`, → `Course` (facultatif), → `Program` (facultatif) |
| `LessonProgress` | `AppUser` × `Lesson` (unique) |
| `QuizAttempt` | `AppUser` × `Course` (réponses en CSV) |
| `Certificate` | `AppUser` × `Course` × niveau (unique) ; code public |
| `ProgramCertificate` | `AppUser` × `Program` ; rang, taille de classe |
| `PortfolioItem` | `AppUser`, `Course`, `Lesson`, mentor |
| `ForumThread` / `ForumPost`, `CourseFeedback`, `ActivityEvent`, `AssistantLog`, `Resource`, `School`, `Country`, `Language`, `PlacementQuestion` | |

- **Risques** :
  - `ddl-auto=update` en production : pas de migration versionnée ni de retour arrière. L'ajout d'une colonne `NOT NULL` échoue sur une base existante (constaté lors du dernier déploiement, qui a nécessité une recréation complète).
  - Aucune politique de sauvegarde ou de restauration définie dans le dépôt.

## 5. Services externes

| Service | Usage | Statut |
|---|---|---|
| API Anthropic | Assistant IA (SSE), suggestions d'amélioration | Facultatif. Sans clé : réponses locales (recherche dans les leçons). Coût et quota non maîtrisés côté code. |
| Jitsi (`meet.jit.si`) | Visioconférences (simple lien) | Lien externe uniquement, pas d'intégration |
| LinkedIn | Lien « ajouter une certification » | Lien externe uniquement |
| Paiement (FedaPay, Kkiapay, Stripe) | — | **[ABSENT] — paiement simulé** (`EnrollmentService.pay`) |
| SSO / IdP | — | **[ABSENT]** |
| E-mail / SMS | — | **[ABSENT]** (aucun envoi : pas de vérification d'adresse ni de réinitialisation) |
| Stockage objet (S3) | — | **[ABSENT]** (disque local) |

## 6. Authentification

- `POST /api/auth/login` et `POST /api/auth/register` → JWT HS256, **validité 30 jours**, sans jeton de rafraîchissement ni révocation. **[CONSTATÉ]** `TokenService`, `application.yml`
- Jeton stocké dans `localStorage` : exposé en cas de faille XSS. **[CONSTATÉ]**
- Déconnexion côté client seulement : le jeton reste valide jusqu'à son expiration. **[CONSTATÉ]**
- Mot de passe : BCrypt. Règle de complexité à vérifier dans `RegisterRequest`. **[HYPOTHÈSE]**
- **[ABSENT]** :
  - réinitialisation du mot de passe ;
  - vérification de l'e-mail ;
  - verrouillage après échecs / limitation de débit sur la connexion ;
  - SSO.
- Valeurs par défaut sensibles dans `application.yml` : secret JWT `dev-secret-change-me…` et mot de passe admin `Admin123!`, utilisés si les variables d'environnement manquent. `docker-compose.yml` impose ces variables, mais **le Dockerfile racine et le profil `prod` ne l'imposent pas**. **[CONSTATÉ]**
- `APP_SEED_DEMO` vaut `true` par défaut, y compris en prod : comptes de démo au mot de passe public `Demo1234!`. **[CONSTATÉ]**

## 7. Rôles et permissions

8 rôles : `ADMIN`, `FORMATEUR`, `CONSEILLER_PEDAGOGIQUE`, `DIRECTION_ECOLE`, `ENSEIGNANT`, `PARENT`, `TRAVAILLEUR_SOCIAL`, `JEUNE`.

| Contrôle | Mécanisme | Constat |
|---|---|---|
| `/api/admin/**` | URL : `ADMIN`, `FORMATEUR` | OK sur le principe |
| Mentorat | Service : `policy.isMentor`, même zone | OK sur le principe |
| Accès aux cours | `AccessPolicy.canAccess` (pays, zone, groupe RCT) + inscription | Le public cible n'est plus une barrière (choix récent) |
| `GET /api/school/dashboard` | **Aucun contrôle de rôle** : tout utilisateur rattaché à une école semble pouvoir voir la progression de ses collègues | **[HYPOTHÈSE à tester — risque données personnelles]** |
| Classement d'une classe | Membre, animateur ou staff | OK sur le principe |
| Inscription self-service | Rôles apprenants uniquement (pas ADMIN, FORMATEUR, CONSEILLER) | OK |
| Gestion des comptes | Aucun endpoint de création, modification, désactivation ou suppression d'un utilisateur (sauf groupe RCT) | **[ABSENT]** |

## 8. Architecture des API

Environ 75 endpoints REST JSON sous `/api`, plus un flux SSE (`/api/assistant/chat`) et des réponses PDF.

| Zone | Exemples |
|---|---|
| Public | `/api/public/catalog`, `/public/courses/{id}`, `/public/programs/{id}`, `/public/certificates/{code}[/pdf]`, `/api/referentiel`, `GET /api/media/{name}` |
| Apprenant | `/me`, `/me/learning`, `/enrollments`, `/courses/{id}/package`, `/sync/progress`, `/courses/{id}/quiz`, `/portfolio`, `/certificates`, `/me/transcript.pdf`, `/placement`, `/community/**`, `/classrooms/join` |
| Mentor | `/mentor/portfolios`, `/mentor/dashboard` |
| Admin | `/admin/dashboard`, `/admin/report.pdf`, `/admin/export/{dataset}.{format}`, CRUD `courses`, `domains`, `programs`, `schools`, `classrooms`, `resources`, `/admin/learners/randomize`, `/admin/assistant/logs` |

- Erreurs : `ApiExceptionHandler` → `ProblemDetail`. `server.error.include-message=always` : les messages internes sont renvoyés au client.
- Pas de versionnage d'API, pas d'OpenAPI ni de Swagger, pas de pagination (listes complètes renvoyées : catalogue, apprenants, portfolios). **[CONSTATÉ]**

## 9. Gestion des fichiers

- `POST /api/media` (authentifié, **n'importe quel rôle**) : liste blanche de types MIME **déclarés par le client** (pas de contrôle du contenu réel), jusqu'à 200 Mo, nom UUID. **[CONSTATÉ]**
- `GET /api/media/{name}` **public sans authentification**. Les vidéos de pratique de classe (portfolio, possibles images d'enfants) sont lisibles par toute personne qui connaît l'URL. L'UUID limite le risque, sans contrôle d'accès. **[CONSTATÉ — risque protection de l'enfance]**
- Aucun quota par utilisateur, aucun antivirus, aucun nettoyage des fichiers orphelins. **[ABSENT]**
- Stockage sur disque local : incompatible avec plusieurs instances. **[CONSTATÉ]**

## 10. Gestion des formations

- Domaines, cours (leçons texte / audio / vidéo, sous-titres, transcription, exercice pratique), formations (cours ordonnés), classes (dates, ouverture hebdomadaire, membres, classement, clôture), fiches pratiques. Tout est éditable en interface admin. **[CONSTATÉ]**
- Catalogue public, inscription (gratuite, payante simulée, code de licence), progression linéaire imposée. **[CONSTATÉ]**
- Versionnage du contenu (`contentVersion`) pour l'invalidation hors ligne. **[CONSTATÉ]**
- **Documents de cours** (PDF joint à une leçon) : pas de type de leçon « document ». Seules les fiches ont un `fileUrl`. **[À VÉRIFIER]**

## 11. Gestion des évaluations

- QCM à réponse unique uniquement. **[ABSENT]** :
  - questions ouvertes ;
  - réponses multiples ;
  - banque de questions ou tirage aléatoire ;
  - limite de temps ;
  - limite du nombre de tentatives.
- Quiz de leçon : **corrigé dans le navigateur, avec les bonnes réponses envoyées au client** (`CheckQuestion.correctIndex`). **[CONSTATÉ]** Les mêmes questions composent l'évaluation finale : **l'apprenant peut lire toutes les réponses de l'examen dans le paquet hors ligne** (outils de développement ou IndexedDB). Risque majeur pour la valeur des certifications. **[CONSTATÉ]**
- Évaluation finale corrigée par le serveur, refusée si toutes les leçons ne sont pas terminées (409). **[CONSTATÉ]**
- Mais la complétion des leçons est déclarée par le client via `/sync/progress`, sans contrôle de l'ordre ni de la réussite des quiz. **Un appel API direct permet de valider toutes les leçons sans les suivre.** **[CONSTATÉ — contournement de la progression]**

## 12. Gestion des certificats

- Attribution automatique et idempotente des 4 niveaux (`CertificationService`), contrainte d'unicité (utilisateur, cours, niveau). **[CONSTATÉ]**
- Code public de 10 caractères aléatoires (`SecureRandom`, 32 symboles, environ 50 bits), page de vérification publique, PDF JasperReports avec QR code. **[CONSTATÉ]**
- Certificat de formation, avec rang de lauréat à la clôture de classe. **[CONSTATÉ]**
- **[ABSENT]** : révocation, signature cryptographique du PDF, journal des émissions.
- Exposition publique de la vérification : nom complet, intitulé, date. Acceptable si consentement.

## 13. Fonctionnement hors ligne

| Mécanisme | Constat |
|---|---|
| Service worker | ngsw : coquille (`prefetch`), assets (`lazy`). **Aucun `dataGroup`** : les réponses API ne sont pas mises en cache par le SW, mais par l'application (IndexedDB). |
| Paquet de cours | `GET /courses/{id}/package` stocké en IndexedDB à chaque ouverture ; médias téléchargés à la demande (Cache API). |
| Progression | File locale `queue` (IndexedDB) + envoi en lot idempotent. |
| Quiz de leçon | Fonctionne hors ligne (correction locale). |
| Évaluation finale | **Nécessite le réseau** (bouton désactivé hors ligne). |
| Portfolio texte | File d'attente locale ; vidéo : réseau requis. |
| Quota de stockage | Lecture de `navigator.storage.estimate()` ; **aucune gestion de `QuotaExceededError`, aucun `navigator.storage.persist()`**. |
| Reprise de téléchargement | Le serveur accepte `Range`, mais **le client télécharge en un seul `fetch` sans reprise**. |
| Délais et nouvelles tentatives HTTP | **Aucun délai d'expiration ni nouvelle tentative explicite côté client.** |
| Déconnexion | Bloquée si des données sont en attente, sinon purge des médias. |

## 14. Synchronisation

- `POST /api/sync/progress` : lot de 500 éléments au plus, idempotent par (utilisateur, leçon). Conflit : date la plus ancienne, temps le plus long. Testé par `CoreRulesTest.offlineSyncIsIdempotentAndResolvesConflicts` (unitaire). **[CONSTATÉ]**
- La file locale est vidée après succès ; un envoi interrompu est rejoué. **[HYPOTHÈSE à tester en E2E]**
- Pas de synchronisation des réponses de quiz de leçon (seule la complétion l'est) ni des avis hors ligne. **[CONSTATÉ]**

## 15. Infrastructure et déploiement

- Démonstration sur Railway (UE, europe-west4) : 1 instance applicative et 1 PostgreSQL managé. Volume `/data/media`. **[CONSTATÉ]**
- TLS assuré par la plateforme. nginx (compose) : gzip, cache des fichiers versionnés. **Aucun en-tête de sécurité** (CSP, HSTS, Referrer-Policy, Permissions-Policy). **[CONSTATÉ]**
- **[ABSENT]** :
  - CI/CD (aucun pipeline dans le dépôt) ;
  - sauvegardes ;
  - supervision et alertes ;
  - journalisation centralisée ;
  - environnements séparés recette / production ;
  - serveurs relais locaux (exigence TdR 5.1).

## 16. Points forts

1. Logique hors ligne réelle sur l'appareil (IndexedDB, file d'attente, synchronisation idempotente, coquille PWA), et pas seulement une page « hors connexion ».
2. Pile standard, maintenable et transférable (Spring Boot, Angular, PostgreSQL, Docker), conforme à l'exigence de bien public numérique.
3. Modèle pédagogique riche et paramétrable : domaines, cours, formations, classes, calendrier, 4 niveaux de certification, groupes RCT et tirage stratifié.
4. Certificats PDF de qualité avec vérification publique.
5. Interface sobre et légère, pensée pour le mobile.

## 17. Risques techniques (préliminaires, à confirmer par les tests)

| # | Risque | Gravité estimée |
|---|---|---|
| R1 | Réponses de l'évaluation finale lisibles côté client (quiz de leçon = questions d'examen, `correctIndex` dans le paquet) : certifications contournables | **P0** |
| R2 | Progression déclarative : `/sync/progress` accepte toutes les leçons sans contrôle ; examen accessible sans suivre le cours | **P1** |
| R3 | Secret JWT, mot de passe admin et comptes de démo par défaut si l'environnement est mal configuré ; seed de démo activé par défaut en prod | **P0 en prod** |
| R4 | Médias publics sans authentification (vidéos de classe, enfants) | **P1** (protection de l'enfance, nLPD/RGPD) |
| R5 | « Mon école » sans contrôle de rôle | **P1** à confirmer |
| R6 | Pas de réinitialisation de mot de passe, pas de gestion de comptes (désactivation, suppression, droit à l'effacement) | **P1** |
| R7 | JWT 30 jours, non révocable, en `localStorage` ; pas de limitation sur la connexion (force brute) | P2 |
| R8 | `ddl-auto=update` sans migrations ni sauvegardes | **P1** (risque de perte de données) |
| R9 | Téléversement : type MIME déclaré, 200 Mo, sans quota | P2 |
| R10 | Pas de pagination : `/admin/learners`, `/admin/users` et le catalogue renvoient tout ; à 49 000 comptes, risque de saturation | P1 à mesurer |
| R11 | Calculs en mémoire (classement, tableaux de bord parcourant tous les utilisateurs et la progression) | P1 à mesurer en charge |
| R12 | Stockage disque local : pas de montée en charge horizontale | P2 |
| R13 | Hors ligne : pas de gestion de saturation, pas de reprise de téléchargement, pas de délai d'expiration | P2 |
| R14 | Internationalisation : interface quasi exclusivement en français codé en dur | **P1** vis-à-vis du TdR 5.3 |
| R15 | Couverture de tests : 6 tests backend, 0 test frontend, aucun test API, E2E versionné, charge ou sécurité | P2 (risque qualité) |
| R16 | Absence de SSO, de paiement réel et de serveurs relais (exigences TdR) | Non-conformités fonctionnelles |

## 18. Dette technique

- Pas de migrations de schéma ; noms d'entités historiques (`Course` = « cours » et « module »).
- Calculs agrégés en Java plutôt qu'en SQL (dashboards, classement, `myLearning` appelle `lockReason` qui relit tous les certificats pour chaque cours).
- Champ inutilisé `locks` dans `LearningService` ; anciens écrans supprimés, mais des clés i18n subsistent.
- Mélange de chaînes françaises codées en dur et de dictionnaire.
- Pas d'OpenAPI, pas de linter ou formateur configuré en CI, pas de CI.
- Les scripts de test E2E (puppeteer) utilisés pendant le développement sont **hors dépôt** (dossier temporaire) : non reproductibles en l'état.

## 19. Fonctionnalités absentes, incomplètes ou simulées

| Fonctionnalité | Statut |
|---|---|
| Paiement en ligne | **Simulé** (référence `SIM-…`, aucun prestataire) |
| Assistant IA | Réel si clé Anthropic configurée ; sinon **mode local de substitution** (recherche plein texte) |
| SSO | Absent |
| Serveurs relais locaux | Absents (spécifiés uniquement dans la documentation) |
| Réinitialisation mot de passe, vérification e-mail | Absentes |
| Gestion des comptes (CRUD, désactivation, suppression) | Absente |
| Révocation de certificat | Absente |
| Questions ouvertes, réponses multiples, banque de questions | Absentes |
| Langues locales (baatonum, dendi, fongbe) | Codes de langue présents, **aucune traduction** |
| Interface anglaise | Partielle (≈ 18 libellés) |
| Fuseaux horaires | Non gérés explicitement (dates locales navigateur et `LocalDate.now()` serveur) |
| Abonnements, licences par nombre d'utilisateurs | Absents (code de licence global en configuration) |
| Visioconférence | Lien externe Jitsi seulement |
| Données de démonstration | Activité d'apprenants **simulée** (seed) : les tableaux de bord affichent des données fictives |
