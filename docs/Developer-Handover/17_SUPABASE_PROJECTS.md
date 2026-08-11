# 17 — Projets Supabase (schéma réel)

**Statut documentaire :** `CURRENT` (rafraîchi 11 août 2026)
**Sources :** `studio/supabase/migrations/` (29 fichiers), `studio/supabase/tests/` (pgTAP), repos `studio/src/infrastructure/db/`, rapports `21_`–`58_`.
**Ne pas inventer** de table, colonne, RPC ou garantie absente du dépôt.

---

## 1. État Production validé (ops)

| Fait | Valeur |
|---|---|
| Migrations alignées Production | **29/29** (dont 3 marqueurs no-op `vhs_125_remainder_part{1,2,3}`) |
| `db reset` local | PASS (baseline post-10A) |
| pgTAP | **378** PASS |
| Intégration DB | **33/33** |
| Target guard | fail-closed (`supabase-target-guard.ts`) |
| Artifacts actifs texte | Marketing / Creative / Script / Visual / Storyboard — **rev.1** chacun |
| Director runs + provenance + ledger | validés sur smokes texte 10B–10F |
| Workspace budget hard limit | **122¢** (committed **112** / reserved **0** / available **10**) |
| Runtime AI | **OFF** |
| `production_jobs` média observés | **0** |
| P1 backup | `BACKUP_PRESENT_RESTORE_UNPROVEN` (ouvert) |

Identifiants Production : abréger / redacter hors runbooks.
Apply distant de migrations V2 : historique documenté (`21_`, plan `SUPABASE_V2_MIGRATION_PLAN.md`) — **ne pas** relancer sans autorisation humaine.

---

## 2. Modèle d’accès (réel)

| Élément | Réalité |
|---|---|
| Auth app | Mot de passe partagé (`APP_PASSWORD`) — **pas** Auth Supabase multi-users |
| Workspace | Mode `single_workspace` uniquement |
| RLS | **Activée** sur tables V2 ; **aucune** `CREATE POLICY` anon/authenticated |
| Écritures | **`service_role` serveur uniquement** (GRANTs explicites) |
| Workers | Même rôle serveur ; vérifient workspace/project dans les RPCs |

Ce n’est **pas** un modèle « propriétaire utilisateur / project_members ». La table `project_members` **n’existe pas**.

---

## 3. Inventaire des tables

Pour chaque table : nom réel, rôle, clé de scope, écritures, invariants, idempotence, statut.

### 3.1 Legacy (pré-V2) — conservées

| Champ | `vh_spend` | `vh_products` | `vh_scenes` |
|---|---|---|---|
| Rôle | Log spend V1 | Produits à promouvoir | Scènes legacy |
| Scope | global (pas de workspace) | global | global |
| Écritures | routes generate historiques | UI produits | UI scènes |
| Invariants | séparé du ledger V2 | — | — |
| Idempotence | non V2 | — | — |
| Statut | **implémenté** (ne pas recréer) | **implémenté** | **implémenté** |

Migrations : `20260723203021_…`, `20260728210808_…`. VHS-113 n’altère pas ces tables.

### 3.2 Workspaces et budget

#### `workspaces`

| | |
|---|---|
| Rôle | Tenant pilote |
| Scope | `id` PK |
| Écritures | seed / ops (pas UI libre) |
| Invariants | `mode = 'single_workspace'` ; `slug` UNIQUE |
| Idempotence | N/A |
| Statut | **implémenté** |

#### `workspace_budget_policies`

| | |
|---|---|
| Rôle | Hard limit budget workspace |
| Scope | PK `workspace_id` → `workspaces` |
| Écritures | ops / autorisations budget (Phases 10F) |
| Invariants | `hard_limit_minor >= 0` ; currency ISO 3 |
| Idempotence | N/A |
| Statut | **implémenté** — hard limit Production **122¢** |

### 3.3 Projets Director

#### `video_projects` *(pas `director_projects`)*

| | |
|---|---|
| Rôle | Racine projet Director |
| Scope | `workspace_id` + `id` |
| Écritures | RPC `create_director_project_with_brief` |
| Invariants | status ∈ draft…archived ; `active_revision >= 1` ; `correlation_id` |
| Idempotence | via fingerprint/commandes amont |
| Statut | **implémenté** |

### 3.4 Briefs, artifacts, révisions actives, stale

#### `project_artifacts`

| | |
|---|---|
| Rôle | Sorties versionnées JSONB (append-only) |
| Scope | `(project_id, artifact_type, revision)` UNIQUE |
| Écritures | RPCs `persist_*` (marketing_plan … export_package) |
| Invariants | trigger anti-UPDATE valeur / anti-DELETE ; types CHECK élargis VHS-125 |
| Idempotence | couple run + persist (révision unique) |
| Statut | **implémenté** |

Types artifact autorisés (CHECK final) :

```text
video_project_brief
marketing_plan
creative_concept
video_script
visual_direction
storyboard_project
scene_package
scene_package_set
generation_plan
production_result
quality_report
merge_plan
export_package
```

Domaine TS : `studio/src/domain/project/artifact-types.ts`.

#### `active_artifact_revisions`

| | |
|---|---|
| Rôle | Pointeur révision active + **stale** (VHS-126) |
| Scope | PK `(project_id, artifact_type)` |
| Écritures | `set_active_artifact_revision`, cascade stale `revise_project_brief` |
| Invariants | optimistic lock `expected_revision` ; cols `stale*` |
| Idempotence | conflict → `optimistic_conflict` |
| Statut | **implémenté** |

#### Brief

Le brief n’est **pas** une table séparée : artifact type `video_project_brief`.
Révision : RPC `revise_project_brief` + helpers `clear_active_artifact_stale` / `list_project_stale_artifacts`.

### 3.5 Approvals et revue humaine

#### `artifact_approvals`

| | |
|---|---|
| Rôle | Approbations append-only (plan / brief / storyboard…) |
| Scope | workspace + project + artifact |
| Écritures | `persist_artifact_approval` |
| Invariants | trigger append-only |
| Idempotence | clé métier côté RPC |
| Statut | **implémenté** (parcours fake local validé) |

#### `human_review_decisions`

| | |
|---|---|
| Rôle | Décisions revue humaine post-QC |
| Scope | workspace + UNIQUE `(workspace_id, idempotency_key)` |
| Écritures | `persist_human_review_decision` |
| Invariants | append-only ; FK quality_report + production_result |
| Idempotence | `idempotency_key` |
| Statut | **implémenté** (fake local) ; **0** usage média réel Production |

### 3.6 Projections plan / scènes

#### `storyboard_scenes`

| | |
|---|---|
| Rôle | Projection requêtable des scènes storyboard |
| Scope | UNIQUE `(project_id, storyboard_revision, scene_id)` |
| Écritures | persist storyboard |
| Statut | **implémenté** |

#### `generation_plans`

| | |
|---|---|
| Rôle | Projection opérationnelle du plan de génération |
| Scope | lié `artifact_id` → `project_artifacts` (`generation_plan`) |
| Écritures | `persist_generation_plan` |
| Invariants | coûts minor ; `registry_version` / `policy_version` |
| Statut | **implémenté** localement ; **0** plan actif Production post-Storyboard (Phase 11A) |

> Il n’existe **pas** de table `production_plans`. Le plan métier s’appelle `generation_plan` / `generation_plans`.

### 3.7 Director runs (texte + post-prod)

#### `director_runs`

| | |
|---|---|
| Rôle | Exécutions Director (marketing…export) |
| Scope | `workspace_id` ; UNIQUE `(workspace_id, idempotency_key)` |
| Écritures | `begin_or_get_*_director_run`, `begin_or_retry_director_run`, `fail_director_run`, `persist_*` |
| Invariants | types director : marketing, creative, script, art, storyboard, prompt, routing, production, quality, merge, export |
| Idempotence | `idempotency_key` + `command_fingerprint` ; retry `:attempt:N` |
| Statut | **implémenté** — smokes texte Marketing→Storyboard **PASS** en Production |

Retry / codes : `director_error_code_is_retryable`, `director_error_code_is_human_retryable`, helpers Art legacy timeout (VHS-133/134).
Métrage échec : VHS-130. Commit remainder succès : VHS-132 `director_budget_commit_reservation`.

### 3.8 Production runs / jobs / attempts

#### `production_runs`

| | |
|---|---|
| Rôle | Run de production lié à un generation plan |
| Scope | project + plan ; partial unique 1 actif/plan |
| Écritures | Production Director RPCs |
| Statut | **implémenté** (fakes locaux) ; **0** run média Production |

#### `production_jobs`

| | |
|---|---|
| Rôle | File worker + leases |
| Scope | UNIQUE `(run_id, scene_id, step_id, attempt_id)` |
| Écritures | enqueue + `claim_production_jobs` / heartbeat / complete / fail / release / `reschedule_production_job` |
| Invariants | lease TTL ; payload/result/error jsonb |
| Idempotence | attempt_id + clés amont |
| Statut | **implémenté** ; **0** job média observé Production |

#### `generation_attempts`

| | |
|---|---|
| Rôle | Tentatives provider (primary/fallback) |
| Scope | UNIQUE `idempotency_key` |
| Statut | **implémenté** (chemin fake) ; non prouvé provider média réel sur `/director` |

### 3.9 Ledger, réservations, idempotence, outbox

#### `cost_ledger`

| | |
|---|---|
| Rôle | Ledger append-only |
| Scope | workspace (+ project/run selon entrée) |
| Écritures | RPCs budget uniquement |
| Invariants | trigger anti-mutation ; UNIQUE `idempotency_key` ; types reservation/commit/release/adjustment/refund |
| Idempotence | `idempotency_key` |
| Statut | **implémenté** — smokes texte réels validés |

#### `budget_reservations`

| | |
|---|---|
| Rôle | Holds actifs |
| Scope | `production_attempt` \| `director_run` ; unique partial active |
| Écritures | `reserve_budget`, `reserve_director_budget`, commit/release |
| Invariants | hard limit = réservations actives + commits nets |
| Statut | **implémenté** |

#### `idempotency_records`

| | |
|---|---|
| Rôle | Idempotence commandes |
| Scope | PK `key` ; status begun/completed/failed ; `expires_at` |
| Écritures | `idempotency_begin` + complete/fail côté app |
| Statut | **implémenté** |

#### `domain_events`

| | |
|---|---|
| Rôle | Outbox |
| Scope | workspace/project ; `published_at` null = unpublished |
| Écritures | même transaction que persist RPCs |
| Statut | **implémenté** (publication asynchrone non obligatoire) |

### 3.10 Assets, audit, provenance

#### `assets`

| | |
|---|---|
| Rôle | Métadonnées média |
| Scope | workspace + project |
| Écritures | repos assets + ports Storage |
| Invariants | `provenance` jsonb ; `storage_bucket`/`path` ; `external_job_id` (pas `provider_job_id`) |
| Statut | **implémenté** (fake + Storage local) ; **0** asset média réel Production Director |

#### `audit_log`

| | |
|---|---|
| Rôle | Audit append-only |
| Scope | workspace ; `actor_type` shared_password/system/worker |
| Écritures | RPCs / ops budget |
| Invariants | trigger anti-mutation ; `correlation_id` |
| Statut | **implémenté** |

**Corrélation :** `correlation_id` sur projets, artifacts, runs, ledger, events, audit, human_review.

---

## 4. Storage buckets

| Bucket | Public | Limite | MIME | Migration | Statut |
|---|---|---|---|---|---|
| `product-screens` | false | défaut | — | init spend/products | **implémenté** |
| `director-final-assets` | false | 50 MiB | mp4/webm/mpeg/mp3/wav/png/jpeg/webp | VHS-127 | **implémenté** localement |

Aucune policy Storage permissive anon. Accès `service_role` + URLs signées côté serveur.
Convention chemin (préflight 10A) : `{workspace}/{project}/{container}/{asset}.{ext}` — **pas** `{ownerId}/…`.

Purge automatique Storage : **non implémentée** (nettoyage futur / VHS-206).

---

## 5. RPCs principales (regroupées)

| Domaine | Fonctions |
|---|---|
| Projet / brief | `create_director_project_with_brief`, `revise_project_brief`, `set_active_artifact_revision`, `clear_active_artifact_stale`, `list_project_stale_artifacts` |
| Director begin | `begin_or_get_{marketing,creative,script,art,storyboard,prompt,routing,production,quality,merge,export}_director_run` |
| Retry | `begin_or_retry_director_run`, helpers retryable / human_retryable / legacy art timeout |
| Persist | `persist_{marketing_plan,creative_concept,video_script,visual_direction,storyboard_project,scene_package_set,generation_plan,production_result,quality_report,merge_outcome,export_package,artifact_approval,human_review_decision}` |
| Fail / complete | `fail_director_run`, `complete_production_director_run` |
| Budget | `reserve_budget`, `reserve_director_budget`, `commit_budget_reservation`, `release_budget_reservation`, `director_budget_commit_reservation` |
| Queue | `claim_production_jobs`, `heartbeat_production_job`, `complete_production_job`, `fail_production_job`, `release_production_job`, `reschedule_production_job` |
| Idempotence | `idempotency_begin` |

---

## 6. Repositories applicatifs (mapping)

| Port / repo | Tables / RPCs |
|---|---|
| `project-repository.ts` | `video_projects` |
| `artifact-repository.ts` | `project_artifacts`, `active_artifact_revisions` |
| `create-project-with-brief.ts` | `create_director_project_with_brief` |
| `brief-revision-repository.ts` | `revise_project_brief` |
| `*-director-run-repository.ts` | `director_runs` + persist |
| `production-director-repository.ts` | production director + `production_runs` |
| `delivery-director-repository.ts` | quality/merge/export + `human_review_decisions` |
| `production-run-store.ts` / `production-job-queue.ts` | runs/jobs + claim RPCs |
| `asset-repository.ts` | `assets` |
| `budget-reservation-port.ts` | reserve/commit/release |
| `production-idempotency-port.ts` | `idempotency_records` |
| `production-event-port.ts` | `domain_events` |

`database.types.ts` est **partiel** (hand-maintained) — ne pas le traiter comme inventaire exhaustif.

---

## 7. Migrations (29) — ordre canonique

| # | Fichier |
|---|---|
| 1 | `20260723203021_vh_studio_init_spend_products_storage.sql` |
| 2 | `20260728210808_create_vh_scenes.sql` |
| 3 | `20260804134311_vhs_113_v2_core.sql` |
| 4 | `20260804134410_vhs_113_v2_production_queue.sql` |
| 5 | `20260804134443_vhs_113_v2_ledger_events_assets.sql` |
| 6 | `20260804134500_vhs_113_v2_rls_grants.sql` |
| 7 | `20260804134537_vhs_114_reschedule_payload.sql` |
| 8 | `20260804134814_vhs_116_create_project_with_brief.sql` |
| 9 | `20260804135019_vhs_117b_director_runs.sql` |
| 10 | `20260804135045_vhs_118b_creative_director_runs.sql` |
| 11 | `20260804135120_vhs_119b_script_director_runs.sql` |
| 12 | `20260804135149_vhs_120b_art_director_runs.sql` |
| 13 | `20260804135227_vhs_121b_storyboard_director_runs.sql` |
| 14 | `20260804135342_vhs_122_prompt_director_runs.sql` |
| 15 | `20260804135608_vhs_123_routing_director_runs.sql` |
| 16 | `20260804135702_vhs_124_production_director.sql` |
| 17 | `20260804135742_vhs_125_postproduction_delivery.sql` |
| 18–20 | `vhs_125_remainder_part{1,2,3}.sql` — **marqueurs no-op** (alignement historique Production ; voir `21_`) |
| 21 | `20260804140309_vhs_126_brief_revisions_stale.sql` |
| 22 | `20260804140422_vhs_127_director_final_assets_bucket.sql` |
| 23 | `20260804141000_vhs_128_director_run_retry_attempts.sql` |
| 24 | `20260805002706_vhs_129_director_human_retryable_error_codes.sql` |
| 25 | `20260805140000_vhs_130_fail_director_run_metering.sql` |
| 26 | `20260805143000_vhs_131_harden_reschedule_grants.sql` |
| 27 | `20260806120000_vhs_132_director_success_commit_remainder.sql` |
| 28 | `20260807213624_vhs_133_art_human_retry_input_artifact.sql` |
| 29 | `20260807213803_vhs_134_legacy_art_timeout_retry.sql` |

Règle : **ne jamais modifier** une migration déjà appliquée. Additif uniquement.

---

## 8. Target guard (fail-closed)

Fichier : `studio/src/infrastructure/config/supabase-target-guard.ts`.

- Classifie `SUPABASE_URL` : local / remote / other / missing.
- Hors Vercel : refuse remote sauf `VH_ALLOW_REMOTE_SUPABASE` explicite.
- Appelé depuis `studio/src/lib/supabase.ts` et `supabase-server.ts`.
- Gate intégration locale : `local-integration.gate.ts` (jamais de fallback distant silencieux).

---

## 9. Rétention — implémenté vs futur

| Implémenté | Futur (ne pas présenter comme livré) |
|---|---|
| `video_projects.archived_at` + status `archived` | Soft-delete + délai de récupération + purge cascade audité |
| Conservation historique artifacts/runs après stale | Job purge automatisé (**VHS-206**) |
| Champs `expires_at` (assets, reservations, idempotency) | Cron de purge DB |
| Bucket final : pas de suppression auto documentée | Purge Storage automatisée |
| Leases jobs (`expired_lease`) | — (TTL ops, pas rétention données) |

---

## 10. Maturité par couche (ne pas confondre)

| Couche | Local fakes | Production réel |
|---|---|---|
| Brief → Storyboard (texte) | ✅ | ✅ smokes 10B–10F |
| Prompt / Router / Production queue | ✅ | **0** artifacts/jobs média |
| Adapters média sur `/director` | fakes only (VHS-124) | **jamais** |
| Merge/export | fake + Storage local | non prouvé média réel |
| Soft-delete / purge | — | **futur** VHS-206 |

---

## 11. Concepts retirés / reclassés (doc ancienne)

| Ancien libellé | Traitement |
|---|---|
| `project_members` | **retiré** — n’existe pas |
| RLS « propriétaire utilisateur » | **reclassé** — service_role only |
| Soft delete + purge job | **futur** VHS-206 |
| `provider_job_id` | **remplacé** par `external_job_id` |
| Chemin `{ownerId}/…` | **remplacé** par `{workspace}/{project}/…` |
| Table `production_plans` | **inexistante** — utiliser `generation_plans` |
| Liste « tables minimales » incomplète | **remplacée** par §3 |

---

## 12. Cohérence et invariants transverses

- Artifacts append-only ; pointeur active + stale sans réécrire l’historique.
- Optimistic locking via révision attendue.
- Outbox `domain_events` dans la même transaction que les persist.
- Ledger append-only ; jamais de réécriture d’un coût historique.
- Tout appel payant Director : estimation + réservation avant provider (smokes texte prouvés).
- Migrations additives ; remainder VHS-125 = marqueurs d’alignement, pas de second schéma.

---

## 13. Motion Transfer — Persistence / Storage (MT-005)

Voir [`64_MT005_MOTION_TRANSFER_SUPABASE_STORAGE.md`](./64_MT005_MOTION_TRANSFER_SUPABASE_STORAGE.md) et [`59_…`](./59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md).

| Élément | Décision MT-005 |
|---|---|
| Tables `production_*` / `assets` / ledger / idempotency / audit | **REUSE_AS_IS** — pas de tables `motion_*` V1 |
| `human_review_decisions.decision` | **LOCAL_MIGRATION** `20260811180000_vhs_mt005_human_review_decision_extend.sql` — allowlist + retry intents — **NOT APPLIED** Production |
| Nouvel `ArtifactType` | **non** requis V1 |
| Storage bucket | **REUSE** `director-final-assets` (privé) |
| Storage paths | `{workspace}/{project}/motion/{role}/{assetId}.{ext}` |
| Asset roles | provenance `motionRole` (pas de CHECK `assets.kind`) |
| Statut | Gate MT-3 Persistence/Storage **PASS** · runtime unavailable · remote migration **NOT APPLIED** |
| MT-008 worker | **pas** de migration — phases motion dans `job.payload.motion` JSONB (`68_`) |
| MT-009 Motion QC | **pas** de migration — `MotionQcResult` mappé dans `quality_report` value (mémoire/tests) ; phases `qc_passed`/`qc_rejected`/`retry_recommended` dans payload JSONB (`69_`) |
| MT-010 Human Review | **pas** de nouvelle migration — réutilise `human_review_decisions` + MT-005 LOCAL_ONLY ; API `/motion/review` (`70_`) ; Production apply = **NO** |
| MT-012 Synthetic E2E | **pas** de migration — harness mémoire uniquement (`72_`) ; remote MT-005 reste **NOT APPLIED** |
| MT-013A MV-001 readiness | **pas** d’apply — audit restore/migration (`73_`) ; restore drill isolé **NON EXÉCUTÉ** ; Auth requise avant Gate E/F |

## 14. Liens

- Incident alignement distant : [`21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`](./21_VHS_125_REMOTE_MIGRATION_INCIDENT.md)
- Plan apply : [`SUPABASE_V2_MIGRATION_PLAN.md`](./SUPABASE_V2_MIGRATION_PLAN.md)
- Pilotage ops : [`BACKLOG_V2.md`](./BACKLOG_V2.md), [`57_…`](./57_PHASE_10F_STORYBOARD_V4_EXECUTE.md), [`58_…`](./58_PHASE_11A_FIRST_REAL_MEDIA_SMOKE_PREP.md)
- Motion Transfer : [`59_…`](./59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md)
- README migrations : `studio/supabase/README.md`
