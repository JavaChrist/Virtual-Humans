# Supabase — Virtual Humans Studio V2

## Auth fail-closed (VHS-002 / Phase 7) — hors migrations

Les migrations DB ne gèrent pas l’auth applicative. Pour faire tourner `/director` en local après Phase 7 :

```text
# studio/.env.local (ne jamais committer)
APP_PASSWORD=local-dev-password-ok
APP_SESSION_SECRET=local-dev-session-secret-32chars-min
```

Sans ces variables, le proxy refuse tout accès protégé (fail-closed). Le worker interne reste derrière `DIRECTOR_V2_WORKER_SECRET` + flags — le cookie utilisateur ne suffit jamais.

## E2E locaux (Phase 8–9)

```powershell
npx supabase db reset
npm run test:e2e
# relancer une 2e fois après succès
npm run test:e2e
```

`e2e:prepare` crée un workspace `e2e-*` + secrets synthétiques (fichiers `.e2e-*` gitignorés). Mode `DIRECTOR_V2_E2E_FAKE_MODE=1` fail-closed (Supabase local, pas de clés provider). Voir `docs/Developer-Handover/18_TESTING.md`.

## Phase 9 — audit final local (3 août 2026)

Deux cycles complets indépendants (ordre strict) :

```powershell
npx supabase db reset
npx supabase test db
npm run test:integration:db
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

| Gate | Cycle 1 & 2 |
|---|---|
| Migrations | **16** |
| pgTAP | **276/276** |
| Intégration | **30/30** |
| Unitaires | **785/785** |
| E2E | **15/15** |
| Typecheck / lint / build | verts (lint 0 erreur, 16 warnings) |
| Providers / distant / deploy | **0** |

Store fake-merge mémoire : gate `local-fake-delivery` (local/E2E only). **Aucune** opération distante (`link` / `db push` / apply).

## Statut VHS-126 — Brief revisions + stale cascade (Phase 6)

Migrations locales clés :
- `20260803180000_vhs_124_production_director.sql`
- `20260803190000_vhs_125_postproduction_delivery.sql`
- `20260803200000_vhs_126_brief_revisions_stale.sql`

Checkpoint local **VHS-126 / Phase 6** (3 août 2026) :

| Étape | Résultat |
|---|---|
| `npx supabase db reset` | **16** migrations (jusqu’à `vhs_126`) |
| `npx supabase test db` | **276/276** (incl. `vhs_126`) |
| `npm run test:integration:db` | **30/30** (incl. brief revise → stale → prod refusée) |
| `npm test` | **727/727** |
| typecheck / lint / build | verts (lint : 0 erreur, warnings préexistants) |
| Feature flags | persistence / worker / paid / AI **off** par défaut |
| Providers réels | **0** |
| Opérations distantes | **Aucune** |
| Écritures `vh_spend` | **0** |

### Graphe canonique (domaine)

```text
video_project_brief
└─ marketing_plan
   └─ creative_concept
      └─ video_script
         └─ visual_direction
            └─ storyboard_project
               └─ scene_package_set
                  └─ generation_plan
                     └─ production_result
                        └─ quality_report
                           └─ merge_plan
                              └─ export_package
```

Source unique : `studio/src/domain/project/dependency-graph.ts` (`descendantsOf`, `determineRestartPoint`, provenance).

### Stratégie stale

- Persistée sur `active_artifact_revisions` (`stale`, `stale_reason`, `stale_since`, `stale_caused_by_*`, `stale_source_revision`).
- Cascade **par provenance** (ids amont référencés), pas seulement par position théorique.
- Branche indépendante non invalidée.
- `clear_active_artifact_stale` après nouveau persist director du même type.
- Approbations historiques append-only ; artifact stale → approbation refusée ; production refusée.
- Runs / coûts / assets historiques **conservés** ; jamais mutés rétroactivement.
- Révision Brief refusée si production run non-terminal active.

### Transaction `revise_project_brief`

```text
nouvelle révision immuable
+ activation
+ invalidation descendants (provenance)
+ audit + outbox
+ incrément verrou projet
```

Idempotence via fingerprint / audit. Optimistic locking brief + projet.

### API / UI

- `GET|POST /api/director/projects/[id]/brief/revisions`
- `GET …/brief/compare`
- `GET …/stale`
- UI `/director/[projectId]` : édition Brief contrôlée + confirmation modale + badges stale + CTA reprise Marketing.

### Pipeline `/director` validé

```text
Brief → Marketing → Creative → Script → Art → Storyboard
→ ScenePackageSet → GenerationPlan → approbations
→ ProductionRun → queue → worker → fakes → ProductionResult
→ QC → revue humaine → MergePlan → merge fake → ExportPackage → download
(+ Brief rev N → stale descendants → restart Marketing)
```

### Workspace de développement (local)

La persistance exige un UUID de workspace existant dans `workspaces` :

```powershell
cd studio
npx supabase start
$env:CONFIRM_SEED_WORKSPACE="1"
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

### Interdictions

- Pas de `supabase link` / `db push` / apply distant sans autorisation écrite.
- Pas d’OpenAI / fal / ElevenLabs / AICCOS réel dans les tests.
- Pas de second système de révisions / approbations / artifacts.
- `AssetContentPort` mémoire = fake local uniquement (jamais fallback production).
