# AUDIT COMPLET — VIRTUAL HUMANS STUDIO (SITE)

- **Projet :** Virtual Humans SDK — application web « Studio »
- **Personnages :** Mei (`Mei SDK v1.0.0`), Tom (`Tom SDK v1.0.0`)
- **Date de l'audit :** 1er août 2026
- **Périmètre :** application Next.js `studio/` (le « site »), dans sa version actuelle
- **Type :** audit technique en lecture — état des lieux, points forts, risques, recommandations

> Cet audit **remplace** l'ancien audit `docs/archive/AUDIT — VIRTUAL HUMAN SDK.md`
> (juillet 2026), qui décrivait l'avancement du **contenu SDK par phases** et est
> désormais obsolète (Tom y était annoncé à 0 %, l'application web n'était pas couverte).

---

## 1. Résumé exécutif

Le site est une application **Next.js 16 / React 19** (App Router, TypeScript strict,
Tailwind 4) qui opérationnalise le Virtual Humans SDK : elle transforme les packages
personnages stockés sur disque (`characters/`) en **studios de production de contenu**
(image, voix, vidéo, lip-sync, scènes, storyboard 60 s, carrousels produit) en
s'appuyant sur des fournisseurs IA payants (OpenAI, ElevenLabs, fal.ai) et sur Supabase
pour la persistance (budget, produits, scènes, captures).

**Maturité globale : ~85 %.** Le socle est solide et fonctionnel de bout en bout :
14 pages, 27 routes API, runtime de validation des personnages avec tests, PWA,
authentification par mot de passe, plafond de budget, dégradation gracieuse quand un
service manque. Les principaux axes d'amélioration concernent la **couverture de tests**
(uniquement le runtime personnage), la **robustesse de la page storyboard**
(~2 050 lignes, cœur métier très dense) et quelques **points de sécurité opérationnelle**
(auth désactivable, absence de rate limiting au-delà du budget).

| Axe | Niveau | Commentaire |
|---|---|---|
| Fonctionnel (studios) | ████████████████████ 95 % | Tous les studios opérationnels |
| Architecture / code | █████████████████░░░ 85 % | Propre, mais `storyboard` très volumineux |
| Sécurité / auth | ███████████████░░░░░ 75 % | Auth optionnelle, pas de rate limiting |
| Tests / qualité | ████████░░░░░░░░░░░░ 40 % | Tests runtime uniquement, rien en E2E/API |
| Données / persistance | ██████████████████░░ 90 % | Supabase + localStorage, dégradation OK |
| PWA / déploiement | ██████████████████░░ 90 % | Manifest, SW, Vercel documentés |
| Documentation | ████████████████░░░░ 80 % | Riche, mais dispersée |

---

## 2. Périmètre & objectif du site

Le site permet, pour un personnage sélectionné (Mei par défaut) :

- de **consulter** le package SDK (identité, personnalité, tenues, expressions, poses, mémoires, voix) ;
- de **générer** des médias cohérents avec l'identité du personnage (images, voix, vidéos, lip-sync) ;
- de **composer** des scènes et un storyboard vidéo de 60 s multi-plans, avec voix off, lip-sync, carrousels produit et assemblage final ;
- de **piloter les coûts** via une estimation et un plafond de dépense ;
- d'**exporter** les clips produits vers AI Command Center OS (AICCOS).

Objectif conservé du projet : un SDK **indépendant de l'IA** utilisée, chaque personnage
étant un package autonome et reproductible.

---

## 3. Stack technique

| Technologie | Version | Rôle |
|---|---|---|
| Next.js | 16.2.10 | Framework (App Router, routes API, `proxy.ts`) |
| React / React DOM | 19.2.4 | UI client |
| TypeScript | ^5 | Typage strict, alias `@/*` |
| Tailwind CSS | ^4 | Styles (config inline `@theme` dans `globals.css`) |
| Supabase JS | ^2.110.8 | Persistance (service role, serveur) |
| fal.ai client | ^1.10.1 | Vidéo, lip-sync, merge, carrousel, PuLID, Nano Banana |
| Zod | ^4.4.3 | Validation des packages personnages |
| js-yaml | ^5.2.1 | Lecture YAML (personnalité) |
| sharp / png-to-ico | dev | Génération d'icônes PWA |

**Config présente :** `next.config.ts` (headers anti-cache SW/manifest, inclusion de
`../characters/**` en prod via `outputFileTracingIncludes`), `tsconfig.json` (strict),
`eslint.config.mjs`, `postcss.config.mjs`, `globals.css` (tokens + utilitaires `.card`
`.btn` `.select`).

**Config absente (volontairement) :** pas de `tailwind.config.*` (Tailwind 4 inline),
pas de `vercel.json` (documenté dans `docs/DEPLOY.md`), pas de `middleware.ts`
(remplacé par `src/proxy.ts`, convention Next.js 16).

---

## 4. Architecture applicative

### 4.1 Pages (`studio/src/app/**/page.tsx`) — 14 pages

| Route | Rôle | Complexité |
|---|---|---|
| `/` | Tableau de bord (aperçu personnage, clés API, dépense, liens studios) | Faible |
| `/characters` | Liste + diagnostic runtime, collisions id/code | Moyenne |
| `/characters/[id]` | Détail package (identité, personnalité, assets, mémoires, qualité) | Élevée |
| `/image` | Studio Image (OpenAI gpt-image-1, PromptComposer, estimation) | Moyenne |
| `/voice` | Studio Voix (ElevenLabs TTS) | Moyenne |
| `/video` | Studio Vidéo (modèles fal, polling, AICCOS) | Élevée |
| `/lipsync` | Studio Lip-sync (VEED / Sync v3) | Élevée |
| `/scene` | Studio Scène (still PuLID + voix + vidéo Kling, bibliothèque Supabase) | Très élevée (~650 l) |
| `/storyboard` | **Storyboard 60 s** multi-plans, duo/multi, carrousels, merge, AICCOS | **Critique (~2 050 l)** |
| `/products` | CRUD produits/apps + upload captures (Supabase) | Élevée |
| `/budget` | Historique dépenses + reset | Faible |
| `/settings` | Statut clés env, sécurité, tarifs | Faible |
| `/login` | Connexion mot de passe (hors layout nav) | Faible |
| `/offline` | Écran PWA hors ligne (Server Component) | Minimale |

Layout racine : `CharacterProvider` → `ConfirmProvider` → `Nav` + `main` + `PwaRegister`.

### 4.2 Routes API (`studio/src/app/api/**/route.ts`) — 27 routes

- **Auth :** `login` (POST/DELETE, cookie `vh_auth`).
- **Config/budget :** `settings`, `budget` (GET/DELETE), `estimate`.
- **SDK (lecture disque) :** `characters`, `character`, `v1/characters`, `v1/characters/[id]`, `assets`, `asset`, `outfits`, `template`.
- **Génération (payant) :** `generate/image` (OpenAI), `generate/voice` (ElevenLabs), `generate/video`, `generate/lipsync`, `generate/status`, `generate/scene-image` (PuLID), `generate/duo-frame` (Nano Banana), `generate/merge` (ffmpeg compose), `generate/merge-audio`, `generate/carousel` (tous fal).
- **Données Supabase :** `products` (GET/POST/DELETE), `product-screen`, `scenes`.
- **Utilitaires :** `video-models`, `aiccos/send`.

Toutes les routes de génération vérifient le plafond (`capReached()` → 402) et
journalisent la dépense (`addSpend()`) après succès ; `maxDuration` 60–120 s.

### 4.3 Librairies internes (`studio/src/lib/**`)

Cœur SDK (`sdk.ts`, avec garde anti path-traversal sur `readAsset`), auth (`auth.ts`,
hash SHA-256), Supabase (`supabase.ts`, service role), budget (`budget.ts`), tarifs et
catalogues modèles (`pricing.ts`), produits/scènes (`products.ts`, `scenes.ts`),
providers (`fal.ts`, `openai-image.ts`, `elevenlabs-voice.ts`), assemblage de prompts
(`assemble.ts`), client HTTP (`client.ts`), contexte personnage (`character-context.tsx`),
stockage média/refs local (`media-store.ts`, `reflib.ts`), brouillons
(`use-persistent-state.ts`), presets de décor et types.

### 4.4 Runtime personnage (`studio/src/runtime/**`)

Validation/chargement des packages depuis le disque : `schema.ts` (Zod), `loader.ts`,
`personality.ts`, `markdown.ts`, `registry.ts` (cache lazy + invalidation mtime, unicité
`characterId`/`characterCode`), `http.ts` (mapping 404/409/422), `errors.ts`.
**Tests présents** : `personality`, `registry`, `collision`, `tom` (+ fixtures).

### 4.5 Composants (`studio/src/components/**`)

`Nav` (sidebar + drawer mobile, sélecteur personnage, budget, déconnexion),
`ConfirmProvider`/`useConfirm` (modales — conforme à la règle « pas de `confirm()` natif »),
`PageHeader`, `PromptComposer`, `PwaRegister`, `SendToAiccos`.

---

## 5. Fonctionnalités par studio (état)

| Studio | Fournisseur | État | Notes |
|---|---|---|---|
| Image | OpenAI gpt-image-1 | ✅ Opérationnel | PromptComposer + estimation budget |
| Voix | ElevenLabs | ✅ Opérationnel | Config voix issue du SDK |
| Vidéo | fal (Kling/Veo/Seedance/Runway/MiniMax) | ✅ Opérationnel | Queue async + polling |
| Lip-sync | fal (VEED / Sync v3) | ✅ Opérationnel | Préremplissage depuis dernière vidéo/voix |
| Scène | fal (PuLID) + OpenAI + ElevenLabs | ✅ Opérationnel | Bibliothèque Supabase, brouillons |
| Storyboard 60 s | fal (compose/merge/carousel/duo) | ✅ Opérationnel | Cœur métier, très dense |
| Produits | Supabase | ✅ Opérationnel | CRUD + captures Storage |
| Budget | Supabase | ✅ Opérationnel | Journal + plafond + reset |

---

## 6. Personnages (packages SDK)

Deux personnages complets sont présents sur disque :

- **`Mei SDK v1.0.0`** — présentatrice, package de référence (identité, personnalité, 10 tenues, expressions, poses, mémoires, voix, prompts, vidéos).
- **`Tom SDK v1.0.0`** — présentateur commercial, même architecture (identité, personnalité, tenues, poses, expressions, mémoires, prompts, vidéos).

> ⚠️ **Écart majeur avec l'ancien audit :** celui-ci annonçait Tom à « 0 % / NON COMMENCÉ ».
> Tom est désormais **construit et chargé par le runtime** (test d'intégration `tom.test.ts`
> vérifiant l'absence de collision Mei/Tom). L'ancien audit est donc caduc.

Le runtime valide l'unicité des identifiants et renvoie des erreurs HTTP explicites
(409 en cas de collision, 422 en cas de package invalide).

---

## 7. Sécurité & authentification

**Modèle d'accès :**

- `APP_PASSWORD` (optionnel) → si défini, `src/proxy.ts` protège **toutes** les pages et
  routes API (cookie `vh_auth` = SHA-256 de `vh-studio::{password}`, 30 j). `/login` et
  `/api/login` exemptés ; non authentifié → redirect `/login` (pages) ou 401 JSON (API).
- Plafond `BUDGET_CAP_USD` → `capReached()` bloque les générations (402).

**Clés API (serveur uniquement, jamais exposées au client) :** `OPENAI_API_KEY`,
`ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`, `FAL_KEY`, `SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY`, `AICCOS_URL`/`AICCOS_IMPORT_TOKEN`. `/api/settings` ne
retourne que des booléens « configurée / manquante ».

**Points forts :** clés jamais côté client, service worker n'intercepte pas `/api/*`,
garde anti path-traversal sur les assets, service role côté serveur uniquement.

**Points d'attention (voir §11) :** auth désactivée si `APP_PASSWORD` absent (risque de
générations facturées si l'URL fuite en prod), pas de rate limiting applicatif au-delà
du budget, cookie sans rotation/2FA.

---

## 8. Données & persistance

**Supabase** (service role, RLS actif, accès serveur uniquement) :

| Table / Storage | Usage |
|---|---|
| `vh_spend` | Journal des dépenses estimées |
| `vh_products` | Métadonnées des apps à promouvoir |
| `vh_scenes` | Configurations des scènes (JSON) |
| bucket `product-screens` | Captures d'écran privées |

Sans Supabase configuré : budget = 0, listes vides (dégradation gracieuse).

**localStorage (client) :** personnage actif (`vh:character`), derniers médias
(`vh:media:*`), bibliothèque de refs (`vh:refLibrary:*`), brouillons scène/storyboard
(`vh:draft:*`, audio base64 lourds exclus).

**Assets SDK (disque, lecture seule) :** `characters/{DIR}/…` (docs, prompts, assets,
voice, memory), servis via `/api/asset` ou lus côté serveur pour les uploads fal.

---

## 9. PWA

Manifest (`public/manifest.webmanifest`), service worker (`public/sw.js`, cache
`vh-studio-v11`, **n'intercepte jamais `/api/*` ni le cross-origin**), enregistrement
client avec modale de mise à jour (`pwa-register.tsx`), icônes, page `/offline`.
Headers anti-cache sur `/sw.js` et le manifest dans `next.config.ts`.

---

## 10. Tests, qualité & déploiement

- **Tests automatisés :** uniquement le runtime personnage (4 fichiers via `npm test` :
  `personality`, `registry`, `collision`, `tom`). **Aucun test API, page ou E2E.**
- **Lint :** `eslint-config-next` 16 (règle `react-hooks/set-state-in-effect` en warn).
- **Déploiement :** Vercel (Root Directory = `studio`), documenté dans `docs/DEPLOY.md` ;
  bundling des assets `characters/` via `outputFileTracingIncludes` ou `SDK_ROOT`.

---

## 11. Risques & points d'attention

| # | Sévérité | Constat | Impact |
|---|---|---|---|
| R1 | 🔴 Élevée | Auth désactivée si `APP_PASSWORD` non défini | En prod, une URL qui fuite permet des générations **facturées** |
| R2 | 🟠 Moyenne | Pas de rate limiting au-delà du plafond budget | Rafales de requêtes coûteuses possibles avant blocage |
| R3 | 🟠 Moyenne | `storyboard/page.tsx` ~2 050 lignes, non testé | Zone de régression difficile à maintenir |
| R4 | 🟠 Moyenne | Couverture de tests limitée au runtime | Régressions API/UI non détectées automatiquement |
| R5 | 🟡 Faible | `SUPABASE_SERVICE_ROLE_KEY` bypass RLS | Correct pour API serveur, mais fatal si exposé en `NEXT_PUBLIC_*` |
| R6 | 🟡 Faible | Estimation de coût indicative (tarifs env) | Écart possible avec la facturation réelle des fournisseurs |
| R7 | 🟡 Faible | Documentation dispersée (13 fichiers `docs/`) | Onboarding un peu plus long |

---

## 12. Points forts

- Architecture claire et cohérente (App Router, séparation lib / runtime / composants).
- Sécurité des secrets bien pensée (clés côté serveur, booléens exposés au client, garde path-traversal, SW qui évite les API).
- Dégradation gracieuse quand un fournisseur / Supabase n'est pas configuré.
- Contrôle des coûts (estimation + plafond + journal des dépenses).
- Conformité aux conventions UI internes (modales `useConfirm` au lieu de `confirm()`, `select` avec chevron custom).
- Runtime personnage validé et testé (unicité, erreurs HTTP explicites, cache mtime).
- PWA soignée (offline, mise à jour, no-cache SW).

---

## 13. Recommandations priorisées

**Priorité 1 (sécurité & coûts)**
1. Rendre `APP_PASSWORD` **obligatoire en production** (échec au démarrage si absent) — traite R1.
2. Ajouter un **rate limiting** simple sur les routes `generate/*` (par IP / cookie) — traite R2.

**Priorité 2 (robustesse)**
3. **Découper `storyboard/page.tsx`** en sous-composants + hooks (extraction de la logique de génération/merge) — traite R3.
4. Ajouter des **tests API** (au moins `estimate`, `settings`, `v1/characters`) et un smoke test E2E du parcours principal — traite R4.

**Priorité 3 (qualité & suivi)**
5. Vérifier périodiquement l'alignement des **tarifs `pricing.ts`** avec la facturation réelle — traite R6.
6. Ajouter un **index de documentation** (sommaire dans `docs/README.md`) et lier ce présent audit — traite R7.

---

## 14. État d'avancement synthétique

```
Studios (image/voix/vidéo/lipsync/scène/storyboard) : ███████████████████░ 95 %
Personnages (Mei + Tom)                              : ████████████████████ 100 %
Architecture applicative                             : █████████████████░░░ 85 %
Sécurité / auth                                      : ███████████████░░░░░ 75 %
Données / persistance (Supabase + local)             : ██████████████████░░ 90 %
PWA / déploiement                                    : ██████████████████░░ 90 %
Tests / qualité                                      : ████████░░░░░░░░░░░░ 40 %
Documentation                                        : ████████████████░░░░ 80 %
```

**Conclusion :** le site est **fonctionnel et proche de la production**. Les efforts
prioritaires portent sur la **sécurisation opérationnelle** (auth obligatoire + rate
limiting), la **maintenabilité du storyboard** et l'**élargissement des tests**.
