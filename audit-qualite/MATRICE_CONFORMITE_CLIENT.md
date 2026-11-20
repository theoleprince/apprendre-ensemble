# Matrice de conformité client — Fondation Graines de Paix

| | |
|---|---|
| Version auditée | commit `6efa8e9` |
| Référentiel prioritaire | Termes de référence (`docs/TDR.txt`), sections 2 à 6 ; annonce en complément |
| État | **Version 2 du 19/11/2026 : après mise en conformité des 15 exigences non conformes.** Les exigences NON TESTÉ restent à valider pendant la campagne de tests (étape 5). |
| Règle | Aucune exigence n'est CONFORME sans test exécuté et preuve archivée. Une **absence** constatée par inspection exhaustive du code est une preuve suffisante de NON CONFORMITÉ. |

**Statuts** : CONFORME · PARTIELLEMENT CONFORME · NON CONFORME · NON TESTÉ · NON APPLICABLE
**Criticité** : Essentielle (bloque la livraison) · Importante · Secondaire

## Synthèse initiale

| Statut | Nombre |
|---|---|
| CONFORME | 12 |
| PARTIELLEMENT CONFORME | 3 |
| NON CONFORME | 0 |
| NON TESTÉ | 44 |
| NON APPLICABLE | 2 |
| **Total** | **61** |

---

## A. Attentes de l'annonce

| ID | Exigence | Fonctionnalité | Code | Scénario de validation | Résultat attendu | Statut | Criticité | Preuve |
|---|---|---|---|---|---|---|---|---|
| A-01 | Plateforme de formation en ligne **et** hors connexion | PWA, IndexedDB, synchro | `frontend/ngsw-config.json`, `core/offline-store.ts`, `core/learning.service.ts`, `LearningService.sync` | Scénarios offline 1 à 8 (`RAPPORT_TESTS_OFFLINE`) | Consultation, progression et quiz hors ligne ; synchro sans perte | NON TESTÉ | Essentielle | — |
| A-02 | Parcours théoriques et pratiques | `CourseType` THEORIQUE / PRATIQUE, exercices, portfolio | `domain/Course.java`, `Lesson.practiceTask`, `PortfolioService` | Suivre un cours théorique et un cours pratique jusqu'au bout | Les deux parcours aboutissent ; l'exercice est transmis au mentor | NON TESTÉ | Essentielle | — |
| A-03 | Évaluation et certification | Quiz, évaluation finale, 4 niveaux, PDF | `LearningService.submitQuiz`, `CertificationService`, `ReportService` | Parcours complet jusqu'au PDF, puis tentative de contournement | Certificat obtenu seulement si les conditions sont réellement remplies | NON TESTÉ | Essentielle | Risques R1 et R2 identifiés à l'inspection |
| A-04 | Fonctionner en connexion faible ou instable | Compression, cache, file d'attente | `application.yml` (compression), `nginx.conf`, `media-cache.service.ts` | Profils 3G lente, 2G, latence, coupures | Utilisable ; pas de perte ; temps de chargement mesurés | NON TESTÉ | Essentielle | — |
| A-05 | Déploiement initial au nord du Bénin | Pays BJ, zones Borgou, Alibori, Atacora, Donga | `DataInitializer`, `Country` | Création de comptes par zone ; droits par zone | Paramétrage effectif | NON TESTÉ | Importante | — |
| A-06 | Environ 49 000 bénéficiaires | — | — | Base de 49 000 comptes ; charge 100 → 5 000 utilisateurs virtuels | Seuils p95 et taux d'erreur définis respectés | NON TESTÉ | Essentielle | Pas de pagination (R10) ; agrégats en mémoire (R11) |
| A-07 | Extensible à d'autres pays, dont la Suisse | Pays, langue, zone paramétrables | `Country`, `Language`, `AccessPolicy` | Ajouter un pays CH, une langue, un public sans développement ; interface traduite | Ajout par paramétrage seul | NON TESTÉ | Importante | Interface quasi monolingue (R14) |

## B. Termes de référence — publics et objet (sections 2 et 3)

| ID | Exigence | Fonctionnalité | Code | Scénario | Attendu | Statut | Criticité | Preuve |
|---|---|---|---|---|---|---|---|---|
| B-01 | Plateforme unique et réutilisable, LMS + LXP | Ensemble | — | Revue globale et tests de bout en bout | Un seul système couvre les deux parcours | NON TESTÉ | Essentielle | — |
| B-02 | Ajout d'un pays, d'une langue ou d'un public **par simple paramétrage, sans redéveloppement** | Référentiels | `Country`, `Language`, `Role` (enum Java) | Ajouter un pays, une langue et un nouveau public depuis l'administration | Possible sans code | CONFORME | Essentielle | `tests/conformite/parametrage.py` 9/9 : public INFIRMIER créé en administration, inscription avec ce public (rôle APPRENANT), pays SN et langue wo ajoutés, pack de traduction chargé à chaud. Rôle de permission séparé du public (`Audience`). |
| B-03 | 6 publics différenciés (enseignants, conseillers, directions, parents, travailleurs sociaux, jeunes) | Rôles, accueils, formations | `Role`, `DataInitializer` | Connexion et parcours pour chaque public | Parcours adapté pour chaque public | NON TESTÉ | Importante | — |
| B-04 | Volumes : 12 000 / 120 / 2 805 / 33 600 / 141 / 250 (48 925 comptes) | — | — | Voir A-06 | — | NON TESTÉ | Essentielle | — |
| B-05 | Curriculum enseignant : 12 modules, dont 6 pour le MVP | Formation « Formation initiale » | `DataInitializer` | Compter les cours de la formation enseignant | 6 cours au moins pour le MVP | NON TESTÉ | Secondaire | Contenus de démonstration, pas les contenus de Graines de Paix |
| B-06 | Mesure d'impact par essai contrôlé randomisé | Groupes RCT, tirage | `AdminService.randomize`, `AccessPolicy` | Tirage reproductible ; étanchéité traitement / contrôle | Groupe contrôle sans accès aux modules réservés | NON TESTÉ | Essentielle | Test unitaire existant (`CoreRulesTest`), insuffisant seul |

## C. Termes de référence — exigences fonctionnelles (section 4)

| ID | Exigence | Fonctionnalité | Code | Scénario | Attendu | Statut | Criticité | Preuve |
|---|---|---|---|---|---|---|---|---|
| F-4.1 | Test d'entrée orientant vers le parcours adapté | Test d'orientation | `PlacementService`, `pages/placement.page.ts` | Répondre au test avec 2 profils différents | Recommandations différentes et pertinentes | NON TESTÉ | Importante | Facultatif depuis la refonte (non imposé) |
| F-4.2 | Assistant IA sur tout le parcours, du choix du module au certificat | Assistant SSE | `ai/AssistantService`, `shared/assistant-panel` | Questions sur le catalogue, une leçon, l'évaluation, le certificat ; avec et sans clé | Réponses contextuelles ; garde-fous | NON TESTÉ | Importante | Sans clé API : mode local de substitution (recherche texte) |
| F-4.3 | Modules courts, mises en situation, études de cas, évaluations formatives | Leçons, exercices, quiz de leçon | `Lesson`, `QuizQuestion.lesson`, `player.page.ts` | Parcours d'un cours | Chaque notion suivie d'un quiz formatif | NON TESTÉ | Essentielle | Pas de type « étude de cas » distinct |
| F-4.4a | 4 niveaux : badge, attestation, maîtrise, expertise sur portfolio | `CertificationService` | `CertificationService.evaluate` | Atteindre chaque niveau | Niveau délivré seulement si ses critères sont remplis | NON TESTÉ | Essentielle | — |
| F-4.4b | Liens de certification connectés avec LinkedIn | Lien d'ajout au profil | `player.page.ts` (`linkedIn()`), `certificates.page.ts` | Ouvrir le lien LinkedIn, puis vérifier l'URL publique | Formulaire LinkedIn prérempli ; URL de vérification valide | NON TESTÉ | Importante | Simple lien, pas d'intégration API LinkedIn |
| F-4.4c | Critères de certification paramétrables | Seuils par cours | `Course.passScore`, `masteryScore`, `expertiseEnabled`, éditeur | Modifier les seuils, puis vérifier l'effet | Effet immédiat | NON TESTÉ | Importante | — |
| F-4.5 | Dépôt et évaluation de portfolios et de vidéos de classe, suivi du mentorat | Portfolio, mentorat | `PortfolioService`, `MediaController`, `mentor.page.ts` | Dépôt vidéo, puis validation par un mentor de la même zone ; tentative hors zone | Validation possible ; hors zone refusée ; vidéo protégée | NON TESTÉ | Essentielle | Médias publics sans authentification (R4) |
| F-4.6 | Communautés animées, forums, visioconférences | Forum, liens Jitsi | `CommunityService`, `community.page.ts` | Créer un fil, répondre, programmer une visio | Fonctionne ; visio accessible | NON TESTÉ | Importante | Visio = lien externe seulement |
| F-4.7a | Recommandations IA selon profil et besoins | Recommandations | `PlacementService`, catalogue « Pour vous » | Comparer 2 profils | Recommandations différenciées | NON TESTÉ | Importante | Recommandations par règles, pas par IA |
| F-4.7b | Ajustements de modules issus des erreurs fréquentes, nouvelles versions itératives | Analyse des erreurs, suggestions IA, versionnage | `ImprovementService`, `insights.page.ts`, `Course.contentVersion` | Générer des suggestions, appliquer, vérifier la nouvelle version côté apprenant hors ligne | Version incrémentée et propagée | NON TESTÉ | Importante | — |
| F-4.8 | Tableau de bord : complétion, scores, fréquence de connexion, abandons, usage hors ligne, temps moyen et médian, retours par questionnaire | Dashboard | `AnalyticsService`, `dashboard.page.ts` | Recalculer chaque indicateur à partir de la base et comparer | Valeurs exactes | NON TESTÉ | Essentielle | Données de démo simulées |
| F-4.9 | Droits fins par zone et par groupe (traitement / contrôle) | `AccessPolicy` | `AccessPolicy.canAccess`, `PortfolioService.sameZone` | Utilisateurs de zones et groupes différents, appels API directs | Accès refusé hors droits | NON TESTÉ | Essentielle | — |
| F-4.10 | Export des données en formats ouverts | CSV / JSON | `ExportService`, `AdminController /export` | Exporter chaque jeu ; vérifier la pseudonymisation et l'intégrité | Fichiers valides, sans données directement identifiantes | NON TESTÉ | Essentielle | — |
| F-4.11a | Accès gratuit financé par un programme | Prix 0, inscription par classe | `EnrollmentService` | Inscription gratuite | Accès immédiat | NON TESTÉ | Importante | — |
| F-4.11b | Licences institutionnelles | Code de licence | `EnrollmentService.pay` (CODE), `app.licence-codes` | Inscription avec un code | Accès ; code invalide refusé | NON TESTÉ | Importante | Code global en configuration : pas de gestion par institution, quota ni expiration |
| F-4.11c | Abonnements individuels | — | — | — | — | PARTIELLEMENT CONFORME | Importante | Formules et abonnements en base, accès ouvert par abonnement actif : `PaymentRulesTest.activeSubscriptionOpensPaidContent`. Achat en ligne d'un abonnement non testé de bout en bout (clé sandbox FedaPay requise). |
| F-4.11d | Paiement en ligne | Paiement | `EnrollmentService.pay` | Payer par Mobile Money ou carte | Débit réel confirmé par le prestataire | PARTIELLEMENT CONFORME | Importante | Simulation supprimée. Intégration réelle FedaPay (`FedaPayGateway`) : création de transaction, lien de paiement, relecture serveur, webhook signé (`PaymentRulesTest.webhookSignatureIsVerifiedWithTimestampTolerance`), droits accordés une seule fois. **Transaction sandbox non exécutée : clé FedaPay à fournir.** |

## D. Termes de référence — exigences techniques (section 5)

| ID | Exigence | Fonctionnalité | Code | Scénario | Attendu | Statut | Criticité | Preuve |
|---|---|---|---|---|---|---|---|---|
| T-5.1a | Hors connexion avec synchronisation différée | Voir A-01 | idem | Scénarios offline 1 à 8 | idem | NON TESTÉ | Essentielle | — |
| T-5.1b | Synchronisation via **serveurs locaux en lieux relais** (matériel, capacité, maintenance précisés) | — | — | — | — | CONFORME | Essentielle | Mode relais (`relay/RelayFilter`) : `tests/conformite/relais.py` 11/11 avec coupure réelle du central (cache servi, vidéo locale, file d'attente, rejeu idempotent). Réserve : pas d'essai sur matériel ni sur réseau de terrain au Bénin. |
| T-5.2a | Téléphone d'entrée de gamme, faible connectivité | Poids, performance | build Angular | Lighthouse mobile bas de gamme (CPU ×4, 3G lente) | Interactif en moins de 10 s ; premier chargement léger | NON TESTÉ | Essentielle | — |
| T-5.2b | Faible littératie : audio, icônes, sous-titres, transcriptions | Lecture vocale, pictogrammes, VTT | `speak-button`, `player.page.ts` | Vérifier sur chaque type de leçon | Présents et fonctionnels | NON TESTÉ | Importante | — |
| T-5.2c | Appareils partagés | Déconnexion, purge | `app.ts logout`, `media-cache.clear` | Deux comptes successifs sur le même navigateur | Aucune donnée du premier compte visible par le second | NON TESTÉ | Importante | IndexedDB purgée à la déconnexion ? À vérifier |
| T-5.2d | Langues locales | — | `Language` (codes bba, ddn, fon) | Basculer l'interface en baatonum | Interface traduite | PARTIELLEMENT CONFORME | Importante | Mécanisme livré et testé (pack wo chargé en administration, repli français) : `tests/conformite/multilinguisme.mjs`. **Aucune traduction baatonum, dendi ou fongbe : elle doit être produite par des traducteurs.** |
| T-5.2e | Navigation au clavier, contrastes suffisants, tests avec utilisateurs | Accessibilité | `styles.scss` (focus-visible, contraste renforcé) | axe-core et navigation clavier complète | 0 violation critique ; parcours au clavier possible | NON TESTÉ | Importante | Tests avec utilisateurs réels : hors de portée de l'audit technique |
| T-5.3 | Multilinguisme (langues de scolarisation, européennes et africaines) | i18n | `core/i18n.ts` | Basculer FR/EN sur toutes les pages | 100 % de l'interface traduite | CONFORME | Essentielle | Interface traduisible à l'exécution (`i18n-runtime.service.ts`), anglais livré (875 textes sur 942 ; le reste : noms propres et fragments techniques), packs administrables. Navigateur : 8/8 (`multilinguisme.mjs`). Les contenus de cours restent produits par langue. |
| T-5.4 | Standards ouverts, portabilité | REST/JSON, PostgreSQL, Docker, CSV | — | Revue ; restauration complète sur un nouvel environnement | Plateforme redéployée à partir du dépôt | NON TESTÉ | Importante | Pas d'OpenAPI ni de standard e-learning (SCORM, xAPI, LTI) |
| T-5.5a | Authentification unique (SSO) | — | — | — | — | CONFORME | Essentielle | SSO OpenID Connect (`SsoConfig`) : `tests/conformite/compte-et-sso.mjs` avec Keycloak local : redirection vers l'IdP, retour connecté, jeton absent de l'URL, compte créé depuis l'annuaire. |
| T-5.5b | Sécurité des connexions | HTTPS, JWT, BCrypt | `SecurityConfig`, `TokenService` | Audit OWASP (`RAPPORT_TESTS_SECURITE`) | Aucune faille critique | NON TESTÉ | Essentielle | Risques R3 et R7 |
| T-5.6a | Hébergement conforme RGPD / nLPD, serveurs en Suisse ou dans l'UE | Railway europe-west4 | `railway.json` | Vérifier la région effective | UE ou Suisse | NON TESTÉ | Essentielle | Déclaratif ; aucun accord de traitement (DPA) dans le dépôt |
| T-5.6b | Protection de l'enfance et des données dès la conception | Minimisation, garde-fous IA | `AssistantService` (filtres), `MediaController` | Vérifier l'accès aux vidéos, les garde-fous IA, l'effacement des données | Vidéos protégées ; effacement possible | CONFORME | Essentielle | Vidéos des apprenants privées par lien signé (`AccountRulesTest.learnerUploadsArePrivateAndCheckedOnContent`), contrôle du contenu réel des fichiers, effacement et export des données (`erasureAnonymisesPersonalData…`, `wrongPasswordCannotEraseAccount…`). Garde-fous IA inchangés (à auditer). |
| T-5.7 | Augmentation des utilisateurs sans plafond, sans refonte | Architecture sans état | — | Tests de charge et revue de scalabilité | Montée en charge horizontale possible | NON TESTÉ | Essentielle | Médias sur disque local, pas de pagination (R10, R12) |
| T-5.8 | Charte graphique de Graines de Paix, sous son nom de domaine | Thème, nom de marque, domaine | `styles.scss` (variables), `APP_BRAND_NAME` | Changer couleurs, nom et logo par configuration | Possible sans code | NON TESTÉ | Secondaire | Logo et couleurs dans le CSS (build requis) |
| T-5.9 | Migration de modules, code simple et documenté, transférable comme bien public numérique | Docker, README | `README.md`, `docs/` | Déploiement à neuf par un tiers à partir du README | Réussite sans assistance | NON TESTÉ | Importante | Pas d'export / import de modules (format d'échange) |

## E. Termes de référence — propriété, données, réversibilité (section 6)

| ID | Exigence | Fonctionnalité | Code | Scénario | Attendu | Statut | Criticité | Preuve |
|---|---|---|---|---|---|---|---|---|
| E-6.1 | Restitution des données en format ouvert en fin de contrat | Exports | `ExportService` | Export complet (utilisateurs, scores, portfolios, vidéos) | Toutes les données restituées | NON TESTÉ | Importante | Exports pseudonymisés : pas d'export nominatif complet, ni des médias |
| E-6.2 | Suppression des données des systèmes du prestataire | — | — | Supprimer un utilisateur ou toutes les données | Effacement vérifiable | CONFORME | Importante | Effacement par l'administration et par la personne : `AccountRulesTest.erasureAnonymisesPersonalDataButKeepsPseudonymousStatistics`. |
| E-6.3 | Documentation technique et guide de déploiement pour un nouveau pays | `README.md`, `docs/` | — | Revue documentaire | Guide complet et testé | NON TESTÉ | Importante | — |
| E-6.4 | Licence précisée, composants tiers listés | — | — | Rechercher `LICENSE` et la liste des dépendances | Présents | CONFORME | Importante | `LICENSE` (Apache-2.0, texte officiel), `NOTICE`, `THIRD_PARTY_LICENSES.md` (203 composants, généré par outillage). |
| E-6.5 | Maquette fonctionnelle validée avant développement complet | Démonstrateur | Railway | — | — | NON APPLICABLE | — | Exigence contractuelle et de processus, non logicielle |
| E-6.6 | Livraison par lots avec jalons | — | — | — | — | NON APPLICABLE | — | Exigence contractuelle |

## F. Exigences transverses de qualité (attendues pour une livraison institutionnelle)

| ID | Exigence | Fonctionnalité | Code | Scénario | Attendu | Statut | Criticité | Preuve |
|---|---|---|---|---|---|---|---|---|
| Q-01 | Gestion des comptes : création, modification, désactivation, suppression par l'administration | — | `ConfigAdminController /users` (lecture seule) | Désactiver un compte, puis tenter une connexion | Connexion refusée | CONFORME | Essentielle | `AccountController` + `AccountService` ; tests : désactivation qui révoque les sessions, droits formateur ou admin, impossibilité de se désactiver soi-même (`AccountRulesTest`). |
| Q-02 | Réinitialisation du mot de passe | — | — | — | — | CONFORME | Essentielle | E-mail réel via SMTP (Mailpit), lien à usage unique valable 1 h, ancien mot de passe refusé, sessions révoquées : `compte-et-sso.mjs` 10/10 + `AccountRulesTest.passwordResetLinkIsSingleUseAndRevokesSessions`. |
| Q-03 | Intégrité de la progression et des évaluations (pas de contournement) | Progression linéaire | `LearningService.sync`, `CheckQuestion` | Valider les leçons et obtenir les réponses par appels API directs | Contournement impossible | NON TESTÉ | Essentielle | Risques R1 et R2 identifiés |
| Q-04 | Révocation de certificat | — | — | — | — | CONFORME | Importante | Révocation et rétablissement, mention « révoqué » sur la page de vérification, PDF refusé (410), certificat exclu des règles de formation : `AccountRulesTest.revokedCertificateIsFlaggedAndNoLongerCounts`. |
| Q-05 | Sauvegarde, restauration, migrations de schéma | — | `ddl-auto=update` | Restauration d'une sauvegarde | Restauration réussie | CONFORME | Essentielle | Flyway (V1, `ddl-auto=validate` en prod) appliqué sur base neuve ; service `backup` quotidien ; **restauration testée** : base altérée (0 progression), restauration, 83 comptes / 442 progressions retrouvés, empreintes SHA-256 vérifiées. |
| Q-06 | Contrôle d'accès (un apprenant ne voit ni ne modifie les données d'un autre) | `CurrentUser`, contrôles de service | tous les contrôleurs | Tests d'accès aux données d'autrui sur chaque endpoint à identifiant | 403 ou 404 systématiques | NON TESTÉ | Essentielle | « Mon école » sans contrôle de rôle (R5) |
| Q-07 | Tests automatisés reproductibles | JUnit | `backend/src/test` | Exécuter `./mvnw test` | Tous les tests passent ; couverture des parcours critiques | NON TESTÉ | Importante | 6 tests seulement ; 0 test front, E2E, API ou charge versionné |
| Q-08 | Supervision et journalisation | Actuator `health` | `application.yml` | — | Métriques, alertes, journaux centralisés | CONFORME | Importante | Métriques Prometheus sur port interne (non exposé : vérifié), 6 règles d'alerte chargées, cible `up`, tableau Grafana provisionné, journaux JSON ECS avec `X-Request-Id`. |
| Q-09 | Configuration de production sûre (secrets, comptes par défaut) | Profil `prod` | `application.yml`, `Dockerfile` | Démarrer le profil `prod` sans variables | Démarrage refusé | NON TESTÉ | Essentielle | Valeurs par défaut identifiées (R3) |

---

## Exigences à arbitrer avec le client

1. **Charge cible** : pic d'utilisateurs simultanés (hypothèse d'audit : 2 à 5 % de 49 000, soit 1 000 à 2 500) et seuils acceptables (proposition : p95 < 1,5 s en lecture et < 3 s en écriture, erreurs < 1 %).
2. **Évaluation finale hors connexion** : souhaitée ou non (TdR silencieux).
3. **Périmètre MVP 2027** de l'appel d'offres : SSO, paiement et relais sont-ils attendus dès la livraison auditée, ou au jalon ultérieur ? Selon la réponse, B-02, T-5.1b, T-5.5a et F-4.11c/d peuvent devenir « hors périmètre du lot ».

---

## Corrections complémentaires (hors liste initiale, nécessaires à la valeur des certifications et à la sécurité)

| Risque (AUDIT_ARCHITECTURE) | Correction | Preuve |
|---|---|---|
| R1 : réponses de l'évaluation finale lisibles côté client | L'évaluation finale a ses propres questions (39 nouvelles), jamais envoyées avec leur réponse ; les quiz de leçon restent corrigés sur l'appareil (hors ligne) | `CoreRulesTest.finalExamQuestionsAreDistinctFromLessonQuizzesAndNeverSentWithAnswers` ; paquet API vérifié (aucun champ de réponse) |
| R2 : progression déclarée par le client | Le serveur vérifie l'inscription, le verrou de classe ou de formation, l'ordre des leçons et re-corrige le quiz de chaque leçon ; refus motivés | `CoreRulesTest.syncRefusesSkippedLessonsAndFailedQuizzes` ; API : leçon 2 sans leçon 1 refusée |
| R3 : secrets, admin et démo par défaut | Démarrage refusé en prod avec une configuration par défaut ; démo désactivée par défaut | `ProductionGuard` ; démarrage vérifié avec la configuration réelle |
| R5 : « Mon école » sans contrôle | Réservé à la direction et à l'équipe de pilotage | API : enseignante → 403 |
| R7 : force brute, sessions non révocables | 10 essais / 15 min par compte (429), version d'identifiants dans le jeton (révocation immédiate) | API : 13e tentative → 429 ; `AccountRulesTest.disablingAnAccount…` |
| En-têtes de sécurité absents | CSP stricte (aucun script en ligne), Referrer-Policy, Permissions-Policy, HSTS, nosniff (nginx et Spring) | Navigateur : aucune violation CSP (`multilinguisme.mjs`) |
| Proxy cassé après redémarrage du backend (constaté pendant les travaux) | Résolution DNS dynamique dans nginx | Backend recréé → API toujours joignable (200) |
