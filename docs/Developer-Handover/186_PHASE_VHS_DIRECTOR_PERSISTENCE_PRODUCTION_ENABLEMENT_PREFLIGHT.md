# 186 — VHS Director persistence Production enablement preflight

**Date :** 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER_NO_PRODUCTION_WRITE`  
**Nature :** preflight local lecture seule · tests + documents · **0** flag write · **0** deploy · **0** push · **0** mutation Production  
**HEAD / origin/main au départ :** `baa92c4`  
**SHA servi Production :** `baa92c4` · alias `dpl_8Bq6MJ72…`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_BLOCKED_HARDENING_REQUIRED
SOURCE_HEAD=baa92c4
ORIGIN_MAIN=baa92c4
AHEAD_BEHIND_AT_START=0/0
FUNCTIONAL_COMMIT=d376a7c
SCHEMA_READY=1
SECURITY_ISOLATION_PROVEN=1
DIRECTOR_PERSISTENCE_FLAG_WRITES=0
OTHER_FLAG_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
PRODUCTION_PROJECTS_CREATED=0
PRODUCTION_BRIEFS_WRITTEN=0
PRODUCTION_ARTIFACTS_WRITTEN=0
PRODUCTION_SUPABASE_MUTATIONS=0
PRODUCTION_STORAGE_READS=0
PRODUCTION_STORAGE_WRITES=0
PRODUCTION_MIGRATIONS_APPLIED=0
RIDECLOUD_MIGRATIONS_APPLIED=0
PROVIDER_CALLS=0
REAL_GENERATIONS=0
REAL_LIPSYNC_SUBMITS=0
REAL_MERGES=0
REAL_EXPORTS=0
SIGNED_URLS_CREATED=0
DOWNLOADS_TRIGGERED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
BUDGET_WRITES=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER_NO_PRODUCTION_WRITE` — Christian, chat courant.

Porte strictement locale. Aucune écriture Vercel. Aucun déploiement. Aucun push. Aucune mutation Supabase/Storage Production. Aucun projet Production créé. AICCOS non touché. RideCloud apply non consommée.

`157_`–`185_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| HEAD / origin/main au départ | `baa92c4` | docs `185_` actuellement servie |
| SHA fonctionnel hardening | `d376a7c` | UX fake · **dans le tree servi** |
| SHA servi `/api/version` | `baa92c4` | `gitShaShort=baa92c4` · `dpl_8Bq6MJ72…` |
| `8081744` | docs `183_` | source du redéploiement d’ouverture UI-only · **plus le SHA servi** |
| Commit local `186_` | ce commit tests+docs | **non poussé** · **non déployé** |

Ce n’est **pas** une ouverture persistence, ni une validation provider.

---

## 2. Préconditions

| # | Contrôle | Résultat |
|---|---|---|
| 1 | Racine `C:\Users\JavaChrist\Desktop\virtual-humans` | PASS |
| 2 | Fetch lecture seule `origin/main` | PASS |
| 3 | Branche `main` | PASS |
| 4 | HEAD = origin/main = `baa92c4` | PASS |
| 5 | ahead/behind `0/0` | PASS |
| 6 | Index vide | PASS |
| 7 | Dirty = 2 AICCOS seulement | PASS |
| 8 | Director UI-only ON | PASS · `GET /api/version` `baa92c4` · nav gated prouvée en `185_` · persistence routes 401 sans session |
| 9 | Persistence OFF | PASS · `/api/director/projects` sans session **401** (proxy avant 404) · `185_` live `directorV2Persistence=false` |
| 10 | Flags provider / paid / worker / 11A–11E / Motion OFF | PASS documentaire + parseur · `FORBIDDEN_ON=none` au `185_` |
| 11 | `mergeExportAuthorized=false` | PASS (vues Lipsync + Merge/Export) |
| 12 | RideCloud apply suspendu | PASS |
| 13 | Ledger 437 / 391 / 0 / 46 | PASS documentaire · 0 mutation |
| 14 | Aucune Auth provider réutilisée | PASS |
| 15 | Aucun accès média Production | PASS |

Working tree protégé : `studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx`.

---

## 3. Contrôle de persistence

Helper canonique : `canUseDirectorV2Persistence()` = `DIRECTOR_V2_ENABLED` ∧ `DIRECTOR_V2_PERSISTENCE_ENABLED`.  
Parseur : `parseStrictEnabledFlag` — ON seulement `"1"` / `"true"`.

| Flag | Ouvre | N’ouvre pas |
|---|---|---|
| `DIRECTOR_V2_ENABLED` seul | Layout `/director`, wizard local | liste, « Créer le projet », `/director/:id`, `/api/director/*` |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` seul | **Rien** | — |
| Les deux | CRUD projet + 25 routes API + pipeline persisté | IA texte, worker, média réel, Voice/I2V/Lipsync/Merge réels |

Persistence isolée **n’allume pas** implicitement : AI texte, paid generation, worker, Voice, I2V, Lipsync réel, Motion provider, publication.  
Elle **allume** toutefois des écritures déterministes (prompt / routing / production start / merge fake / QC / export / download / Human Review) dès que des artifacts amont existent. **C’est le blocker.**

---

## 4. Routes `/api/director/*`

25 fichiers. Auth = cookie HMAC proxy (pas de `requireStudioSession`). Workspace = `DIRECTOR_V2_WORKSPACE_ID` via `service_role`. Actor = `shared_password`. CSRF mutations `requireOrigin`. Rate limit mutations 120 / 60s / IP. GET non limités.

| Route | Methods | Catégorie | Verdict future persistence-only |
|---|---|---|---|
| `/api/director/projects` | GET, POST | base | **ALLOW_BASE** — create idempotent RPC + list cap 20 |
| `/projects/[projectId]` | GET | base | **ALLOW_BASE** — scope `workspace_id` |
| `…/brief/revisions` | GET, POST | base | **ALLOW_BASE** — CAS brief+projet |
| `…/brief/compare` | GET | base | **ALLOW_BASE** |
| `…/stale` | GET | base | **ALLOW_BASE** |
| `…/text-runs` | GET | base | **ALLOW_BASE** |
| `…/marketing` (+ retry) | GET, POST | forbidden isolé | GET/dry **ALLOW_BASE** · execute **503** si AI OFF |
| `…/creative` · `script` · `art` (+ retry) · `storyboard` | GET, POST | forbidden isolé | idem |
| `…/prompts` | GET, POST | fake pipeline | **HARDENING_REQUIRED** — execute si readiness, **sans** flag AI |
| `…/routing` | GET, POST | fake pipeline | **HARDENING_REQUIRED** — idem |
| `…/production` | GET, POST | fake pipeline | **HARDENING_REQUIRED** — start réserve budget + enqueue **sans** worker/paid |
| `…/production/cancel` | POST | base | **ALLOW_BASE** |
| `…/merge` | GET, POST | fake pipeline | **HARDENING_REQUIRED** — execute peut écrire Storage |
| `…/export` | GET, POST | fake pipeline | **HARDENING_REQUIRED** |
| `…/export/manifest` | GET | base | **ALLOW_BASE** — JSON redacted |
| `…/export/download` | GET | forbidden | **HARDENING_REQUIRED** — sert des octets |
| `…/quality` | GET, POST | fake pipeline | **HARDENING_REQUIRED** |
| `…/quality/review` | POST | forbidden | **HARDENING_REQUIRED** — Human Review |
| `…/approvals` | POST | base | **ALLOW_BASE** — types texte seulement |
| `…/motion/review` | GET, POST | forbidden | **HARDENING_REQUIRED** — bypass harness / `NODE_ENV=test` |

Absentes sous `/api/director` : Voice, Lipsync, logs, catalogue artifacts, DELETE projet.

Legacy hors Director (même cookie, **non activées** par persistence) : `/api/generate/voice`, `/api/generate/lipsync`.

---

## 5. Schéma et migrations

| Champ | Valeur |
|---|---|
| Local | **33** fichiers |
| Production attendue | **32** (revalidé documentairement ; 0 apply) |
| Local-only | `20260827133000_vhs_ridecloud_bind_artifact_kinds` · **non appliquée** · **non requise** |
| Nouvelle migration Director | **non** |
| Tables cœur | `video_projects` · `project_artifacts` · `active_artifact_revisions` · `director_runs` · `audit_log` · `domain_events` |
| RPC create | `create_director_project_with_brief` — replay `created`/`existing` · conflit brief |
| RPC revise | `revise_project_brief` — `p_idempotency_key` + fingerprint + CAS |
| RLS | ON · **0 policy** · deny JWT · `service_role` bypass |
| Grants anon/authenticated | **aucun** |
| Soft delete | `archived_at` · **pas de route DELETE** |
| Verdict schéma | **READY** — pas `BLOCKED_SCHEMA_HARDENING_REQUIRED` |

---

## 6. Lectures Production autorisées

| Contrôle | Résultat redacted-safe |
|---|---|
| `GET /api/version` | 200 · `gitShaShort=baa92c4` · `environment=production` · `deployedAt=null` · `buildId=dpl_8Bq6MJ72…` |
| `POST /api/version` | 403 |
| `GET /api/budget` sans session | 401 |
| `GET /api/director/projects` sans session | 401 |
| Contenu brief / média / dump | **non lu** |
| DML | **0** |

---

## 7. Matrice des écritures futures

### Autorisable persistence-only (après hardening)

- POST create projet + brief rev.1 (`video_projects` + 1 artifact) — 1 RPC atomique · IDs client · replay `existing`
- POST révision brief — CAS · append-only · stale cascade
- GET list / get / compare / stale / text-runs / dry-runs
- POST approvals texte · POST production cancel (si un run existait déjà)

### Fake/dry-run — **non autorisable** tant que les gaps existent

- POST execute prompt / routing / production / merge / quality / export
- Production start : réserve ledger + jobs même si worker/paid OFF
- Merge execute : `canUseDurableAssetContent` devient true dès persistence + creds
- GET download : octets

### Interdit

- Provider réel · budget write de validation · média réel · Human Review · activation · publication · merge/export réel · apply RideCloud

---

## 8. Audience et sécurité

Audience = titulaire du mot de passe partagé. Aucun rôle admin.

| Contrôle | Résultat |
|---|---|
| Non-auth | proxy 401 / pages → `/login` |
| Workspace | UUID env unique · filtres `workspace_id` · load hors workspace → `not_found` |
| IDOR cross-workspace | **prouvé** (intégration VHS-116 + services) |
| IDOR intra-workspace | **by design** — session partagée |
| CSRF | mutations `Origin` requis |
| Mass assignment | Zod `.strict()` / schemas métier · `status` / `archived_at` / `workspace_id` non client |
| Lifecycle | create `expectedBriefRevision=1` figé · revise CAS |
| Injection | UUID + Zod · `service_role` côté serveur |
| Rate limit | 120 mutations / min / IP · **GET exclus** · **pas de quota create** |
| Suppression | non exposée |
| Verdict sécurité isolation | **non bloqué** (single-tenant) |
| Verdict quotas | **hardening** — rate limit insuffisant contre accumulation de projets |

---

## 9. Idempotence

| Opération | Comportement |
|---|---|
| Create | IDs client stables (`createIdsRef`) · RPC replay `existing` · brief différent → 409 · course unique_violation retry 3 |
| Double clic | même `projectId`/`artifactId` → existing |
| Revise | `expectedBriefRevision` + `expectedProjectRevision` · replay fingerprint · 409 conflit |
| Révisions | monotones · artifacts append-only |
| Terminaux | immuables (trigger) |
| Provider retry/fallback | **aucun** sur le chemin isolé |
| Worker implicite | **aucun** au mount |

Create est assez idempotent pour une future ouverture **après** confinement du pipeline.

---

## 10. Simulation locale production-like

Processus isolé port **3113** (`e2e-start-server.mjs --persistence-only`) :

- `DIRECTOR_V2_ENABLED=1` + `DIRECTOR_V2_PERSISTENCE_ENABLED=1` dans le process seulement
- tous les flags payants / AI / worker / E2E / 11A–11E / Motion = `"0"`
- credentials provider vides
- barrière Playwright fail-closed
- Supabase **local** (fichier `.e2e-server-off.env`) — **pas** Production

Preuves visées : session · create · replay · brief durable · refresh/reprise · révision · conflit 409 · liste · lecture · UUID inconnu refusé · providers inaccessibles · média non 200 · marketing execute disabled · DELETE absent · logout.

Docker daemon arrêté pendant cette porte. Chemin durable (create/replay/revise) **skippé** (list 503). Surfaces prouvées : non-auth 401 · session · « Créer le projet » · « Projets récents » · APIs plus en 404 · flags live `directorV2` + `directorV2Persistence` · 0 provider UI · logout · mobile. Idempotence / isolation / CAS restent prouvées par les unitaires + VHS-116 historique.

---

## 11. UI future avec persistence

Devient visible : « Créer le projet » · « Projets récents » · `/director/:id` · brief persisté · « Modifier le brief » · pipeline complet.

IA texte : bouton « Lancer l’analyse — indisponible » si flags OFF.  
Voice / Lipsync / Merge réel : copies honnêtes disabled.  
Download / Publier : absents ou disabled dans Delivery.

Copy Home **stale** : « Les Directeurs métier ne sont pas encore actifs » alors que `/director/:id` montre le pipeline — mensonge de statut, pas un claim provider.

Blockers app-update : `directorProjectCreate` · `directorBriefDraft` · `directorBriefRevision` (et pipeline si atteint).

---

## 12. Rate limit et quotas

| Surface | Limite |
|---|---|
| Mutations Director | 120 / 60s / IP |
| GET Director | **aucune** |
| Create projet | **aucun quota** (list API cap 20, repo cap 50) |
| Login | 20 / 15 min (hors harness) |

Insuffisant pour une session partagée : double clic est couvert par l’idempotence ; l’accumulation de projets ne l’est pas. Hardening requis (quota create ou plafond workspace).

---

## 13. Backup et rollback (future activation — non exécuté)

1. `DIRECTOR_V2_PERSISTENCE_ENABLED=0`
2. Redéploiement Production du même source
3. UI revient localStorage-only
4. Projets / briefs / artifacts conservés
5. Aucune suppression automatique
6. Aucune migration rollback
7. `/api/director/*` et `/director/:id` redeviennent 404
8. Director UI-only **reste ON**
9. Providers restent OFF

---

## 14. Risques et hardening requis

| Gap | Gravité | Correctif exigé avant flag write |
|---|---|---|
| Prompt / routing execute si artifacts amont existent | haute | refuser execute isolé (flag dédié ou 403 si AI/worker/11* OFF) |
| Production start sans worker/paid | haute | refuser execute + **0 réserve budget** |
| Merge execute → Storage dès persistence + creds | haute | refuser execute / durable content si 11E OFF |
| GET `/export/download` sert des octets | haute | 404 si 11E OFF |
| Quality / export execute + HR | haute | refuser execute / review isolé |
| Projets Production existants (10B–10F, RideCloud) deviennent listables et pipeline-atteignables | haute | cacher **ou** refuser tout execute hors create/brief |
| Motion review bypass harness | moyenne | persistence obligatoire, pas de bypass Production |
| Pas de quota create | moyenne | plafond workspace / rate create |
| Copy Home contradictoire | basse | docs/UI (hors blocker fonctionnel) |
| `/api/settings` expose le snapshot flags | basse | hors scope |

**Aucun hardening n’a été implémenté silencieusement.**

---

## 15. Tests

| Check | Résultat |
|---|---|
| Preflight persistence (nouveau module) | **21/21** |
| Guards 25 routes | PASS |
| Auth / workspace / CAS / idempotence (sources + unitaires existants) | PASS |
| Blockers create/revise | PASS sources |
| Lipsync / Merge authorized=false | PASS |
| Suite unitaire complète | **2038/2038** |
| Playwright persistence-only 3113 | **4/4** · barrière 0 violation · chemin durable **skippé** (Docker/Supabase local arrêtés · list 503) |
| Typecheck (`next build`) | PASS |
| Lint fichiers de porte | 0 error |
| Build Production local | PASS |
| Fraîcheur living handover | PASS · `headStatus=pending commit` |
| Secret scan officiel (`findSecretHits`) | **0 hit** sur `186_` |

Intégration Docker VHS-116 (create/list/isolation) : **historique / locale** — non relancée (Docker daemon arrêté). Contrat réutilisé, pas rejoué. Pas une validation Production.

---

## 16. Compteurs

Voir le bandeau. Tous les compteurs sensibles = 0. `PHASE_COST=0¢`. `RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED`.

---

## 17. Plan exact de future activation — **non exécuté**

D’abord une porte de **hardening** :

```text
AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_IMPLEMENT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER
```

Elle devra :

1. Refuser POST execute (prompt, routing, production, merge, export, quality, quality/review, motion/review, Directors texte) lorsque les flags capacité correspondants sont OFF.
2. Empêcher toute réserve budget / enqueue / Storage / download octets dans cet isolé.
3. Décider explicitement du listing des projets Production existants (lecture brief seule vs masquage).
4. Ajouter un quota create raisonnable.
5. Conserver create / get / list / revise / compare / stale.

Ensuite seulement, une Auth flag distincte devra nommer :

- flag exact `DIRECTOR_V2_PERSISTENCE_ENABLED=1`
- projet `virtual-humans` · environnement Production
- écritures autorisées : create + brief + lectures
- tables : `video_projects`, `project_artifacts`, `active_artifact_revisions`, `audit_log`, `domain_events`
- nombre maximal d’écritures de validation
- audience session partagée
- providers OFF
- rollback §13
- vérifications Production

Aucune capacité réelle ni dépense n’est implicite.

---

## 18. STOP

```text
VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_BLOCKED_HARDENING_REQUIRED
```

Prochaine porte **non exécutée** : `AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_IMPLEMENT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER`.
