# 170 — Dashboard documentary cards isolate commit

**Date :** 2026-08-27  
**Auth :** `AUTH_VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMIT_NO_AICCOS_NO_DEPLOY`  
**Nature :** commit isolé de `studio/src/app/page.tsx` · **0** deploy · **0** flag write · **0** AICCOS  
**HEAD au départ :** `7453858` (`169_` SHA record)  
**Commit fonctionnel :** `67eb7fe`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMITTED
PHASE_COST = 0¢
DEPLOYS = 0
FLAG_WRITES = 0
VERCEL_MUTATIONS = 0
SUPABASE_MUTATIONS = 0
PROVIDER_CALLS = 0
TTS_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
BUDGET_WRITES = 0
AICCOS_FILES_STAGED = 0
AICCOS_FILES_COMMITTED = 0
PAGE_TSX_COMMITTED = 1
RIDECLOUD_APPLY = SUSPENDED_NOT_CONSUMED
NEXT_AUTH = AUTH_VHS_PRODUCTION_UI_PARITY_DEPLOY_ONCE_NO_FLAG_WRITE
```

---

## 1. Autorisation consommée

`AUTH_VHS_DASHBOARD_DOC_CARDS_ISOLATE_COMMIT_NO_AICCOS_NO_DEPLOY` — Christian, chat courant.

Commit isolé de la suppression déjà dirty des cartes `overview.documents`. Test de contrat source. Documentation. Push `main`.

`AUTH_VHS_PRODUCTION_UI_PARITY_DEPLOY_ONCE_NO_FLAG_WRITE` **non exécutée**.

RideCloud `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER` **non consommée**.

`157_`–`169_` restent des snapshots immuables.

## 2. Git avant action

| Champ | Attendu | Réel |
|---|---|---|
| Branche | `main` | `main` |
| HEAD / origin/main | `7453858` | **`7453858`** |
| ahead / behind | 0 / 0 | **0 / 0** |
| Index | vide | **vide** |
| Working tree | 3 dirty | **exact** : `page.tsx` + 2 AICCOS |

Les deux fichiers AICCOS : dirty, **0 hunk** inspectable (même état qu’en `168_`). **Non stagés, non restaurés, non commités.**

## 3. Diff `page.tsx` audité

| | |
|---|---|
| Fichier | `studio/src/app/page.tsx` |
| Hunks | **1** |
| Lignes | **−12 / +0** |
| Stat | `12 ------------` |

Le hunk unique retire uniquement la `<section>` qui mappe `char?.overview.documents` (titre + `d.file` + excerpt). Aucun import, aucun appel API, aucune nav, aucun Réalisateur IA, aucun budget, aucune auth, aucun AICCOS.

**Conservé :** cartes Studio Image / Studio Voix / Studio Vidéo ; métriques Dépense estimée, Comportements, Templates ; sous-titre `SDK ${char?.overview.sdkVersion}`.

Aucune reformulation étrangère.

## 4. Distinctions obligatoires

| Couche | État après cette porte |
|---|---|
| Code committé dashboard | cartes `overview.documents` **absentes** |
| Production Vercel | **inchangée** · 0 deploy · sert encore l’image précédente |
| Correctif `SDK_VERSION` (`169_`) | committé + poussé · **non déployé** |
| Réalisateur IA | toujours gated par `DIRECTOR_V2_ENABLED` Production · **flag non écrit** |
| RideCloud apply | **SUSPENDED_NOT_CONSUMED** |
| AICCOS | 2 fichiers dirty hors scope |

## 5. Test

Aucun test de rendu dashboard n’existait. Un `renderToStaticMarkup` initial serait **trompeur** : `char` démarre à `null`, donc `char?.overview.documents` n’apparaît jamais au premier paint même si la section reste dans le source.

Test ajouté : `studio/src/app/__tests__/dashboard-doc-cards.markup.test.ts` — verrou source (pattern login markup, sans jsdom) :

- `overview.documents` / `documents.map` absents ;
- pas de `00_IDENTITY` / `01_APPEARANCE` / `02_PERSONALITY` / `04_VOICE` ;
- Studio Image / Voix / Vidéo + métriques + SDK version **conservés**.

`/api/character` continue de renvoyer `overview.documents`. Seul le rendu dashboard est retiré.

## 6. Contrôles

| Check | Résultat |
|---|---|
| Ciblé dashboard | **PASS** |
| Fraîcheur | **PASS** |
| Suite unitaire | **1909/1909** |
| Typecheck | **PASS** |
| Secret scan officiel | **PASS** · 0 hit sur correctif + docs |
| Build Production | **non requis** (suppression UI) |

0 média Git. 0 `.tmp`. 0 secret. 0 chemin local sensible. Migration `20260827133000` **non appliquée**. 0 changement Vercel.

## 7. Staging

Pathspecs explicites uniquement. Avant commit : `git diff --cached` **sans** les deux fichiers AICCOS.

## 8. Prochaine autorisation exacte — non exécutée

**`AUTH_VHS_PRODUCTION_UI_PARITY_DEPLOY_ONCE_NO_FLAG_WRITE`**

Un deploy unique des deux corrections déjà committées :

- include `SDK_VERSION` (`169_`) ;
- suppression des cartes documentaires (`170_`).

Ne pas activer le Réalisateur IA. Ne pas écrire de flag.

RideCloud apply reste **suspendue**.

**Ne pas exécuter cette porte ici.**

STOP.
