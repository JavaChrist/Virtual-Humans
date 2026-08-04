# Plan d’application Supabase V2 (VHS-113)

> **Phase 9 (3 août 2026) :** validation **locale** complète (16 migrations, pgTAP 276, intégration 30, 2 cycles verts).  
> **Aucune** application distante effectuée. Apply distant = autorisation humaine séparée + backup préalable.

## Décisions pilote

Migrations locales : versions numériques alignées Production après Porte 3
(`20260804134311` … `20260804140422`, **22** fichiers incl. 3 marqueurs remainder VHS-125).
Voir `21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`. Ne pas confondre avec les anciens préfixes locaux `20260802*` / `20260803*`.

| Décision | Choix |
|---|---|
| Accès | Mot de passe partagé actuel + **single workspace** |
| Auth Supabase multi-utilisateurs | **Non** (pas encore) |
| Coûts | `vh_spend` historique **conservé** ; `cost_ledger` V2 **en parallèle** |
| Queue | Jobs durables + claim atomique + lease (workers **non activés** dans VHS-113) |
| Accès tables V2 | **Server / service_role uniquement** (RLS on, aucune policy anon) |

## Prérequis

- Projet distant Virtual Humans Studio déjà existant.
- Migrations distantes déjà appliquées (ne pas les recréer) :
  - `20260723203021_vh_studio_init_spend_products_storage`
  - `20260728210808_create_vh_scenes`
- Variables serveur : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DIRECTOR_V2_WORKSPACE_ID`.
- Autorisation **explicite et séparée** avant toute application distante.

## Migrations du dépôt

Dossier : `studio/supabase/migrations/`

| Fichier | Contenu |
|---|---|
| `20260802180000_vhs_113_v2_core.sql` | workspaces, projects, artifacts, active revisions, approvals, storyboard projection, generation_plans |
| `20260802180100_vhs_113_v2_production_queue.sql` | production_runs, production_jobs, generation_attempts, claim/heartbeat/complete/fail/release |
| `20260802180200_vhs_113_v2_ledger_events_assets.sql` | cost_ledger, budget_reservations, idempotency, domain_events, assets, audit_log, budget RPCs |
| `20260802180300_vhs_113_v2_rls_grants.sql` | RLS, REVOKE public, GRANT service_role |

## Alignement historique distant

Les migrations `vh_*` **ne sont pas** dans le dépôt (éviter une réapplication destructive).

Procédure recommandée avec le CLI :

1. `npx supabase link --project-ref <ref>`
2. `npx supabase migration list`
3. Si le CLI exige un baseline des versions distantes, utiliser `supabase migration repair --status applied` pour `20260723203021` et `20260728210808` **sans** rejouer leur SQL.
4. Appliquer uniquement les `20260802*`.

## Ordre d’application (distant — après autorisation)

1. Backup / snapshot projet.
2. Vérifier absence des tables V2 (`workspaces`, `video_projects`, …).
3. Appliquer les 4 migrations dans l’ordre timestamp.
4. Créer le workspace pilote :

```sql
INSERT INTO public.workspaces (id, slug, name, mode)
VALUES ('<uuid-stable>', 'pilot', 'Virtual Humans Pilot', 'single_workspace');

INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('<uuid-stable>', 100000, 'USD'); -- ex. 1000.00 USD en cents
```

5. Renseigner `DIRECTOR_V2_WORKSPACE_ID=<uuid-stable>` côté serveur (Vercel / `.env.local`).
6. Vérifications : RLS on, fonctions non exécutables par `anon`, tables `vh_*` intactes.

## Vérifications post-application

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%';
-- vh_spend / vh_products / vh_scenes toujours présents
-- workspaces … audit_log présents, rowsecurity = true

SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('claim_production_jobs', 'reserve_budget');
```

## Rollback opérationnel

1. Désactiver `DIRECTOR_V2_ENABLED` / ne pas brancher les adapters.
2. Arrêter tout worker (aucun worker VHS-113 par défaut).
3. Revenir au code précédent.
4. **Ne pas** dropper automatiquement les tables V2 en production.
5. Rollback SQL destructif réservé aux environnements locaux vides uniquement.

## Complément VHS-114 (locale, non appliquée distant)

| Élément | Détail |
|---|---|
| Migration | `20260802180400_vhs_114_reschedule_payload.sql` |
| RPC | `reschedule_production_job(job_id, lease_token, worker_id, available_at, payload)` |
| Motif | `release_production_job` ne met pas à jour `payload.mode` → `poll` ; nécessaire pour reprise async sans nouvel attempt |
| Grants | `REVOKE PUBLIC` + `GRANT EXECUTE … TO service_role` |
| Apply distant | **Non** — même discipline que VHS-113 |

### Écarts d’atomicité documentés

- Persist run + `complete_production_job` : pas de transaction unique cross-RPC. Ordre : PD persiste d’abord, worker complete ensuite ; crash intermédiaire → reclaim + `already_done` (at-least-once).
- Aucune RPC « complete job + enqueue next » atomique — enqueue via commandes PD après complete (idempotent unique attempt).

## Ce que VHS-113 / VHS-114 / VHS-116 ne font pas

- Aucune application distante automatique.
- Aucun endpoint/cron worker actif (factory présente, flags off).
- Aucune génération payante activée.
- Aucune modification des studios historiques / `vh_*`.
- Aucun bucket public nouveau.
- Aucun Directeur métier lancé depuis `/director`.

## VHS-116 — création atomique projet + brief

| Élément | Détail |
|---|---|
| Migration | `20260802180500_vhs_116_create_project_with_brief.sql` |
| RPC | `create_director_project_with_brief` — `SECURITY DEFINER`, `search_path=public`, `GRANT` **service_role** uniquement |
| Effets | `video_projects` + `project_artifacts` (rev 1) + `active_artifact_revisions` + `audit_log` + `domain_events` |
| Idempotence | même `project_id` + même payload métier brief → `existing` ; brief différent → `project_brief_conflict` |
| Workspace | `DIRECTOR_V2_WORKSPACE_ID` ; seed local : `CONFIRM_SEED_WORKSPACE=1 npm run supabase:seed-workspace` |
| Flag | `DIRECTOR_V2_PERSISTENCE_ENABLED` (off) ∧ `DIRECTOR_V2_ENABLED` |

## VHS-117B — director runs + budget scoped + marketing_plan

| Élément | Détail |
|---|---|
| Migration | `20260802180600_vhs_117b_director_runs.sql` |
| Table | `director_runs` (marketing only for now) |
| Budget | `budget_reservations.scope_type` ∈ `production_attempt\|director_run` ; `run_id` nullable pour director |
| RPC | `begin_or_get_marketing_director_run`, `reserve_director_budget`, `persist_marketing_plan`, `fail_director_run` |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-118B — creative director runs + creative_concept

| Élément | Détail |
|---|---|
| Migration | `20260803120000_vhs_118b_creative_director_runs.sql` |
| CHECK | `director_type` ∈ `marketing\|creative` ; `input_artifact_type` ∈ `video_project_brief\|marketing_plan` |
| RPC | `begin_or_get_creative_director_run`, `persist_creative_concept` (+ réutilise `reserve_director_budget` / `fail_director_run`) |
| Input run | `marketing_plan` actif ; brief actif vérifié |
| Output | `creative_concept` + révision active + audit/outbox |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-119B — script director runs + video_script

| Élément | Détail |
|---|---|
| Migration | `20260803130000_vhs_119b_script_director_runs.sql` |
| CHECK | `director_type` ∈ `marketing\|creative\|script` ; `input_artifact_type` ∈ `…\|creative_concept` |
| RPC | `begin_or_get_script_director_run`, `persist_video_script` |
| Input run | `creative_concept` actif ; brief + marketing_plan vérifiés |
| Output | `video_script` + révision active + audit/outbox |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-120B — art director runs + visual_direction

| Élément | Détail |
|---|---|
| Migration | `20260803140000_vhs_120b_art_director_runs.sql` |
| CHECK | `director_type` ∈ `…\|art` ; `input_artifact_type` ∈ `…\|video_script` |
| RPC | `begin_or_get_art_director_run`, `persist_visual_direction` |
| Input run | `video_script` actif ; brief + marketing_plan + creative_concept vérifiés |
| Output | `visual_direction` + révision active + audit/outbox |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-121B — storyboard director runs + storyboard_project

| Élément | Détail |
|---|---|
| Migration | `20260803150000_vhs_121b_storyboard_director_runs.sql` |
| CHECK | `director_type` ∈ `…\|storyboard` ; `input_artifact_type` ∈ `…\|visual_direction` |
| RPC | `begin_or_get_storyboard_director_run`, `persist_storyboard_project` |
| Input run | `visual_direction` actif ; chaîne amont vérifiée |
| Output | `storyboard_project` + projection `storyboard_scenes` + audit/outbox |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-122 — prompt director runs + scene_package_set

| Élément | Détail |
|---|---|
| Migration | `20260803160000_vhs_122_prompt_director_runs.sql` |
| CHECK | `director_type` ∈ `…\|prompt` ; `input_artifact_type` ∈ `…\|storyboard_project` ; artifact `scene_package_set` |
| RPC | `begin_or_get_prompt_director_run`, `persist_scene_package_set` |
| Input run | `storyboard_project` actif ; chaîne amont vérifiée |
| Output | lot atomique `scene_package_set` (packages[] cohérents) + audit/outbox |
| Budget | **aucun** (`cost_status=none`, provider `deterministic`) |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-123 — routing director runs + GenerationPlan approvals

| | |
|---|---|
| Migration | `20260803170000_vhs_123_routing_director_runs.sql` |
| CHECK | `director_type` ∈ `…\|routing` ; `input_artifact_type` ∈ `…\|scene_package_set` |
| RPC | `begin_or_get_routing_director_run`, `persist_generation_plan`, `persist_artifact_approval` |
| Input run | `scene_package_set` + storyboard + brief actifs |
| Output | artifact `generation_plan` + projection `generation_plans` (`ready`) + audit/outbox |
| Approvals | append-only `artifact_approvals` ; bump `video_projects.active_revision` ; stale via révision active |
| Budget | **aucune** réservation (`cost_status=none`, provider `deterministic`) |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-124 — production director runs

| | |
|---|---|
| Migration | `20260803180000_vhs_124_production_director.sql` |
| CHECK | `director_type` ∈ `…\|production` ; `input_artifact_type` ∈ `…\|generation_plan` |
| RPC | `begin_or_get_production_director_run`, `complete_production_director_run` |
| Input run | `generation_plan` actif (révision vérifiée) |
| Output | `production_run_id` dans audit/outbox + `director_runs.usage` ; `output_artifact_id` NULL |
| Budget | **aucune** réservation au begin/complete (`cost_status=none`, provider `deterministic`) |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-125 — postproduction delivery (QC / revue / merge / export)

| | |
|---|---|
| Migration | `20260803190000_vhs_125_postproduction_delivery.sql` |
| CHECK artifacts | `+ quality_report`, `merge_plan`, `export_package` (conserve `scene_package_set`) |
| CHECK director | `+ quality`, `merge`, `export` ; inputs `production_result` / `quality_report` / `merge_plan` |
| Table | `human_review_decisions` append-only (trigger interdit UPDATE/DELETE) |
| RPC | `persist_production_result`, `begin_or_get_quality_director_run`, `persist_quality_report`, `persist_human_review_decision`, `begin_or_get_merge_director_run`, `persist_merge_outcome`, `begin_or_get_export_director_run`, `persist_export_package` |
| Budget | **aucune** réservation (`cost_status=none`, provider `deterministic`) |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## VHS-126 — brief revisions + persistent stale cascade

| | |
|---|---|
| Migration | `20260803200000_vhs_126_brief_revisions_stale.sql` |
| Colonnes | `active_artifact_revisions.stale` (+ reason / since / caused_by / source_revision) |
| RPC | `revise_project_brief`, `list_project_stale_artifacts`, `clear_active_artifact_stale` |
| Atomicité | nouvelle révision + activation + cascade provenance + audit + outbox |
| Refuse | production run non-terminal active ; optimistic conflict ; anon/authenticated |
| Grants | `service_role` only |
| Apply distant | **non autorisé** sans décision écrite |

## Tests / VHS-115 ✅ … + VHS-123 + VHS-124 + VHS-125 + VHS-126

| Suite | Statut |
|---|---|
| `npm test` | unitaires **727** (incl. dependency-graph / brief-diff / revise) |
| `npx supabase db reset` | **16** migrations (jusqu’à `vhs_126`) |
| `npx supabase test db` | pgTAP **276** (incl. `vhs_126`) |
| `npm run test:integration:db` | **30** (incl. brief rev2 → stale → production refusée) |
| Opérations distantes | **Aucune** |

### Défaut corrigé avant déploiement

| Problème | Cause | Correction |
|---|---|---|
| `42501 permission denied for table workspaces` avec service_role | RLS on sans `GRANT` table à `service_role` | `GRANT SELECT/INSERT/UPDATE/DELETE` + `REVOKE` anon/authenticated dans `20260802180300` |

### Baseline historique (validation locale)

Les migrations `20260802*` / `20260803*` sont **indépendantes** de `vh_*`.  
Ne pas ajouter de fausses migrations `20260723*` / `20260728*` dans `migrations/`.

### Autorisation apply distant

VHS-115 technique ✅.  
**Apply distant toujours non autorisé** sans décision écrite séparée (backup, repair historique, fenêtre de maintenance).
