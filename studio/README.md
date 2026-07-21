# Virtual Humans Studio

Application exécutable (Next.js) qui rend le **Virtual Humans SDK** opérationnel : elle lit le personnage
(Mei), assemble les prompts selon l'architecture du SDK (système → comportement → template → variables) et
appelle **de vrais fournisseurs** pour générer **images, voix et vidéos**, avec une **estimation de budget**
avant/après chaque génération.

## Fonctionnalités

- **Tableau de bord** : aperçu du personnage, état des clés API, dépense cumulée.
- **Studio Image** — OpenAI `gpt-image-1`.
- **Studio Voix** — ElevenLabs (TTS multilingue).
- **Studio Vidéo** — fal.ai : Kling, Veo, MiniMax, Runway (génération asynchrone avec suivi de statut).
- **Composer de prompt** : choisit un template du SDK, remplit les variables `{{…}}`, en FR ou EN, et
  injecte automatiquement la clause d'identité du personnage.
- **Budget** : tarifs configurables, estimation avant génération, historique et total cumulé.

## Démarrage

```bash
cd studio
npm install            # déjà fait si scaffolé
cp .env.example .env.local   # puis renseigne tes clés
npm run dev            # http://localhost:3000
```

> L'app lit le SDK dans le dossier parent (`..`). Utilise `SDK_ROOT` pour pointer ailleurs.

## Clés API requises

| Fournisseur | Variable | Usage |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | Images |
| ElevenLabs | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | Voix |
| fal.ai | `FAL_KEY` | Vidéo (Kling/Veo/MiniMax/Runway) |

## Estimation de budget (indicative)

Les prix par défaut sont des ordres de grandeur publics (USD) et peuvent varier selon le plan/la région.

| Type | Base de calcul | Défaut |
|---|---|---|
| Image (gpt-image-1) | par image, selon taille + qualité | 1024² : low $0.011 · medium $0.042 · high $0.167 |
| Voix (ElevenLabs) | par 1000 caractères | `ELEVENLABS_USD_PER_1K_CHARS` = $0.15 |
| Vidéo (fal.ai) | par seconde, selon le modèle | Kling $0.28/s · MiniMax $0.05/s · Veo $0.40/s · Runway $0.05/s |

Ajuste chaque valeur via les variables d'environnement (voir `.env.example`).
**Ces montants sont des estimations, pas la facturation réelle.** Vérifie toujours les tarifs officiels.

## Production

```bash
npm run build
npm run start
```

Déployable sur Vercel. Pour lire le SDK en production, définis `SDK_ROOT` ou inclus les fichiers du SDK
dans le déploiement.
