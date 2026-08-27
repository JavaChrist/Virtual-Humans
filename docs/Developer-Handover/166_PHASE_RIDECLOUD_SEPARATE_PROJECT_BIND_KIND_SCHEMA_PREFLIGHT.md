# 166 — RideCloud Bind Kind Schema Preflight

**Date :** 2026-08-27  
**Auth :** `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER`  
**Nature :** preflight **local** de l’extension CHECK · migration locale **non appliquée** · **0** DDL distant · **0** persist bind · **0** provider  
**HEAD au départ :** `5b58fdc` (`165_` SHA record)  
**HEAD de phase :** `8976e49`

```text
VERDICT = RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_READY
PHASE_COST = 0¢
REMOTE_DDL_WRITES = 0
SUPABASE_MUTATIONS = 0
PRODUCTION_WRITES = 0
ARTIFACTS_CREATED = 0
PROJECTS_CREATED = 0
BRIEFS_UPDATED = 0
PROVIDER_CALLS = 0
TTS_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
HARD = 437
COMMITTED = 391
RESERVED = 0
AVAILABLE = 46
NEXT_AUTH = AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NO_PROVIDER
```

---

## 1. Autorisation consommée

`AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER` — Christian, chat courant.

Preflight local uniquement. Aucune migration distante. Aucun persist bind. Auth `165_` / `164_` **non rejouées**.

`157_`–`165_` restent des snapshots immuables.

## 2. Git avant action

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `5b58fdc` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS + `page.tsx` protégés · non touchés · non stagés |

## 3. Faits schéma versionné

Ne suppose aucun nom. Lu dans les migrations locales + `list_migrations` Production **lecture seule**.

| Champ | Valeur exacte |
|---|---|
| Table | `public.project_artifacts` |
| Contrainte CHECK | `project_artifacts_type_check` |
| Colonne contrôlée | `artifact_type` |
| Pointeurs actifs | `active_artifact_revisions_type_check` · **non élargie** |
| Unicité | `project_artifacts_unique_rev` `(project_id, artifact_type, revision)` |
| Index | `project_artifacts_project_type_rev_idx` `(project_id, artifact_type, revision DESC)` |
| Trigger | `project_artifacts_append_only` → `prevent_project_artifact_mutation()` · `search_path=public` |
| RLS | **enabled** · **0 policy** (deny anon/authenticated) |
| Grants | `service_role` SELECT/INSERT/UPDATE/DELETE · REVOKE ALL anon/authenticated |
| SECURITY DEFINER ajouté ici | **0** |

### CHECK actuel (Production + local jusqu’à `vhs_125`)

```sql
artifact_type IN (
  'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
  'visual_direction', 'storyboard_project', 'scene_package', 'scene_package_set',
  'generation_plan', 'production_result',
  'quality_report', 'merge_plan', 'export_package'
)
```

13 kinds historiques. `storyboard_contract` et `media_input_manifest` **absents**.

### Migrations qui ont produit l’état courant

| Migration | Effet |
|---|---|
| `20260804134311_vhs_113_v2_core` | CREATE table + CHECK initial (9 kinds) |
| `20260804135342_vhs_122_prompt_director_runs` | ajoute `scene_package_set` |
| `20260804135742_vhs_125_postproduction_delivery` | ajoute `quality_report`, `merge_plan`, `export_package` · **état courant** |

`ArtifactTypeValues` Director **non modifié** : les deux kinds bind restent hors pipeline `/director`.

## 4. Drift distant — lecture seule

`list_migrations` Production `ejdb…nmvi` le 2026-08-27 : **32** versions. Dernière : `20260815215407_vhs_11c_voice_identity_catalog_grant_hardening`.

| Compteur | Valeur |
|---|---|
| Local | **33** |
| Remote | **32** |
| Local-only | `20260827133000_vhs_ridecloud_bind_artifact_kinds` |
| Remote unknown locally | **0** |
| Drift | `REMOTE_DRIFT_EXPECTED_LOCAL_AHEAD_1` |

Aucun `db push`, `apply_migration`, DDL distant, branche DB. Apply **bloqué** derrière Auth remote preflight puis Auth apply distincte.

## 5. Migration locale préparée — non appliquée

Fichier : `studio/supabase/migrations/20260827133000_vhs_ridecloud_bind_artifact_kinds.sql`  
SHA-256 prefix : `6409a520979a382b`

| Règle | Tenue |
|---|---|
| Additive | 13 kinds historiques préservés + 2 ajoutés |
| Idempotente | no-op si les 2 kinds déjà présents · REFUSE état partiel |
| Cible explicite | vérifie `project_artifacts_type_check` ; exception si absente |
| Remplacement CHECK | DROP + ADD **dans la même transaction** |
| Fenêtre permissive | **0** — `ACCESS EXCLUSIVE` jusqu’au COMMIT |
| `NOT VALID` | **non utilisé** |
| DML | **0** INSERT/UPDATE/DELETE |
| Artifacts / projets / médias | **0** |
| Budget / flags / Storage | **0** |
| RLS / POLICY / GRANT | **inchangés** |
| RPC / FUNCTION | **0** |
| `active_artifact_revisions` | **non élargie** (fail-closed : pas de pointeur actif) |

PostgreSQL ne permet pas de remplacer un CHECK sans DROP/ADD. Verrou table `ACCESS EXCLUSIVE`. Si le CHECK historique manque ou n’est que partiellement étendu : `RAISE EXCEPTION` · rollback transaction.

Kinds ajoutés uniquement : `storyboard_contract`, `media_input_manifest`.

## 6. Invariants applicatifs (hors CHECK)

Conservés dans les validateurs `165_` / `166_` — **pas** surchargés dans le CHECK.

| Invariant | Règle |
|---|---|
| Parenté contract | parent = brief `adea092a…` |
| Parenté manifest | parent = contract `881760c3…` |
| workspace / project | obligatoires et identiques |
| IDs | déterministes · contract `881760c3…` · manifest `e1027004…` |
| rev | **1** initiale |
| active | **false** |
| payload | JSON textuel redacted-safe |
| Interdit | chemin local · URL · base64/blob · Storage · média · secret |
| Interdit | `current` / `latest` · activation auto · mutation brief rev.1 |
| HD | préférence explicite · **0** substitution auto |

## 7. RPC future — non créée

`create_director_project_with_brief` inspectée : **ne convient pas** (créerait projet/brief, élargirait le périmètre).

Contrat proposé seulement : `create_ridecloud_bind_artifacts`.

| Champ | Valeur |
|---|---|
| Préparé dans cette migration | **false** |
| Auth future | `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_RPC_PREFLIGHT_NO_PROVIDER` |
| Writes max | **2 INSERT** |
| RPC max | **1** atomique |
| Pointeurs actifs | **0** |
| UPDATE brief | **0** |
| Replay exact | `EXISTING` |
| Partiel / divergent | `REFUSE` · 0 retry |
| Grants futurs | `service_role` EXECUTE only · à auditer à la porte RPC |

Décision : **séparer** la porte RPC de l’application du CHECK. Cette migration ne crée aucune fonction.

## 8. Verdict

**`RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_READY`**

Migration locale prête. Production inchangée. 0 artifact persisté.

## 9. Prochaine autorisation exacte — non exécutée

**`AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NO_PROVIDER`**

Preflight distant **distinct**. Lecture seule. **Aucun apply**. 0 provider. 0¢.

**Ne pas appliquer la migration ici. Ne pas exécuter cette porte ici.**

## 10. Tests

| Check | Résultat |
|---|---|
| Ciblés schema/bind | **6/6** + bind `8/8` |
| migrations-static | **PASS** · local 33 / remote 32 |
| Suite unitaire | **1899/1899** |
| Typecheck | **PASS** |
| Fraîcheur | **PASS** · next = remote schema preflight |
| Secret scan | **PASS** |

AICCOS **exclus**. 0 média Git. Tests 11C historiques figés à l’ère Voice `<= 20260815215407` (32/32 snapshot).

STOP.
