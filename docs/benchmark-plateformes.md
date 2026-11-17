# Analyse des plateformes comparables et valeur ajoutée

*Réponse au sous-critère 1.2 des termes de référence : analyse des plateformes comparables et valeur ajoutée.*

## 1. Plateformes étudiées

| Plateforme | Modèle | Points forts à retenir | Limites pour le contexte du nord Bénin |
|---|---|---|---|
| **Kolibri** (Learning Equality) | Open source, hors ligne d'abord | Serveur local qui synchronise des appareils sans Internet, contenus importés par « canaux », pensé pour les zones non connectées | Orienté élèves en classe. Pas de LXP, pas de portfolio, pas de certification ni de mentorat, interface peu adaptée aux adultes |
| **Moodle + appli Moodle** | Open source, LMS de référence | Très complet (quiz, badges Open Badges, rôles fins), application avec téléchargement hors ligne | Interface lourde et complexe, mode hors ligne partiel (les activités ne marchent pas toutes), coûteux à simplifier pour des publics peu lettrés |
| **Open edX** | Open source, cours massifs | Certificats vérifiables, analytique, montée en charge | Infrastructure lourde, pas de hors ligne, UX pensée pour le haut débit |
| **Coursera / LinkedIn Learning** | Propriétaire, B2C/B2B | Modèle de référence : reprise de lecture, certificats partageables sur LinkedIn, recommandations | Propriétaire, pas de hors ligne réel, données hors du contrôle du client, pas de mentorat terrain |
| **Khan Academy** | Associatif | Vidéos courtes, maîtrise progressive, tableau de bord enseignant | Pas de pratique terrain ni de portfolio, peu de hors ligne |
| **Duolingo** | Propriétaire, mobile | Engagement : séries de jours, objectifs, micro-leçons, une question par écran, célébrations | Ludification seule, pas de pratique professionnelle |
| **360Learning** | Propriétaire, LXP collaboratif | Formation entre pairs, l'expert crée le contenu, forums par cours, amélioration à partir des retours apprenants | Pas de hors ligne, licences par utilisateur coûteuses à 49 000 comptes |
| **Degreed / Docebo** | Propriétaire, LXP + IA | Recommandations par IA, parcours selon les compétences, tableaux de bord | Coût, dépendance au fournisseur, aucun usage en faible connectivité |
| **Credly / Open Badges 3.0** | Standard de certification | Badges vérifiables, portables, publiables sur LinkedIn | Brique de certification seulement |
| **TESSA / TESS-India** (Open University) | Ressources ouvertes pour enseignants | Pédagogie active ancrée dans la pratique de classe, contenus ouverts | Ressources, pas plateforme : ni suivi, ni certification, ni hors ligne natif |

## 2. Ce que nous avons repris et adapté

| Bonne pratique observée | Inspirée de | Dans la démonstration |
|---|---|---|
| Hors ligne d'abord, synchronisation différée | Kolibri | Application installable (PWA) : modules téléchargés avec vidéos, audios et sous-titres. Progression mise en file d'attente puis synchronisée, avec une règle de conflit fixe et rejouable sans risque |
| Serveur relais local | Kolibri | La même image Docker tourne sur un mini-PC dans un lieu relais (voir §4) |
| Micro-leçons, une question par écran, célébrations | Duolingo, Khan Academy | Leçons de 2 à 10 min, quiz plein écran, animation à l'obtention d'un certificat |
| Série de jours et objectif hebdomadaire | Duolingo | Accueil : série de jours, objectif de 5 leçons par semaine |
| « Reprendre où j'en étais » | Coursera, Netflix | Bouton « Continuer » sur la dernière leçon ouverte |
| Test d'entrée et recommandations | Degreed, Docebo | Test à pictogrammes (lu à voix haute) qui oriente vers les bons modules |
| Certificats vérifiables, ajout à LinkedIn | Coursera, Credly | 4 niveaux en PDF (JasperReports) avec QR code, page publique de vérification, ajout LinkedIn pré-rempli |
| Pratique et portfolio | TESSA, 360Learning | Consignes de mise en pratique, dépôt texte et vidéo de classe, validation par un mentor qui débloque l'expertise |
| Communautés animées | 360Learning, Moodle | Discussions par pays et par module, séances en visio (Jitsi) programmées par les animateurs |
| Amélioration continue des contenus | 360Learning | L'IA analyse les erreurs fréquentes et les retours, propose des corrections, l'équipe décide, une nouvelle version part vers les appareils |
| Faible littératie | — (rare sur le marché) | Lecture à voix haute hors ligne, audio en priorité, transcriptions, pictogrammes, grandes zones tactiles, contraste renforcé, taille du texte réglable |

## 3. Valeur ajoutée de notre solution

1. **Hors ligne complet, pas seulement des contenus en cache.** Leçons, médias, quiz et portfolio texte fonctionnent sans réseau. Le temps passé et l'usage hors ligne remontent au tableau de bord : c'est un indicateur demandé par les termes de référence.
2. **Pensée pour un téléphone d'entrée de gamme.**
   - Environ 120 Ko au premier chargement.
   - Vidéo de démonstration 480p : 330 Ko par minute.
   - Audio mono 32 kbit/s.
   - Mode économie de données : rien ne se charge sans accord, et le poids est affiché avant chaque téléchargement.
3. **IA utile et encadrée.**
   - **Un mentor IA présent sur tout le parcours.** Il connaît le profil de l'apprenant et la leçon à l'écran, et ne donne pas les réponses du quiz.
   - **Repli local.** Sans connexion, ou en cas d'indisponibilité, il cherche dans les modules téléchargés.
   - **Garde-fous de protection de l'enfance.** Un message évoquant une violence ou une détresse est détecté, la réponse oriente vers un adulte, et l'échange est signalé pour un suivi humain.
   - **Supervision humaine.** Journal des échanges et coût en jetons visibles dans le pilotage.
   - **Amélioration des modules.** L'IA propose ; l'humain décide et publie.
4. **Pensée pour l'essai contrôlé randomisé dès le départ.**
   - Groupes traitement et contrôle.
   - Tirage aléatoire stratifié par zone, reproductible grâce à une graine.
   - Accès aux modules filtrés par groupe et par zone.
   - Exports CSV et JSON pseudonymisés.
5. **Bien public numérique.**
   - Stack open source standard : Spring Boot, Angular, PostgreSQL, JasperReports.
   - Aucune licence par utilisateur.
   - Déploiement Docker reproductible dans un nouveau pays.
   - Code et données réversibles.

## 4. Configuration proposée pour les lieux relais (à confirmer au cadrage)

- **Matériel** : mini-PC basse consommation (4 cœurs, 8 Go de RAM, SSD de 256 Go) ou Raspberry Pi 5 de 8 Go, avec onduleur ou batterie et point d'accès Wi-Fi local.
- **Logiciel** : la même image Docker que le serveur central, en mode relais. Il sert l'application et les médias en Wi-Fi local, sans Internet. Il synchronise avec le serveur central dès qu'une connexion 3G/4G est disponible, la nuit de préférence.
- **Capacité** : environ 200 à 300 utilisateurs simultanés en Wi-Fi local. 256 Go suffisent pour plus de 300 heures de vidéo 480p.
- **Bande passante** : seuls les deltas remontent (progression, portfolios texte), soit quelques Mo par jour. Les mises à jour de contenus descendent par lots.
- **Maintenance** : supervision à distance, mises à jour par image Docker signée, et formation d'un référent local par zone.

## 5. Correspondance avec les critères d'évaluation (extrait)

| Critère | Démontré |
|---|---|
| 2.1 Multi-pays, multi-langues, multi-publics par paramétrage | Pays, langues, publics, zones et groupes sont des paramètres de module : aucun développement |
| 2.2 Couverture LMS et LXP | Test d'entrée, parcours théoriques et pratiques, portfolio, mentorat, communautés, 4 niveaux de certification, LinkedIn |
| 2.5 Accessibilité, téléphone d'entrée de gamme | Lecture à voix haute, sous-titres, transcriptions, contraste, taille du texte, clavier, poids réduit |
| 3.1 Assistant IA et recommandations | Mentor IA contextuel et test d'entrée |
| 3.2 Boucle d'amélioration | Analyse des erreurs, suggestions IA, nouvelle version propagée hors ligne |
| 3.3 Conformité IA | Garde-fous, signalement, supervision, journal pseudonymisé, choix du modèle configurable (coût) |
| 4.1 à 4.3 Hors ligne | Démonstration réelle : modules téléchargés, synchronisation différée idempotente, indicateurs d'usage hors ligne |
| 7.x Bien public numérique | Stack open source, Docker, exports ouverts, aucune dépendance propriétaire hors IA (modèle remplaçable) |
