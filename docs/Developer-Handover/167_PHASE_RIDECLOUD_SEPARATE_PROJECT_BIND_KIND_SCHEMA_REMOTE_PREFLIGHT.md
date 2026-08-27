# 167 — RideCloud Bind Kind Schema Remote Preflight

**Date :** 2026-08-27  
**Auth :** `AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NO_PROVIDER`  
**Nature :** preflight distant Supabase **lecture seule** · **0** apply · **0** DDL · **0** DML · **0** persist bind  
**HEAD au départ :** `1d28f94` (`166_` SHA record)  
**HEAD de phase :** pending commit

```text
VERDICT = RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH
PHASE_COST = 0¢
REMOTE_SCHEMA_READS = 22
REMOTE_DDL_WRITES = 0
REMOTE_DML_WRITES = 0
MIGRATIONS_APPLIED = 0
RPC_FUNCTIONS_CREATED = 0
SUPABASE_MUTATIONS = 0
PRODUCTION_WRITES = 0
ARTIFACTS_CREATED = 0
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
NEXT_AUTH = AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER
```

---

## 1. Autorisation consommée

`AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_NO_PROVIDER` — Christian, chat courant.

Preflight distant read-only uniquement. Aucun apply. Aucune RPC. Aucun persist bind. Auth `166_` **non rejouée** comme apply.

`157_`–`166_` restent des snapshots immuables.

## 2. Git avant action

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `1d28f94` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS + `page.tsx` protégés · non touchés · non stagés |

## 3. Cible Production — avant connexion

| Champ | Preuve |
|---|---|
| Projet | `ejdb…nmvi` · Virtual Humans Studio |
| Host | `ejdb…nmvi.supabase.co` **allowlisté** |
| Région | `eu-west-3` |
| Statut | `ACTIVE_HEALTHY` |
| DB host | `db.ejdb…nmvi.supabase.co` |

Aucun secret, token ou chaîne de connexion loggué.

## 4. Migrations

| Champ | Distant | Local |
|---|---|---|
| Nombre | **32** | **33** |
| Dernière | `20260815215407` grant Voice | `20260827133000` bind kinds |
| Local-only | — | `20260827133000_vhs_ridecloud_bind_artifact_kinds.sql` |
| Remote unknown | **0** | — |
| Doublon / désordre | **0** | — |
| Hash fichier local | SHA-256 `6409a520979a382b…` | confirmé |
| Appliquée à distance | **jamais** | `schema_migrations` sans `20260827133000` |

Drift : `REMOTE_DRIFT_EXPECTED_LOCAL_AHEAD_1` · **admissible** pour un futur apply unique.

## 5. Schéma réel `project_artifacts`

| Champ | Distant observé |
|---|---|
| Table | `public.project_artifacts` présente · owner `postgres` |
| CHECK | `project_artifacts_type_check` · **1** contrainte type |
| Définition | `artifact_type = ANY (ARRAY[13 kinds historiques])` |
| Kinds | 13 historiques exacts · **0** `storyboard_contract` · **0** `media_input_manifest` |
| Colonnes | 11 attendues · `workspace_id`/`project_id`/`artifact_type` NOT NULL |
| Unicité | `project_artifacts_unique_rev` `(project_id, artifact_type, revision)` |
| Index | `project_artifacts_project_type_rev_idx` |
| FK | workspace, project, parent_revision |
| Triggers | `project_artifacts_append_only` BEFORE UPDATE/DELETE · **0** INSERT |
| Pointeurs | `active_artifact_revisions_type_check` = **mêmes 13 kinds** · non élargie |

Correspond au schéma source attendu de la migration locale. **0** `BLOCKED_REMOTE_DRIFT`.

## 6. Données — agrégats seulement

| Agrégat | Valeur |
|---|---|
| Lignes `project_artifacts` | **39** |
| Kinds inconnus / nouveaux | **0** |
| `storyboard_contract` | **0** |
| `media_input_manifest` | **0** |
| Toutes les lignes | satisfont le CHECK historique |

Répartition (counts only) : brief 4 · marketing 2 · creative 2 · script 2 · visual 1 · storyboard_project 1 · scene_package_set 2 · generation_plan 5 · production_result 13 · quality_report 7. **Aucun payload JSON lu.**

## 7. Sécurité

| Contrôle | Résultat |
|---|---|
| RLS | **ON** · force OFF |
| Policies | **0** |
| Grants table | `service_role` seulement · **0** anon/authenticated |
| `set_active_artifact_revision` | EXECUTE `service_role` only |
| INSERT → pointeur actif | **aucun** trigger INSERT |
| Activation auto des nouveaux kinds | **impossible** (CHECK actif inchangé) |
| Fonctions mentionnant les 2 kinds | **0** · pas de fallback générique |

## 8. Lock / futur apply — non exécuté

| Champ | Valeur |
|---|---|
| Table | 40960 octets |
| Indexes | 49152 octets |
| Lignes | 39 |
| Locks visibles | **0** |
| Fenêtre attendue | millisecondes à quelques secondes · 39 rows |
| `lock_timeout` dans le SQL versionné | **absent** (aucune convention dépôt) |
| Apply futur | **1** migration · 1 transaction · 0 DML · 0 RPC |
| STOP futur apply | locks > 0 · activité anormale · drift inattendu |
| Rollback | abort transaction si CHECK échoue · **non exécuté** |

## 9. Projet RideCloud

| Contrôle | Résultat |
|---|---|
| Projet `ba4a6021…` | unique · `draft` · workspace `3c308f57…` |
| Nom | RideCloud — First Founder Ad |
| Brief `adea092a…` | `video_project_brief` rev.1 |
| Bind kinds | **0** |
| `storyboard_project` | **0** |
| generation plan / run / job / attempt / asset | **0** |
| Pointeur actif | brief r1 seulement |

## 10. Budget / runtime — niveaux de preuve

| Champ | Valeur | Preuve |
|---|---|---|
| Budget | 437 / 391 / 0 / 46 | **DB** |
| Réservations actives | **0** | **DB** |
| Voice OFF | considéré OFF | **local code + documentaire** · Vercel **non relu** |
| Paid Media OFF | considéré OFF | **documentaire** · Vercel **non relu** |
| `submitCount` | 1 | **documentaire** `156_`/`164_` |
| `maySubmit` | false | **documentaire** |

## 11. Verdict

**`RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH`**

La migration locale peut être appliquée **ultérieurement** en sécurité. **Non appliquée ici.**

## 12. Prochaine autorisation exacte — non exécutée

**`AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER`**

Uniquement l’application distante de `20260827133000_vhs_ridecloud_bind_artifact_kinds.sql`. **Aucune** RPC bind. **Aucun** artifact write.

**Ne pas exécuter cette porte ici.**

## 13. Tests

| Check | Résultat |
|---|---|
| Ciblés remote preflight | **7/7** |
| migrations-static | **PASS** · 33 local / 32 remote |
| Suite unitaire | **1906/1906** |
| Typecheck | **PASS** |
| Fraîcheur | **PASS** · next = remote apply once |
| Secret scan | **PASS** |

AICCOS **exclus**. 0 média Git.

STOP.
