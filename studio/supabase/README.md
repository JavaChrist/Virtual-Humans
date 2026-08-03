# Supabase — Virtual Humans Studio V2

## Statut VHS-122 — Prompt Director déterministe (`scene_package_set`)

Migration locale :
- `20260803160000_vhs_122_prompt_director_runs.sql`

Checkpoint local **VHS-122 / Phase 2** (3 août 2026) :

| Étape | Résultat |
|---|---|
| `npx supabase db reset` | 12 migrations (jusqu’à `vhs_122`) |
| `npx supabase test db` | **176** assertions |
| `npm run test:integration:db` | **26** (incl. prompt déterministe) |
| `npm test` | **672** |
| Feature flags | persistence / AI / paid **off** par défaut |
| Opérations distantes | **Aucune** |
| Appels provider | **Aucun** (Prompt sans OpenAI) |

### Tables / RPC (director)

- `director_runs` — `marketing` \| `creative` \| `script` \| `art` \| `storyboard` \| `prompt`
- Artifact actif lot Prompt : `scene_package_set` (jamais de demi-lot `scene_package` actif)
- RPC prompt : `begin_or_get_prompt_director_run`, `persist_scene_package_set` (pas de budget)
- RPC partagés : `reserve_director_budget`, `fail_director_run`

### Workspace de développement (local)

La persistance exige un UUID de workspace existant dans `workspaces` :

```powershell
cd studio
npx supabase start
$env:CONFIRM_SEED_WORKSPACE="1"
# Optionnel : fixer l’UUID avant seed
# $env:DIRECTOR_V2_WORKSPACE_ID="xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx"
npm run supabase:seed-workspace
```

Puis dans `.env.local` (ne pas committer) :

```text
DIRECTOR_V2_ENABLED=1
DIRECTOR_V2_PERSISTENCE_ENABLED=1
DIRECTOR_V2_WORKSPACE_ID=<uuid affiché>
SUPABASE_URL=<API_URL locale>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY locale>
```

Règles du seed :

- localhost / `127.0.0.1` uniquement ;
- `CONFIRM_SEED_WORKSPACE=1` obligatoire ;
- idempotent ;
- aucun secret affiché ;
- aucun fallback distant.

### Création atomique (VHS-116)

RPC `create_director_project_with_brief` :

- crée projet + brief rev 1 + active revision + audit + outbox dans **une** transaction ;
- `GRANT EXECUTE` → `service_role` uniquement ;
- idempotence sur payload métier (métadonnées volatiles ignorées) ;
- brief différent → `project_brief_conflict`.

Autosave serveur à chaque frappe : **non** (reste localStorage jusqu’à « Créer le projet »).

### Versions observées (VHS-115)

- Supabase CLI (npx) : **2.111.0**
- Docker Engine : **29.6.2**
- PostgreSQL (local) : major **17** (`config.toml`)

### Commandes reproductibles (local only)

```powershell
cd studio
# PATH Docker Desktop si besoin :
# $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

npx supabase start
npx supabase db reset
npx supabase test db

# Credentials locaux uniquement (ne jamais committer) :
$envMap = @{}; (npx supabase status -o env) | ForEach-Object {
  if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $envMap[$Matches[1]] = $Matches[2].Trim('"') }
}
$env:SUPABASE_LOCAL_INTEGRATION = "1"
$env:SUPABASE_LOCAL_URL = $envMap["API_URL"]
$env:SUPABASE_LOCAL_SERVICE_ROLE_KEY = $envMap["SERVICE_ROLE_KEY"]
$env:SUPABASE_LOCAL_ANON_KEY = $envMap["ANON_KEY"]   # optionnel (test RLS anon)

npm run test:integration:db

# Types depuis le schéma local (pas de --project-id distant) :
npx supabase gen types typescript --local > src/infrastructure/db/database.types.ts
```

### Interdit

```text
supabase link
supabase db push
supabase migration up --linked
supabase db remote commit
```

Ne jamais committer `supabase/.temp/` (secrets CLI locaux).

## Baseline historique

Les migrations V2 (`20260802*`) sont **indépendantes** de `vh_*` (pas de FK).  
Un reset local pour valider V2 **n’exige pas** de rejouer les migrations historiques distantes.  
Aucune fausse migration rétroactive `20260723*` dans ce dossier.

## Migrations du dépôt

| Fichier | Contenu |
|---|---|
| `20260802180000_vhs_113_v2_core.sql` | workspaces, projects, artifacts, … |
| `20260802180100_vhs_113_v2_production_queue.sql` | runs, jobs, claim/heartbeat/complete/fail/release |
| `20260802180200_vhs_113_v2_ledger_events_assets.sql` | ledger, budget, idempotence, events, assets, audit |
| `20260802180300_vhs_113_v2_rls_grants.sql` | RLS + **GRANT tables service_role** + REVOKE anon/authenticated + RPC grants |
| `20260802180400_vhs_114_reschedule_payload.sql` | `reschedule_production_job` |
| `20260802180500_vhs_116_create_project_with_brief.sql` | RPC atomique create project + brief |
| `20260802180600_vhs_117b_director_runs.sql` | director_runs + budget scoped + persist marketing_plan |

### Défaut corrigé en VHS-115

Les tables V2 n’avaient pas de `GRANT` explicite à `service_role`.  
Résultat : `permission denied for table workspaces` (42501) malgré RLS bypass.  
Corrigé dans `20260802180300` (migration non déployée distante).

## Alignement dépôt ↔ distant (documentation)

Le projet distant possède déjà (hors dépôt) :

| Version | Nom |
|---|---|
| `20260723203021` | `vh_studio_init_spend_products_storage` |
| `20260728210808` | `create_vh_scenes` |

**Application distante des migrations V2 : non autorisée sans décision écrite séparée**, même après VHS-116.

## Tests SQL

| Fichier | Couverture |
|---|---|
| `tests/vhs_113_smoke.sql` | smoke 6 assertions |
| `tests/vhs_115_schema_rls.sql` | 17 tables, RLS, grants, SECURITY DEFINER, search_path, anti-FK vh_* |
| `tests/vhs_115_behavior.sql` | artifacts append-only, claim/lease/complete/reschedule/reclaim, ledger/audit append-only, idempotency |
| `tests/vhs_116_create_project.sql` | RPC create project + brief, grants, idempotence, conflict, rollback |
| `tests/vhs_117b_director_runs.sql` | director_runs, reserve scoped, persist marketing_plan, idempotence |
| `tests/vhs_119b_script_director.sql` | Script Writer, révisions actives, budget, audit, idempotence |

## Tests repositories / director

- `src/infrastructure/db/repositories.integration.test.ts`
- `src/infrastructure/db/director-persistence.integration.test.ts`

Hors `npm test`, via `npm run test:integration:db`.  
Gate : `SUPABASE_LOCAL_*` + localhost uniquement (pas de fallback distant).
