# Virtual Humans Studio

Application web pour créer des images, des voix et des vidéos à partir de **personnages virtuels photoréalistes** (identité, apparence, tenues et prompts déjà décrits dans le dépôt). Elle s’adresse à l’équipe qui exploite le studio, pas à un public ouvert.

Le dépôt contient deux couches :

- **`studio/`** — l’application (Next.js), protégée par un mot de passe partagé.
- **le reste du dépôt** — le **Virtual Humans SDK** : fiches personnages, schémas, adaptateurs fournisseurs et jeux de tests.

Par défaut, l’application lit les personnages dans `characters/` (Mei SDK v1.0.0, Tom SDK v1.0.0).

---

## À qui ça sert

Les personnes qui ont le mot de passe du studio et qui doivent produire du contenu **fidèle à un personnage officiel**, sans choisir elles-mêmes le fournisseur ou la syntaxe des prompts.

Il n’existe pas de comptes individuels, ni de rôles admin/opérateur distincts : une session unique ouvre tout le studio.

---

## Fonctionnalités réellement implémentées

### Opérationnelles (code en place, utilisables quand les clés et flags le permettent)

| Fonction | Ce que ça fait |
|---|---|
| Connexion | Page `/login` : mot de passe partagé, session limitée dans le temps. Sans configuration valide, l’accès est refusé (fail-closed). |
| Tableau de bord | Aperçu du personnage actif, présence des clés (oui/non, jamais la valeur), dépense estimée. |
| Personnages | Liste et fiche des SDK présents dans `characters/` (identité, assets, santé du paquet). |
| Composer de prompt | Assemble un prompt à partir des templates du SDK (système → comportement → variables), en français ou en anglais. |
| Studio Image | Génération d’image via OpenAI (`gpt-image-1`) si `OPENAI_API_KEY` est défini. |
| Studio Voix | Synthèse vocale via ElevenLabs si les variables voix sont définies. |
| Studio Vidéo | Génération vidéo asynchrone via fal.ai (Kling, Veo, MiniMax, Runway, etc.) si `FAL_KEY` est défini. |
| Studio Lip-sync / Scène / Produits / Storyboard 60s | Pages et routes de génération correspondantes, branchées sur les mêmes fournisseurs. |
| Budget | Estimation avant génération, journal et plafond optionnel (`BUDGET_CAP_USD`). Ce sont des **estimations**, pas la facture du fournisseur. |
| Réglages | Affiche seulement si une clé est **présente**, jamais sa valeur. |
| Version / PWA | `GET /api/version` (métadonnées de build). Mode hors-ligne pour les pages déjà visitées. |
| Envoi AICCOS | Bouton d’envoi d’un clip vers une médiathèque externe, via une route serveur. Inactif si le jeton n’est pas configuré. |

### Partielles (interface ou câblage présents, capacités réelles fermées par défaut)

| Fonction | État dans le code |
|---|---|
| **Réalisateur IA** (`/director`) | Visible seulement si `DIRECTOR_V2_ENABLED` vaut `1` ou `true`. On peut rédiger un brief (brouillon dans le navigateur). La sauvegarde serveur, la liste de projets et le pipeline (stratégie → export) exigent d’autres flags, **tous à OFF** dans l’exemple d’environnement. |
| Persistence Director | `DIRECTOR_V2_PERSISTENCE_ENABLED` : création / lecture de projets en base. Désactivée par défaut. |
| Directeurs texte (marketing, créa, script, art, storyboard) | Adaptateurs OpenAI présents. Un appel réel exige le flag du directeur **et** `DIRECTOR_V2_PAID_AI_ENABLED`. |
| Worker / génération payante Director | `DIRECTOR_V2_WORKER_ENABLED` et `DIRECTOR_V2_PAID_GENERATION_ENABLED`. Pas de cron automatique. |
| Lipsync / fusion / export « réels » côté Director | Routes câblées, refusées tant que les capacités et flags dédiés sont OFF. |

### Simulées (tests uniquement)

Un mode factice (`DIRECTOR_V2_E2E_FAKE_MODE` + harnais Playwright) injecte des réponses déterministes. Il est **refusé** sur Vercel, en production sans harnais, et si des clés fournisseurs sont présentes. Ce n’est pas un mode utilisateur.

### Prévues (annoncées dans l’interface, pas encore livrées comme parcours complet)

Sur l’accueil Réalisateur IA, seules l’étape **Brief** est marquée « disponible ». Stratégie, script, storyboard, production et export y sont indiqués « bientôt » tant que les flags d’exécution restent fermés.

---

## Pages de l’application

| Chemin | Rôle |
|---|---|
| `/login` | Connexion (public) |
| `/` | Tableau de bord |
| `/characters`, `/characters/[id]` | Personnages |
| `/director`, `/director/new`, `/director/[projectId]` | Réalisateur IA (si flag ON) |
| `/scene`, `/products`, `/image`, `/voice`, `/video`, `/lipsync`, `/storyboard` | Studios de génération |
| `/budget`, `/settings` | Budget et réglages |
| `/offline` | Page hors-ligne (PWA) |

Les routes `/api/*` correspondantes sont protégées, sauf `GET /api/version`, `POST /api/login` et une route worker interne (secret dédié, pas le cookie de session).

---

## Stack

- **Application :** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Données personnages :** fichiers du SDK (Markdown, JSON, images) dans `characters/`
- **Base / stockage (optionnel) :** Supabase (journal de budget, captures produits, persistence Director)
- **Fournisseurs (côté serveur uniquement) :** OpenAI, ElevenLabs, fal.ai
- **Hébergement prévu dans le dépôt :** Vercel (répertoire racine de build = `studio/`)
- **Tests :** tests unitaires Node, Playwright, intégration Supabase locale

---

## Installation locale

Prérequis : Node.js (version compatible avec Next 16), npm. Docker + Supabase CLI seulement si vous lancez la base locale.

```bash
cd studio
npm install
cp .env.example .env.local
```

Renseignez au minimum `APP_PASSWORD` (12 caractères ou plus, pas un mot de passe trivial) et `APP_SESSION_SECRET` (32 caractères ou plus). Puis :

```bash
npm run dev
```

L’app est alors sur `http://localhost:3000`. Elle lit le SDK dans le dossier parent (`..`). Pour pointer ailleurs : `SDK_ROOT`.

Sans clés fournisseurs, les pages s’affichent mais les générations échouent (clé manquante). Sans mot de passe / secret de session valides, les pages protégées redirigent vers `/login`.

---

## Configuration

Toutes les variables se définissent dans `studio/.env.local` (jamais préfixées `NEXT_PUBLIC_` pour un secret). L’écran Réglages n’affiche que la **présence** d’une clé.

### Accès et budget

| Variable | Rôle |
|---|---|
| `APP_PASSWORD` | Mot de passe partagé du studio |
| `APP_SESSION_SECRET` | Secret HMAC de session (distinct du mot de passe) |
| `BUDGET_CAP_USD` | Plafond d’estimation (optionnel) |

### Fournisseurs

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | Images (et Directeurs texte si flags ON) |
| `ELEVENLABS_API_KEY` | Voix |
| `ELEVENLABS_VOICE_ID` | Voix par défaut |
| `ELEVENLABS_NARRATOR_FEMALE_VOICE_ID` | Narratrice (usage local) |
| `ELEVENLABS_NARRATOR_MALE_VOICE_ID` | Narrateur (usage local) |
| `FAL_KEY` | Vidéo, lip-sync, décors |

Les variables `ELEVENLABS_USD_PER_1K_CHARS` et `FAL_*_USD_PER_*` ne servent qu’aux **estimations** de budget.

### Données

| Variable | Rôle |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur Supabase |
| `VH_ALLOW_REMOTE_SUPABASE` | Autorise une URL Supabase non locale hors Vercel (`0` par défaut) |
| `SDK_ROOT` | Racine du SDK si ce n’est pas le dossier parent |
| `CHARACTER_DIR_NAME` | Personnage par défaut (ex. `Mei SDK v1.0.0`) |
| `DIRECTOR_V2_WORKSPACE_ID` | Identifiant du workspace Director (persistence) |

### Intégration optionnelle

| Variable | Rôle |
|---|---|
| `AICCOS_URL` | Instance AICCOS |
| `AICCOS_IMPORT_TOKEN` | Jeton d’import (côté serveur uniquement) |

### Flags Director (tous à `0` dans l’exemple)

Noms utiles : `DIRECTOR_V2_ENABLED`, `DIRECTOR_V2_PERSISTENCE_ENABLED`, `DIRECTOR_V2_WORKER_ENABLED`, `DIRECTOR_V2_PAID_GENERATION_ENABLED`, `DIRECTOR_V2_PAID_AI_ENABLED`, `DIRECTOR_V2_MARKETING_AI_ENABLED`, `DIRECTOR_V2_CREATIVE_AI_ENABLED`, `DIRECTOR_V2_SCRIPT_AI_ENABLED`, `DIRECTOR_V2_ART_AI_ENABLED`, `DIRECTOR_V2_STORYBOARD_AI_ENABLED`, `DIRECTOR_V2_WORKER_SECRET`.

Un flag n’est ON que pour les valeurs `1` ou `true`. Toute autre valeur (vide, `0`, `yes`…) = OFF.

Ne pas activer les flags `DIRECTOR_V2_E2E_*` hors tests locaux.

---

## Commandes utiles (`studio/`)

| Commande | Usage |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Servir le build |
| `npm run lint` | Lint |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires |
| `npm run test:e2e` | Tests Playwright (prépare le harnais) |
| `npm run test:integration:db` | Intégration base locale |
| `npm run supabase:check-local` | Contrôle Supabase local |
| `npm run supabase:seed-workspace` | Seed du workspace local |

---

## SDK (données, pas l’interface)

Conservé depuis la documentation d’origine, toujours exact dans l’arbre Git :

- `core/` — standards
- `schema/` — schémas machine
- `templates/` — modèles de SDK personnage
- `characters/` — SDK officiels (Mei, Tom)
- `providers/` — adaptateurs fournisseurs (documentation / contrat)
- `workflows/`, `validators/`, `datasets/` — parcours, contrôles, jeux de tests
- `docs/` — documentation détaillée et historique de développement
- `examples/`, `scripts/` — exemples et utilitaires

---

## En ligne

Le dépôt décrit un déploiement Vercel dont l’alias documenté est `https://virtual-humans.vercel.app`. L’accès y est le même qu’en local : mot de passe partagé. La présence de cette configuration **ne garantit pas** à elle seule que le site répond aujourd’hui.

Guide technique : [`docs/DEPLOY.md`](docs/DEPLOY.md). État de chantier détaillé : [`docs/Developer-Handover/CURRENT_STATE_AND_RESUME.md`](docs/Developer-Handover/CURRENT_STATE_AND_RESUME.md).

---

## Fiche courte

Voir [`FICHE_IDENTITE.md`](FICHE_IDENTITE.md).
