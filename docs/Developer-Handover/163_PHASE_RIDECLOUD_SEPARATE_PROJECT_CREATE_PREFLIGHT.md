# 163 — RideCloud Separate Project Create Preflight

**Date :** 2026-08-27  
**Auth :** `AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER`  
**Nature :** preflight local de création de projet · **0** write Production · **0** provider · **0** média  
**HEAD au départ :** `eb639b4` (`162_` SHA record)  
**HEAD de phase :** `628f61c`

```text
VERDICT = RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_READY
PHASE_COST = 0¢
PROVIDER_CALLS = 0
TTS_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
SUPABASE_MUTATIONS = 0
PRODUCTION_WRITES = 0
PRODUCTION_PROJECTS_CREATED = 0
RUNS_CREATED = 0
JOBS_CREATED = 0
ATTEMPTS_CREATED = 0
OUTPUTS_CREATED = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
LIVE_DUPLICATE_SELECT = NOT_EXECUTED
HARD = 437
COMMITTED = 391
RESERVED = 0
AVAILABLE = 46
NEXT_AUTH = AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER
```

---

## 1. Autorisation consommée

`AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER` — Christian, chat courant.

Conçoit, valide et documente la future création. Aucun projet créé. Aucune mutation Supabase/Vercel. Aucun provider, TTS, média, upload, run/job/attempt/output, réserve, flag ou déploiement.

`157_`–`162_` restent des snapshots immuables.

## 2. Git avant action

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `eb639b4` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS + `page.tsx` protégés |

## 3. Identité déterministe — redacted-safe

| Champ | Valeur |
|---|---|
| projectKey | `ridecloud-promo-separate-v1` |
| Nom | RideCloud — First Founder Ad |
| Workspace | `3c308f57…` · canonique 11A/11B/11C |
| Projet futur | `ba4a6021…` · UUID v5 déterministe |
| Brief futur | `adea092a…` · UUID v5 déterministe |
| correlation_id | `ridecloud-promo-separate-v1` |
| Propriétaire | Christian |
| Campagne | Programme Fondateur |
| Canaux | LinkedIn + Instagram |
| Langue | `fr` |
| Durée livrable | **26 s** |
| Master | 9:16 |
| Dérivés | 4:5 · 1:1 |

Le brief Director ne peut pas stocker 26 s (`DurationValues` = 15/20/30/60). La future écriture utilisera `durationSeconds=30` comme enveloppe de campagne déjà verrouillée `158_`, et consignera `delivery_duration_sec=26` dans `brandConstraints`. Le ratio 4:5 n’existe pas dans le brief ; le master reste 9:16.

## 4. Isolation

- Projet futur ≠ `984507af…` (11A/11B/11C) ≠ `390c25db…` (Motion MV-001).
- Preuves techniques 11A/11B/11C, SDK, fixtures E2E et icon/dashboard VHS **REJECTED_UNSAFE**.
- 0 mutation de pointeur 11A/11B/11C.
- 0 activation / publication.
- Motion isolé · Registry inchangé.
- Résolution future : stratégie **C** `explicit workspace/project/run/plan/output`.
- Fallback `current project` **refusé**.

## 5. Contrat créatif

6 plans · bornes 26 s · refs opaques `158_`/`159_` · pas de substitution auto 720p/HD · `narrator_female` rôle seulement · 0 musique · 0 lipsync · 0 bannière timeline · 0 badge Play · 0 marque véhicule · CTA Programme Fondateur · Premium à vie lié au Programme · conditions hors vidéo.

Le `storyboard_project` Director n’est **pas** persisté par la future écriture : son schéma exige marketing/creative/script/art. Le storyboard reste le contrat local Git.

## 6. Doublon — lecture seule

| Contrôle | Résultat |
|---|---|
| SELECT live `video_projects` | **NOT_EXECUTED** · preflight fake/local |
| Preuve documentaire `157_`–`162_` | **0** projet RideCloud Production |
| Denylist locale | **PASS** · IDs déterministes hors 11A/Motion |
| Unique DB `(workspace, name)` | **absente** |

Compensations de la future Auth : UUID déterministe comme PK + RPC `create_director_project_with_brief` (replay `existing` / conflit brief) + SELECT applicatif par nom exact avant insert.

## 7. Plan exact de la future écriture — non exécuté

**`AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER`**

1. Confirmer flags OFF · budget 437/391/0/46 · `maySubmit=false` · `submitCount=1`.
2. SELECT `video_projects` par ID `ba4a6021…` et par nom exact dans le workspace `3c308f57…`.
3. Si nom déjà porté par un autre ID → **refuser**.
4. Si ID technique 11A/Motion → **refuser**.
5. Appeler uniquement `create_director_project_with_brief` avec IDs déterministes, brief verrouillé, `status=draft`, fingerprint `b266a03b66436acd…`.
6. Replay identique → `existing` · brief différent → `project_brief_conflict`.
7. Interdit : génération · Storage · provider · dépense · réserve · run/job/attempt/output · flag · activation · pointeurs 11A/11B/11C · `storyboard_project` Director.

## 8. Verdict

**`RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_READY`**

## 9. Prochaine autorisation exacte — non exécutée

**`AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER`**

Création idempotente du projet séparé + brief textuel initial seulement. 0 provider · 0 média · 0 génération · 0 ¢.

**Ne pas exécuter cette porte ici.**

## 10. Tests

| Check | Résultat |
|---|---|
| Ciblés create preflight | **5/5** |
| Suite unitaire | **1879/1879** |
| Typecheck | **PASS** |
| Fraîcheur | **PASS** · next = create idempotent |

AICCOS **exclus**. 0 média Git.

STOP.
