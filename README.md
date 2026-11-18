# Plateforme de formation en ligne et hors connexion — démo

Démonstrateur pour l'appel d'offres « plateforme de formation » (Graines de Paix).

- **Backend** : Spring Boot 4.1 / Java 21 — API REST, JWT, JPA (PostgreSQL en test/prod, H2 en dev)
- **Frontend** : Angular 22 PWA — service worker + IndexedDB pour le hors ligne
- **Déploiement** : Docker Compose (PostgreSQL + API + nginx)

## Fonctionnalités de la démo

Analyse des plateformes comparables (Kolibri, Moodle, Coursera, Duolingo, 360Learning…) : `docs/benchmark-plateformes.md`.

| Exigence (TdR) | Couverture |
|---|---|
| Test d'entrée | Questions à pictogrammes, lues à voix haute, recommandation de modules |
| Parcours LMS + LXP | Leçons **texte / audio / vidéo** (sous-titres WebVTT, transcription, vitesse de lecture), mises en pratique |
| Assistant IA sur tout le parcours | Mentor IA en streaming, contextuel (profil, leçon), garde-fous de protection de l'enfance, repli local / hors ligne |
| Boucle d'amélioration IA | Analyse des erreurs par question + retours → suggestions IA (sorties structurées) → décision humaine → nouvelle version propagée hors ligne |
| 4 niveaux de certification | Attestation, badge, maîtrise, expertise (portfolio validé) ; critères paramétrables ; **PDF JasperReports** avec QR code ; page de vérification ; ajout LinkedIn |
| Portfolio + mentorat | Dépôt texte (file d'attente hors ligne) et vidéo de pratique, validation par un conseiller de la même zone |
| Communautés | Discussions par pays / module, séances visio (Jitsi) programmées par les animateurs |
| Tableau de bord | Complétion, scores, connexions / semaine, abandons, usage hors ligne, temps moyen / médian, satisfaction ; filtres pays / zone / groupe ; **rapport PDF** |
| Droits par zone et groupe RCT | Modules restreints par groupe et zone ; tirage aléatoire stratifié reproductible |
| Export ouvert | CSV et JSON pseudonymisés (apprenants, progression, quiz, retours, certificats) |
| Paramétrage sans développement | Domaines de compétences, programmes (parcours ordonnés), établissements, classes, fiches pratiques : tout se configure dans *Pilotage* |
| Classes (sessions) | Programme lancé pour un groupe : dates, animateur·rice, ouverture progressive des modules, code d'invitation, ajout de membres en masse (zone, école, groupe RCT) |
| Points et classement | Barème par classe (leçons, quiz, portfolio, messages) ; classement public, anonyme ou désactivé (groupe contrôle J-PAL) ; podium final et certificat de parcours avec mention « Lauréat·e » à la clôture |
| Parcours différenciés | Accueil propre à chaque public ; « Mon école » pour les directions ; suivi des décrocheurs pour les conseiller·ères ; fiches pratiques imprimables et partageables pour les parents |
| Hors ligne / faible connectivité | PWA, modules + médias sur l'appareil, synchro différée idempotente, économie de données, ~120 Ko initial |
| Accessibilité | Lecture à voix haute, contraste renforcé, taille du texte, cibles tactiles 44 px, navigation clavier, interface FR/EN |

Non couvert dans la démo (prévu au chiffrage) : SSO (OIDC/Keycloak), paiement en ligne et licences, mode relais multi-serveurs, langues africaines de l'interface.

## Assistant IA

- Variable `ANTHROPIC_API_KEY` dans `.env` → Claude (modèle par défaut `claude-opus-5-5`, modifiable via `APP_AI_MODEL`).
- Sans clé : **mode local** (recherche dans les contenus des modules), suggestions d'amélioration par règles statistiques.
- Journal pseudonymisé et signalements visibles dans *Pilotage › Supervision IA*.

## Lancer en local (dev)

```bash
# Backend (H2 fichier, port 8080)
cd backend && ./mvnw spring-boot:run

# Frontend (port 4200, proxy /api -> 8080)
cd frontend && npm install && npm start
```

Note : le service worker n'est actif qu'en build production (Docker).

## Déployer sur le serveur de test

Prérequis : Linux avec Docker et le plugin Compose.

```bash
# 1. Copier le projet sur le serveur (git clone ou scp/rsync, sans node_modules/target)
# 2. Configurer
cp .env.example .env
#    éditer .env : DB_PASSWORD, APP_JWT_SECRET (openssl rand -base64 48), APP_ADMIN_PASSWORD, HTTP_PORT
# 3. Démarrer
docker compose up -d --build
# 4. Vérifier
curl http://localhost:${HTTP_PORT:-80}/api/referentiel
docker compose logs -f backend
```

Accès depuis un autre poste du réseau : `http://<IP-du-serveur>:HTTP_PORT`.

**HTTPS est obligatoire en dehors de localhost** pour que le service worker (mode hors ligne) fonctionne.
Mettre un reverse proxy TLS devant (Caddy, Traefik, ou nginx + certbot) pointant sur `HTTP_PORT`.

Mise à jour : `git pull && docker compose up -d --build`.
Sauvegarde : `docker compose exec db pg_dump -U formation formation > backup.sql`.

## Déployer sur Railway (un seul service)

Le `Dockerfile` à la racine construit une image unique : l'application Angular est servie par Spring Boot
(une URL, pas de proxy). `railway.json` configure le build et la sonde de santé.

```bash
npx @railway/cli login
npx @railway/cli init --name apprendre-ensemble
npx @railway/cli add --database postgres
npx @railway/cli add --service app
# Variables du service app (références vers le service Postgres)
DB_URL='jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}'
DB_USER='${{Postgres.PGUSER}}'  DB_PASSWORD='${{Postgres.PGPASSWORD}}'
APP_JWT_SECRET=<aléatoire 48 caractères>  APP_ADMIN_PASSWORD=<à choisir>
APP_PUBLIC_URL=https://<domaine-railway>  APP_SEED_DEMO=true  RAILWAY_RUN_UID=0
ANTHROPIC_API_KEY=<optionnel>
# Volume pour les médias, domaine public, déploiement
npx @railway/cli volume add --mount-path /data/media
npx @railway/cli domain
npx @railway/cli up --service app
```

`RAILWAY_RUN_UID=0` permet à l'application d'écrire sur le volume Railway. Région conseillée : Europe (RGPD / nLPD).

## Tests

```bash
cd backend && ./mvnw test   # règles critiques : synchro hors ligne idempotente, 4 niveaux de certification,
                            # cloisonnement par groupe RCT, tirage stratifié reproductible
```

Parcours navigateur (Chrome headless, écran mobile 360 px + bureau) : 27 écrans, 0 erreur ; captures dans `docs/captures/`.

## Documents pour l'offre (`docs/`)

| Fichier | Contenu |
|---|---|
| `benchmark-plateformes.md` | Analyse des plateformes comparables, valeur ajoutée, configuration des lieux relais, correspondance avec les critères |
| `captures/*.png` | Écrans de la démonstration (mobile et bureau, dont le mode hors ligne) |
| `captures/*-exemple.pdf` | Certificat, relevé de formation et rapport de suivi générés par JasperReports |
| `TDR.pdf`, `TDR.txt` | Termes de référence |

## Comptes de démonstration

Créés au premier démarrage si `APP_SEED_DEMO=true` (boutons « en un clic » sur l'écran de connexion) :

| Compte | Rôle |
|---|---|
| admin@demo.local / `APP_ADMIN_PASSWORD` | Administration |
| formateur@demo.local / Demo1234! | Pilotage |
| conseiller@demo.local / Demo1234! | Mentor (Borgou) |
| enseignant@demo.local, parent@demo.local, jeune@demo.local, direction@demo.local / Demo1234! | Apprenants |
| conseillere2@demo.local / Demo1234! | Mentor (Atacora) : promo pilote terminée et promo à venir |
| social@demo.local / Demo1234! | Travailleuse sociale |
| apprenantNNN@demo.local / Demo1234! | ~75 apprenant·es simulés dans 4 classes (en cours, terminée avec podium, à venir, parents) |

Mettre `APP_SEED_DEMO=false` hors démonstration.

## API principale

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/register` | public |
| GET | `/api/referentiel` | public |
| GET | `/api/courses` | apprenant |
| GET | `/api/courses/{id}/package` | apprenant (paquet hors ligne) |
| POST | `/api/sync/progress` | apprenant (synchro en lot) |
| POST | `/api/courses/{id}/quiz` | apprenant |
| GET | `/api/certificates` | apprenant |
| GET | `/api/public/certificates/{code}` | public |
| GET | `/api/admin/stats`, `/api/admin/export/{progress,quiz}.csv` | admin / formateur |
| CRUD | `/api/admin/courses` | admin / formateur |
