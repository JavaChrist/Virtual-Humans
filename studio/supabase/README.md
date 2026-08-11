# Supabase — Virtual Humans Studio V2

## Ports locaux (Phase 10A-D)

API / DB / Studio : **54321 / 54322 / 54323** (`supabase/config.toml`).
Les ports 54921–54923 peuvent être exclus par Hyper-V sur Windows — vérifier
`netsh interface ipv4 show excludedportrange protocol=tcp` si `supabase start` échoue.

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

Deux cycles complets indépendants (ordre strict) — compteurs historiques Phase 9 : 16 mig. / pgTAP 276 / intégration 30 / unitaires 785.

## Porte 1 — stockage durable (4 août 2026)

Migration `20260804090000_vhs_127_director_final_assets_bucket.sql` :

- bucket privé `director-final-assets` (50 MiB, MIME allowlist) ;
- `public = false` ; aucune policy anon ;
- **ne touche pas** `product-screens` ;
- accès via `service_role` + `AssetContentPort` serveur uniquement.

Sélection adapter (`resolveAssetContentBackend`) :

| Contexte | Backend |
|---|---|
| E2E fake local sans `DIRECTOR_V2_E2E_ASSET_STORAGE` | mémoire process (Phase 8/9) |
| Persistence ON + Supabase | Storage durable |
| E2E + `DIRECTOR_V2_E2E_ASSET_STORAGE=1` | Storage durable |
| Vercel / prod / Supabase distant sans config | unconfigured (fail-closed) — **jamais mémoire** |

Conservation : pas de suppression automatique dans cette porte ; nettoyage futur borné par workspace/projet. Rollback local : désactiver persistence / revenir au commit précédent ; ne pas dropper le bucket en prod.

| Gate Porte 1 | Cycle 1 & 2 |
|---|---|
| Migrations | **17** (puis **22** après réconciliation historique Porte 3) |
| pgTAP | **286/286** |
| Intégration | **31/31** |
| Unitaires | **798/798** |
| E2E | **15/15** |
| Typecheck / lint / build | verts |
| Providers / distant / deploy | **0** |

## Historique Production (Porte 3 + 10A-B) — versions MCP

Les préfixes de fichiers sous `migrations/` portent les **versions numériques
Production** (`ejdbksxaswhdtsudnmvi`) après apply MCP.

Total local : **30** (29 Production alignées + MT-005 `vhs_mt005_human_review_decision_extend` **local-only / NOT APPLIED** Production).

VHS-125 : SQL canonique complet dans `20260804135742_vhs_125_postproduction_delivery.sql`.
Les fichiers `20260804140056` / `20260804140143` / `20260804140225`
(`vhs_125_remainder_part{1,2,3}`) sont des **marqueurs no-op** d’alignement
d’historique — voir `docs/Developer-Handover/21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`.

VHS-133 / VHS-134 (Phase 10A-B) : timestamps locaux réconciliés avec Production
`20260807213624` / `20260807213803` (corps de fonctions équivalents — voir
`docs/Developer-Handover/24_PHASE_10AB_ENVIRONMENT_SAFETY.md`). Aucune écriture distante.

## Statut VHS-126 — Brief revisions + stale cascade (Phase 6)

Migrations locales clés :
- `20260804135702_vhs_124_production_director.sql`
- `20260804135742_vhs_125_postproduction_delivery.sql`
- `20260804140309_vhs_126_brief_revisions_stale.sql`

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
