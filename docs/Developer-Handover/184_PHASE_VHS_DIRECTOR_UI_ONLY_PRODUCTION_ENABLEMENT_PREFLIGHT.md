# 184 — VHS Director UI-only Production enablement preflight

**Date :** 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER`  
**Nature :** preflight local lecture seule · tests + documents · **0** flag write · **0** deploy · **0** push · **0** provider  
**HEAD au départ / origin/main :** `8081744`  
**SHA fonctionnel hardening :** `d376a7c`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_READY_FOR_FLAG_AUTH
SOURCE_HEAD=8081744
ORIGIN_MAIN=8081744
AHEAD_BEHIND=0/0
FUNCTIONAL_COMMIT=d376a7c
LOCAL_PREFLIGHT_COMMIT=pending
DIRECTOR_FLAG_WRITES=0
OTHER_FLAG_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
PROVIDER_CALLS=0
REAL_GENERATIONS=0
PRODUCTION_SUPABASE_MUTATIONS=0
PRODUCTION_STORAGE_READS=0
PRODUCTION_STORAGE_WRITES=0
MEDIA_READS=0
MEDIA_WRITES=0
SIGNED_URLS_CREATED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
REAL_LIPSYNC_SUBMITS=0
REAL_MERGES=0
REAL_EXPORTS=0
DOWNLOADS_TRIGGERED=0
MERGE_EXPORT_AUTHORIZED=0
BUDGET_WRITES=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER` — Christian, chat courant.

Porte strictement locale. Aucune écriture Vercel. Aucun déploiement. Aucun push. Aucune credential provider. Aucune mutation Supabase/Storage Production. AICCOS non touché. Aucune autorisation provider précédente n’a été réutilisée.

`157_`–`183_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| HEAD / origin/main au départ | `8081744de29ab34e5efa8aa48d5cd8c363cf8e34` | docs `183_` · alias Production documentaire |
| Commit fonctionnel hardening | `d376a7c4fa273641336b939e73f03a8207428e68` | UX fake · **dans le tree servi** |
| SHA build Production | `ad4a90964452f2562967a165fb933c52185f8470` | identité `/api/version` avant ce preflight |
| Commit local `184_` | ce commit tests+docs | **non poussé** · **non déployé** |

Ce n’est **pas** une ouverture Production, ni une validation provider.

---

## 2. Préconditions

| # | Contrôle | Résultat |
|---|---|---|
| 1 | Fetch lecture seule | PASS |
| 2 | Branche `main` | PASS |
| 3 | HEAD = origin/main = `8081744` | PASS |
| 4 | ahead/behind `0/0` | PASS |
| 5 | Seuls dirty = 2 AICCOS | PASS |
| 6 | Index vide | PASS |
| 7 | Aucune Auth provider réutilisée | PASS |
| 8 | Flags payants/média considérés OFF | PASS (parseur `parseStrictEnabledFlag`) |
| 9 | `mergeExportAuthorized=false` | PASS (vues Lipsync + Merge/Export) |
| 10 | Provider Lipsync `unavailable` | PASS (`178_`/`179_`, flags 11D OFF) |
| 11 | Aucun moteur merge/export réel | PASS (`180_`/`181_`, flags 11E OFF) |
| 12 | RideCloud suspendu | PASS |
| 13 | Ledger 437 / 391 / 0 / 46 | PASS |
| 14 | Accès `/director` | PASS — proxy session + layout `isDirectorV2Enabled` |
| 15 | Nav / dashboard | PASS — lien gated ; dashboard sans carte Director |
| 16 | Aucune écriture Vercel requise | PASS |

Working tree protégé : `studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx`.

---

## 3. Audience exacte

Aucun rôle admin/opérateur n’existe dans le code. Le proxy est un **mot de passe partagé** (VHS-002). `/director` n’est pas public.

| Audience | Comportement si `DIRECTOR_V2_ENABLED=1` |
|---|---|
| Non authentifié | 307 `/login?next=…` |
| Authentifié standard | même session que `/characters`, `/settings`, `/budget` — Director visible |
| Admin / opérateur | **n’existe pas** — non inventé |
| Autre audience codée | aucune |

Verdict d’audience : **acceptable** pour ce produit single-tenant. La future Auth flag doit **attester explicitement** cette audience. Pas de `BLOCKED_AUDIENCE_DECISION_REQUIRED` : inventer un rôle serait hors porte.

---

## 4. Ce que produit le seul flag UI

`DIRECTOR_V2_ENABLED=1` **isolé** (persistence et tous les flags payants OFF) :

- layout `/director` rend l’arbre au lieu de `notFound()` ;
- `/api/settings` expose `features.directorV2=true` ;
- la nav affiche « Réalisateur IA » ;
- home + wizard brief **localStorage uniquement** ;
- « Créer le projet » **absent** ;
- `/director/:id` → 404 ;
- `/api/director/*` → 404 « Persistance Director désactivée » ;
- aucun worker, cron, provider, média.

`canUseDirectorV2Persistence` = `DIRECTOR_V2_ENABLED` ∧ `DIRECTOR_V2_PERSISTENCE_ENABLED`.  
**UI-only isolé = flag UI ON + persistence OFF.** Persistence ON n’est **pas** cette porte.

`assertPhase11EMergeExportFlagsRemainOff` jette si `DIRECTOR_V2_ENABLED` est ON, mais seulement dans l’orchestration merge/export réelle — inatteignable sans persistence.

---

## 5. Matrice des surfaces

| Surface | Visible UI ON | Action possible | Route | R/W | Provider | Coût | Média | Guard | UI-only |
|---|---|---|---|---|---|---|---|---|---|
| Nav Réalisateur IA | oui | lien | GET `/api/settings` | read | non | non | non | `features.directorV2` | safe |
| Dashboard `/` | non (pas de carte) | navigation existante | GET `/` | none | non | non | non | page sans `/director` | safe |
| `/director` home | oui | CTA brief local | GET `/director` | none | non | non | non | layout + persistence OFF | safe |
| `/director/new` | oui | brouillon local · Valider le brief | GET `/director/new` | local_write | non | non | non | pas de POST projet | safe |
| `/director/:id` | non | 404 | GET | none | non | non | non | `notFound()` si persistence OFF | unreachable |
| `/api/director/*` | non | 404 | API | none | non | non | non | `canUseDirectorV2Persistence` | unreachable |
| Directors texte | bouton disabled | « Analyse marketing — prochainement » | aucune | none | non | non | non | AI flags OFF | safe |
| Production / Voice | non | — | aucune | none | non | non | non | projet 404 | unreachable |
| Lipsync | non (projet) | `prepared_disabled` si un jour atteint | aucune ici | none | non | non | non | 6 gates 11D OFF | unreachable |
| Merge/Export | non (projet) | `prepared_disabled` · `authorized=false` | aucune ici | none | non | non | non | 7 gates 11E OFF | unreachable |
| Download / publish | non | aucune | aucune | none | non | non | non | delivery hors projet | unreachable |
| GET `/api/budget` | nav existante | lecture session | GET | read | non | non | non | hors Director | existing |

---

## 6. Matrice des écritures produit

| Écriture | Route | Cible | Env | Nécessité | Idempotent | Risque | Autorisée UI-only isolé |
|---|---|---|---|---|---|---|---|
| Brouillon brief | localStorage | `virtual-humans:director:v2:brief-draft` | navigateur | reprise wizard | oui | local seulement | **oui** |
| Création projet | POST `/api/director/projects` | tables Director | serveur | persister un brief | non | mutation | **non** |
| Révision persistée | POST `…/brief/revise` | artifacts | serveur | réviser | non | mutation | **non** |
| Artifacts fake | POST `/api/director/projects/:id/*` | artifacts | serveur | pipeline fake | non | hors isolé | **non** |
| Logs listed/loaded | pages projet | logs | serveur | observabilité | oui | seulement si persistence | **non** |
| Reset budget nav | DELETE `/api/budget` | cumul session | existant | déjà hors Director | oui | ne pas l’attribuer au Director | **non** (hors scope) |

Aucune écriture Production réalisée. Une future ouverture UI-only **ne doit pas** allumer `DIRECTOR_V2_PERSISTENCE_ENABLED` sans Auth séparée nommant ces mutations.

---

## 7. Flags à maintenir OFF

Parseur réel : `parseStrictEnabledFlag` — ON seulement pour `"1"` / `"true"` (trim, case-insensitive). Fail-closed : absent, `""`, `"0"`, `"false"`, `"yes"`, `"on"`, `"enabled"`, tout autre.

Seul flag autorisé ON pour l’isolé : **`DIRECTOR_V2_ENABLED`**.

Doivent rester OFF (noms lus dans le code) :

- Director : `DIRECTOR_V2_PERSISTENCE_ENABLED` · `DIRECTOR_V2_WORKER_ENABLED` · `DIRECTOR_V2_PAID_GENERATION_ENABLED` · `DIRECTOR_V2_MARKETING_AI_ENABLED` · `DIRECTOR_V2_CREATIVE_AI_ENABLED` · `DIRECTOR_V2_SCRIPT_AI_ENABLED` · `DIRECTOR_V2_ART_AI_ENABLED` · `DIRECTOR_V2_STORYBOARD_AI_ENABLED` · `DIRECTOR_V2_PAID_AI_ENABLED`
- Harness E2E (interdit en Production) : `DIRECTOR_V2_E2E_HARNESS` · `DIRECTOR_V2_E2E_FAKE_MODE` · `DIRECTOR_V2_E2E_ASSET_STORAGE`
- 11A : `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION`
- 11B : `VHS11B_I2V_CAPABILITY_ENABLED` · `VHS11B_I2V_PAID_ENABLED` · `VHS11B_I2V_FAL_ENABLED` · `VHS11B_I2V_WORKER_ENABLED` · `VHS11B_I2V_DOWNSTREAM_ENABLED` · `VHS11B_FAL_I2V_DIRECTOR_EXCEPTION`
- 11C : `VHS11C_VOICE_CAPABILITY_ENABLED` · `VHS11C_VOICE_PAID_ENABLED` · `VHS11C_VOICE_ELEVENLABS_ENABLED` · `VHS11C_VOICE_WORKER_ENABLED` · `VHS11C_VOICE_DOWNSTREAM_ENABLED` · `VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION`
- 11D (6) : `VHS11D_LIPSYNC_CAPABILITY_ENABLED` · `VHS11D_LIPSYNC_PAID_ENABLED` · `VHS11D_LIPSYNC_PROVIDER_ENABLED` · `VHS11D_LIPSYNC_WORKER_ENABLED` · `VHS11D_LIPSYNC_DOWNSTREAM_ENABLED` · `VHS11D_LIPSYNC_DIRECTOR_EXCEPTION`
- 11E (7) : `VHS11E_MERGE_CAPABILITY_ENABLED` · `VHS11E_EXPORT_CAPABILITY_ENABLED` · `VHS11E_PAID_ENABLED` · `VHS11E_PROVIDER_ENABLED` · `VHS11E_WORKER_ENABLED` · `VHS11E_DIRECTOR_EXCEPTION` · `VHS11E_PUBLISH_DOWNSTREAM_ENABLED`
- Motion : `MOTION_TRANSFER_ENABLED` · `MOTION_TRANSFER_PAID_ENABLED` · `MOTION_TRANSFER_FAL_ENABLED` · `MOTION_TRANSFER_WORKER_ENABLED` · `MOTION_TRANSFER_FAKE_HARNESS`

`canExecutePaidGeneration` = worker ∧ paid generation.  
Texte AI réel = `*_AI_ENABLED` ∧ `DIRECTOR_V2_PAID_AI_ENABLED`.

---

## 8. Simulation locale production-like

Processus local **port 3112** uniquement (`e2e-start-server.mjs --ui-only`) :

- `DIRECTOR_V2_ENABLED=1` dans le process — **jamais persisté** ni écrit sur Vercel ;
- tous les flags §7 forcés à `"0"` ;
- `OPENAI_API_KEY` / `FAL_KEY` / `ELEVENLABS_API_KEY` vides ;
- harness fake OFF (séparé du serveur 3100) ;
- barrière Playwright fail-closed (hors localhost aborté) ;
- Supabase Production / Storage Production non contactés.

Le serveur 3100 (harness fake + persistence) n’est **pas** cette simulation.

---

## 9. Preuves

| # | Preuve | Résultat |
|---|---|---|
| 1 | `/director` visible pour la session studio | PASS Playwright UI-only |
| 2 | Non-auth → login | PASS |
| 3 | Nav + dashboard sans route cassée | PASS |
| 4 | Chargement initial sans provider | PASS barrière + UI sans nom provider |
| 5 | Aucun média Production | PASS barrière `supabase.co` / storage |
| 6 | Aucun worker réel | PASS — `No auto-start. No HTTP. No cron.` + worker flag OFF |
| 7 | Aucun cron | PASS — pas de `vercel.json` crons |
| 8 | Actions réelles absentes / disabled | PASS — pas de « Créer le projet » · marketing disabled |
| 9 | Fake/dry-run identifiés | N/A isolé (pas de pipeline projet) · home dit « pas encore actifs » |
| 10 | Providers non exposés | PASS |
| 11 | Lipsync / Merge `prepared_disabled` | PASS unitaires vues (projet inatteignable) |
| 12 | Pas de download / publication | PASS |
| 13 | `mergeExportAuthorized=false` | PASS |
| 14 | Erreurs honnêtes | PASS — 404 persistence · bouton disabled |
| 15 | Blocker app-update | PASS unitaires (apply refusé si blocker) · create inatteignable donc `directorProjectCreate` ne s’arme pas |
| 16 | Logout + reprise | PASS |
| 17 | Desktop + mobile 390×844 | PASS |

Barrière : `blockedAttempts=0` sur les 4 specs UI-only + 1 spec OFF.  
`spendSummary` local `42501` (`vh_spend`) = lecture budget locale fail-closed, **pas** Production, **pas** un provider.

---

## 10. Tests

| Check | Résultat |
|---|---|
| Unitaires suite | **2017/2017** |
| Preflight UI-only (nouveau module) | PASS |
| Flags / nav / auth / guards sources | PASS |
| Playwright Director OFF | **1/1** |
| Playwright production-like UI-only | **4/4** |
| Barrière réseau | PASS (0 violation) |
| Lipsync 11D + vue | PASS |
| Merge/Export 11E + vue | PASS |
| Blockers integration + wiring | PASS |
| Typecheck (`next build`) | PASS |
| `tsc --noEmit` standalone | erreur **préexistante** hors scope (`fake-universal-adapter.test.ts`) |
| Lint fichiers de porte | 0 error |
| Build Production local | PASS |
| Fraîcheur living handover | PASS après mise à jour |
| Secret scan officiel (`findSecretHits`) | 0 hit sur `184_` + living |

Aucun provider relancé.

---

## 11. Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| Confondre UI-only et persistence | haute | future Auth doit nommer persistence **OFF** |
| Confondre harness 3100 et isolé 3112 | haute | E2E_HARNESS interdit en Production |
| Audience = tous les authentifiés | moyenne | attester dans la Auth flag ; pas de nouveau rôle ici |
| Orchestration 11E vs flag UI | basse | path inatteignable sans persistence |
| Promouvoir le commit `184_` comme runtime | haute | docs/tests only · origin/main reste `8081744` tant que non poussé |

Aucun correctif applicatif requis. Aucune faille de guard trouvée.

---

## 12. Plan de future activation (non exécuté)

```text
AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_FLAG_WRITE_ONCE_NO_PROVIDER_NO_PERSISTENCE_NO_RUNTIME
```

Cette Auth **n’est pas** commencée. Elle devra nommer :

| Champ | Valeur exigée |
|---|---|
| Flag exact | `DIRECTOR_V2_ENABLED=1` |
| Cible Vercel | projet `virtual-humans` · Production (et Preview seulement si explicitement nommé) |
| Environnements | ceux listés dans l’Auth — pas d’implicite |
| Audience | titulaire de la session studio (mot de passe partagé) |
| Écritures autorisées | brouillon `localStorage` uniquement |
| Persistence | **OFF** (`0` / absent / `false`) |
| Tous les flags §7 | **OFF** |
| Rollback | `DIRECTOR_V2_ENABLED=0` ou suppression · vérifier 404 `/director` + lien nav absent |
| Vérifs Production | login redirect ; session voit nav + home ; `/api/director/projects` 404 ; `/api/version` inchangé fonctionnellement ; 0 provider |

Aucun runtime réel, worker, cron, média, lipsync, merge/export, download ou publication n’est autorisé par cette future ouverture UI-only.

---

## 13. Rollback de ce preflight

Aucun état Production n’a changé. Rollback = ignorer le commit local `184_` (ou le laisser non poussé). AICCOS restent dirty hors staging.

---

## 14. Compteurs

Voir le bandeau. Tous les compteurs sensibles = 0. `PHASE_COST=0¢`. `RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED`.

---

## 15. STOP

```text
VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_PREFLIGHT_READY_FOR_FLAG_AUTH
```

Prochaine porte **non exécutée** : `AUTH_VHS_DIRECTOR_UI_ONLY_PRODUCTION_ENABLEMENT_FLAG_WRITE_ONCE_NO_PROVIDER_NO_PERSISTENCE_NO_RUNTIME`.
