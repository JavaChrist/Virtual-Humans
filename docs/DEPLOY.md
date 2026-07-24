# Déploiement — Virtual Humans Studio (PWA sur Vercel + Supabase)

Ce guide déploie le Studio (`studio/`) en **PWA installable** sur **Vercel**, avec
**Supabase** pour les écritures (budget + captures produits).

---

## 1. Supabase (déjà provisionné)

Projet **Virtual Humans Studio** — `ejdbksxaswhdtsudnmvi` (région `eu-west-3`).

Déjà créé par l'assistant :
- Table `vh_spend` (journal du budget)
- Table `vh_products` (apps à promouvoir)
- Bucket Storage privé `product-screens` (captures d'écran)
- RLS activé (accès serveur uniquement via la clé `service_role`)

**Récupère la clé secrète** : Dashboard Supabase → *Project Settings → API* →
`service_role` (bouton *Reveal*). Elle sert de `SUPABASE_SERVICE_ROLE_KEY`.
⚠️ Ne jamais l'exposer côté navigateur (jamais de préfixe `NEXT_PUBLIC_`).

---

## 2. Variables d'environnement

À définir en local (`studio/.env.local`) **et** sur Vercel (Production + Preview) :

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | Images (gpt-image-1) |
| `ELEVENLABS_API_KEY` | Voix (TTS) |
| `ELEVENLABS_VOICE_ID` | Voix par défaut (fallback) |
| `FAL_KEY` | Vidéo / lip-sync / décor (fal.ai) |
| `SUPABASE_URL` | `https://ejdbksxaswhdtsudnmvi.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète service_role Supabase |
| `APP_PASSWORD` | **Recommandé** : verrouille toute l'app + les routes de génération derrière ce mot de passe. Vide = accès ouvert. |
| `BUDGET_CAP_USD` | *(optionnel)* Plafond de dépense estimée ; les générations sont bloquées au-delà. |
| *(optionnel)* `FAL_*_USD_PER_SEC`, `ELEVENLABS_USD_PER_1K_CHARS` | Ajuste les estimations de budget |

> **Sécurité (important)** : l'app appelle des API payantes (OpenAI, fal.ai, ElevenLabs).
> Sans `APP_PASSWORD`, n'importe qui ayant l'URL peut lancer des générations facturées
> sur **tes** comptes. Définis `APP_PASSWORD` sur Vercel (Production + Preview) pour
> exiger une connexion. `BUDGET_CAP_USD` ajoute un garde-fou de dépense.

---

## 3. Déploiement Vercel

1. Pousse le repo sur GitHub (voir §5 pour ce qui doit rester privé).
2. Sur Vercel : **Add New → Project** → importe le repo.
3. **Root Directory = `studio`** (l'app Next.js est dans ce sous-dossier).
4. Active **« Include source files outside of the Root Directory in the Build Step »**
   (Settings → Build). Indispensable : l'app lit les données du personnage dans
   `../characters` (fiches + images), incluses dans le bundle via
   `outputFileTracingIncludes` (voir `studio/next.config.ts`).
5. Framework : **Next.js** (auto-détecté). Build/install par défaut.
6. Ajoute les variables d'env du §2.
7. **Deploy.**

> Si les images d'identité renvoient 404 en prod (assets non embarqués), définis
> `SDK_ROOT` sur le chemin racine du repo dans les fonctions, ou vérifie que le
> toggle de l'étape 4 est bien activé.

### Alternative CLI
```bash
npm i -g vercel
cd studio
vercel        # premier déploiement (préversion)
vercel --prod # production
```
Puis reporte les variables d'env via `vercel env add …` ou le dashboard.

---

## 4. PWA (installable + hors-ligne)

- `public/manifest.webmanifest` + icônes (`public/icons/`) + `public/icon.svg`.
- Service worker `public/sw.js` : shell hors-ligne, **n'intercepte jamais** `/api/*`
  ni les appels externes (Supabase, fal, OpenAI, ElevenLabs).
- Enregistré via `components/pwa-register.tsx` (**production uniquement**, pour ne
  pas gêner le HMR en `next dev`).
- Après déploiement : ouvre le site → *Installer l'application* (Chrome/Edge) ou
  *Ajouter à l'écran d'accueil* (mobile).

---

## 5. Sécurité / Git

- `studio/.env.local` contient des **secrets** → il doit rester **git-ignoré**
  (ne jamais le committer). Les clés vivent dans les variables d'env Vercel.
- Le budget et les captures sont désormais dans Supabase : plus rien n'est écrit
  sur le disque en production (compatible Vercel, fs en lecture seule).
