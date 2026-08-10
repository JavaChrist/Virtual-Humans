# Changelog

Format inspiré de Keep a Changelog ; versions selon SemVer documentaire.

## [2.0.52] — 2026-08-10

### Validation provider réelle (Phase 10C)

- Premier smoke Creative texte réel : **1** appel OpenAI `gpt-5.6`, `CreativeConcept` Zod valide, persisté avec provenance.
- Budget : **12¢** estimés/réservés, **5¢** commités, **7¢** libérés ; ledger réconcilié.
- Replay idempotent : `status=existing`, **0** second appel provider.
- MarketingPlan 10B réutilisé sans rejoue ; **0** média / **0** worker ; flags refermés OFF.
- Rapport : `29_PHASE_10C_FIRST_REAL_CREATIVE_SMOKE.md`. Checkpoint local — **aucun push**.

## [2.0.51] — 2026-08-10

### Added (Phase 10C-PREP)

- Préparation smoke Creative sans appel provider : scripts verify / dry-run / flags / smoke dry-only / replay.
- Réutilisation du MarketingPlan 10B actif ; Marketing / Script / Art / Storyboard / worker / média explicitement exclus.
- Dry-run Creative : estimate **12¢**, réservation prévue **12¢**, plafond proposé **100¢** ; preuves sous `studio/.tmp/`.
- Rapport : `28_PHASE_10C_CREATIVE_SMOKE_PREP.md`. Aucune exécution 10C, aucun push.

### Fixed (UI)

- Indicateurs Next.js de développement masqués ; politique PWA locale (`next dev` OFF par défaut) ; cache favicon `?v=9`.

## [2.0.50] — 2026-08-10

### Fixed (post-10B-CLOSE audit)

- `fix-env-local-docker.mjs` résout la clé service_role via `supabase status` (fallback JWT demo local seulement).
- Scripts Vercel / lecture Production 10B : confirmations env explicites avant écriture ou lecture distante.
- Preuves smoke 10B écrites sous `studio/.tmp/` (gitignoré), plus sous `docs/`.

## [2.0.49] — 2026-08-10

### Security / Operations (Phases 10A–10B)

- Environnement local Supabase isolé de Production par un guard fail-closed ; cible distante refusée hors Vercel sans `VH_ALLOW_REMOTE_SUPABASE=1` explicite.
- Historique local réconcilié avec Production : **29/29** migrations, dont VHS-133/134 renommées avec les timestamps MCP sans changement de SQL.
- Validation locale : `db reset` PASS, pgTAP **378/378**, intégration DB **33/33**, unitaires **1016/1016**.
- Kill switches Vercel remis à zéro et runtime redéployé en position sûre après contrôle.

### Validation provider réelle (Phase 10B)

- Premier smoke Marketing texte réel : **1** appel OpenAI `gpt-5.6`, `MarketingPlan` valide Zod et persisté avec provenance complète.
- Budget : **24¢** estimés/réservés, **4¢** consommés, **20¢** libérés ; ledger réconcilié.
- Replay idempotent : même run, **0** second appel provider.
- **0** appel provider média, **0** job média ; flags réels refermés et runtime AI confirmé OFF.
- P0 : aucun ; P1 conservé : `BACKUP_PRESENT_RESTORE_UNPROVEN`.
- Rapports : `23_PHASE_10A_REMOTE_PREFLIGHT.md` à `27_PHASE_10B_FIRST_REAL_TEXT_SMOKE.md`.
- Checkpoint local uniquement — **aucun push**.

## [2.0.48] — 2026-08-04

### Added (Porte 7D-A — retry humain Director)

- **VHS-128** : colonnes `attempt_number`, `retry_of_run_id`, `retry_request_id` sur `director_runs`.
- RPC atomique `begin_or_retry_director_run` (clé `<base>:attempt:<N>`, idempotence `retry_request_id`).
- API `POST /api/director/projects/[projectId]/marketing/retry` + UI « Réessayer l’analyse ».
- Distinction 429 `rate_limit_exceeded` vs `insufficient_quota` (`quota_exceeded`) + obs redacted.
- Doc : `docs/Developer-Handover/22_DIRECTOR_HUMAN_RETRY.md`.
- **0** provider réel ; **0** migration distante ; **0** push.

## [2.0.47] — 2026-08-04

### Fixed (Préproduction — correctif Porte 3 / historique VHS-125)

- Réconciliation **locale uniquement** de l’historique de migrations avec Production `ejdbksxaswhdtsudnmvi` après troncature MCP de `vhs_125_postproduction_delivery`.
- Fichiers V2 renommés aux **versions numériques Production** (22 entrées alignées).
- Trois marqueurs no-op : `vhs_125_remainder_part{1,2,3}` (hashes des payloads distants documentés).
- SQL VHS-125 canonique **complet** conservé (rebuild local sans double apply).
- Doc incident : `docs/Developer-Handover/21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`.
- **0** écriture Supabase distante ; **0** `migration repair` ; **0** push.

## [2.0.46] — 2026-08-04

### Added (Préproduction — Porte 1)

- **VHS-127** : bucket Storage privé `director-final-assets` (migration locale idempotente).
- Adapter durable `createSupabaseStorageAssetContentPort` réutilisant le client Supabase serveur.
- Chemin déterministe `{workspace}/{project}/{container}/{asset}.{ext}` (UUID validés).
- Sélection d’adapter explicite (`resolveAssetContentBackend`) : Storage si persistence ; mémoire E2E uniquement derrière flags locaux ; jamais mémoire sur Vercel/production.
- Flag test `DIRECTOR_V2_E2E_ASSET_STORAGE` (harnais E2E) pour prouver merge → Storage → download multi-requête.
- Merge : octets persistés avant statut téléchargeable ; échec d’upload → merge failed.
- Tests : paths/MIME/collision/idempotence ; pgTAP bucket ; intégration multi-client Storage.

### Fixed (audit validation Porte 1)

- Réponses API merge/export : `storagePath` redacted (`[redacted]`) — manifeste déjà safe ; logs observabilité masquent aussi `storagePath`.
- Test hostile : `VERCEL=1` + `VERCEL_ENV=production` + fake E2E + `ASSET_STORAGE=0` → mémoire refusée.
- Parsing strict de `DIRECTOR_V2_E2E_ASSET_STORAGE` (`1`/`true` uniquement).
- Limite documentée : Storage et PostgreSQL ne partagent pas de transaction atomique ; reprise idempotente + fail-closed si put échoue.

### Validation (checkpoint post-audit)

- Migrations **17** ; pgTAP **286/286** ; intégration **31/31** ; unitaires **802/802** ; E2E **15/15** × 2 cycles.
- typecheck / lint (0 erreur, 16 warnings) / build verts.
- **0** provider réel / distant / déploiement ; flags payants off.
- Commit local uniquement — **aucun push**.

## [2.0.45] — 2026-08-03

### Security / Fixed (Phase 9 — audit final)

- Gate `local-fake-delivery` : store mémoire fake-merge **interdit** sur Vercel, en production hors harness E2E, et avec Supabase non-local ; backend absent → port non configuré (erreur explicite).
- Redaction observabilité : clés `dataUrl` / `inlineDataUrl` + détection valeur `data:…` → `[REDACTED]` (jamais de data URL dans logs).
- Tests de régression : `redactSources` (QC serveur), barrière fake-delivery, redact data URL.
- Lint : imports inutilisés E2E / tests Art & Storyboard corrigés.
- `.gitignore` : `supabase/.branches/`, `supabase/.temp/`.

### Validation

- **Deux cycles complets indépendants** verts (ordre : `db reset` → pgTAP → intégration → unitaires → typecheck → lint → build → E2E) :
  - Migrations **16** ; pgTAP **276/276** ; intégration **30/30** ; unitaires **785/785** ; E2E **15/15** × 2 ;
  - typecheck / lint (0 erreur, 16 warnings) / build verts.
- Aucune flakiness constatée entre cycles ; store mémoire nettoyable via harness.
- **0** provider réel / distant / déploiement / cron ; flags payants off par défaut.
- Conclusion locale : implémentation terminée avec fakes — **pas** production distante validée.

## [2.0.44] — 2026-08-03

### Added

- **Phase 8** : harnais E2E Playwright local pour `/director` (Chromium/Chrome).
- Mode `DIRECTOR_V2_E2E_FAKE_MODE` fail-closed (localhost Supabase, non-production, aucune clé provider) + injection analyzers fake via ports existants.
- Barrière réseau navigateur (refuse OpenAI/fal/ElevenLabs/AICCOS et hosts non locaux).
- Scripts `e2e:prepare` / `test:e2e` / `test:e2e:headed` ; workspace synthétique `e2e-*` + cleanup borné.
- Specs : flag off, auth/œil, parcours complet fake, erreurs, double-clic, conflit révision, mobile/clavier, sécurité, barrière réseau.

### Fixed (durcissement E2E)

- QC delivery : `buildProductionResult({ redactSources: false })` côté serveur — les sources `inline_data_url` ne sont plus `[redacted]` avant QC/merge.
- Store mémoire fake-merge **partagé au processus** (sinon merge écrit / download lit un Map vide).
- Storyboard E2E : `spokenContent` aligné sur le script ; dry-run filtre le bruit « clé absente » en fake mode.
- Helpers E2E : revue QC avec commentaire ; export avec modale ; download via API (`VH-FAKE-MP4-V1`).

### Validation

- E2E Playwright : **15/15** × **2** runs consécutifs (≈53 s / run) — Chromium/Chrome.
- Parcours `/director` complet : brief → … → merge fake → download `VH-FAKE-MP4-V1` + manifeste.
- Unitaires **776/776** ; typecheck / lint (0 erreur) / build verts ; pgTAP **276/276** ; intégration DB **30/30**.
- Correctif worker async : `awaiting_provider_job` reschedule en `mode: "poll"` (plus en `execute`).
- **0** provider réel / distant / déploiement ; flags payants off par défaut.

## [2.0.43] — 2026-08-03

### Fixed

- **Phase 7 correctif** : bouton œil afficher/masquer sur `/login` (masqué par défaut, `type="button"`, SVG local, `aria-label` / `aria-pressed`, `autoComplete="current-password"`) — aucune persistance client du mot de passe.
- Exemption cookie **wildcard** `/api/internal/**` **supprimée**. Seule exemption exacte : `POST /api/internal/director-worker/run-once` (secret worker + flags + rate-limit). `GET` et toute autre `/api/internal/*` refusés par défaut (cookie insuffisant pour le worker).

### Validation

- Checkpoint correctif Phase 7 : `db reset` 16 mig. ; pgTAP **276/276** ; intégration **30/30** ; unitaires **769/769** ; typecheck / lint (0 erreur) / build verts.
- **0** provider réel / distant / déploiement ; flags payants off.

## [2.0.42] — 2026-08-03

### Security

- **VHS-002 / Phase 7** : authentification **fail-closed** (plus jamais d’accès ouvert si secrets absents).
- `APP_PASSWORD` + `APP_SESSION_SECRET` obligatoires (longueur min, refus placeholders).
- Session cookie `vh_auth` : HMAC signé, TTL 12 h, HttpOnly, SameSite=Lax, Secure en production — plus de hash permanent rejouable.
- Comparaison mots de passe via digests + égalité temps constant.
- `POST /api/logout` (DELETE login → 405) ; CSRF Origin/Referer sur mutations cookie ; rate-limit mémoire best-effort (login / generate / director / worker / aiccos).
- API non authentifiée → **401 JSON** `no-store` (jamais redirect HTML) ; config invalide → **503**.
- Settings : booléens sûrs uniquement (plus de fuite `protected` / chemin SDK).
- Worker : secret dédié inchangé ; cookie utilisateur insuffisant ; raisons d’échec non exposées au client.
- Headers : CSP baseline, nosniff, Referrer-Policy, frame deny, Permissions-Policy ; SW v12 sans cache API / shells sensibles.

### Validation

- Checkpoint Phase 7 : `db reset` 16 mig. ; pgTAP **276/276** ; intégration **30/30** ; unitaires **754/754** ; typecheck / lint (0 erreur) / build verts.
- **0** provider réel / distant / déploiement ; flags payants off.

## [2.0.41] — 2026-08-03

### Added

- **VHS-126 / Phase 6** : révisions Brief immuables + invalidation descendante persistante.
- Graphe canonique domaine (`dependency-graph.ts`) : descendants, provenance exacte, `determineRestartPoint`.
- Diff Brief déterministe champs métier (`brief-diff.ts`) — aucun secret / URI / clé.
- Migration `20260803200000_vhs_126_brief_revisions_stale.sql` : colonnes stale sur `active_artifact_revisions` ; RPC atomique `revise_project_brief` ; `list_project_stale_artifacts` ; `clear_active_artifact_stale` ; grants `service_role` only.
- Service `ReviseProjectBrief` + port Supabase ; production refusée si artifacts actifs stale ; approbation refusée si artifact stale ; QC/merge refusés si `production_result` stale.
- API `GET|POST …/brief/revisions`, `GET …/brief/compare`, `GET …/stale` ; UI édition Brief + badges stale + CTA reprise Marketing.

### Validation

- Checkpoint Phase 6 : `db reset` 16 mig. ; pgTAP **276/276** ; intégration **30/30** ; unitaires **727/727** ; typecheck / lint (0 erreur) / build verts.
- Anciennes révisions non mutées ; artifacts/approbations historiques conservés ; **0** provider réel / distant / cron ; flags off.

## [2.0.40] — 2026-08-03

### Fixed

- **VHS-125 download** : `GET …/export/download` sert désormais les **octets réels** du média final (`Content-Type` MIME, `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`) — plus un JSON manifeste.
- Manifeste redacted déplacé vers `GET …/export/manifest` (distinct du média).
- `AssetContentPort` (mémoire injectable) + stockage des bytes synthétiques au merge fake ; `DownloadFinalAssetForProject` avec contrôles QC/revue/merge/MIME/taille/workspace.
- UI `DeliverySection` : boutons séparés « Télécharger le média final » / « Voir le manifeste ».

### Validation

- Checkpoint correctif : `db reset` 15 mig. ; pgTAP **254/254** ; intégration **29/29** ; unitaires **710/710** ; typecheck / lint (0 erreur) / build verts.
- Backend contenu non configuré → refus explicite (aucune fabrication) ; **0** fal/AICCOS/distant.

## [2.0.39] — 2026-08-03

### Added

- **VHS-125** : QC / revue humaine / merge / export persistants sur `/director` — migration `20260803190000_vhs_125_postproduction_delivery.sql` ; artifacts `quality_report` / `merge_plan` / `export_package` ; table append-only `human_review_decisions` ; director_types `quality` \| `merge` \| `export` ; RPC `persist_production_result`, `begin_or_get_quality_director_run`, `persist_quality_report`, `persist_human_review_decision`, `begin_or_get_merge_director_run`, `persist_merge_outcome`, `begin_or_get_export_director_run`, `persist_export_package`.
- Services `EvaluateProductionQualityForProject`, `RecordQualityReviewForProject`, `PrepareMergeForProject`, `ExecuteMergeForProject`, `PrepareExportForProject` ; `createFakeMergeEngine` (sync/async/error/timeout) — **aucun** fal réel.
- API `GET|POST …/quality`, `POST …/quality/review`, `GET|POST …/merge`, `GET|POST …/export`, `GET …/export/download` ; UI `DeliverySection`.
- Règles : `unknown` ≠ `pass` ; blocages techniques non waivable ; manifeste export redacted ; AICCOS stub non configuré ; destination download uniquement.

### Validation

- Checkpoint Phase 5 : `db reset` vert (15 mig.) ; pgTAP **254/254** ; intégration DB **29/29** ; unitaires **699/699** ; typecheck / lint (0 erreur, warnings préexistants) / build verts.
- Page `app/storyboard/page.tsx` inchangée ; **0** fal / AICCOS / OpenAI / ElevenLabs réel ; **0** apply distant / cron ; flags off.

## [2.0.38] — 2026-08-03

### Added

- **VHS-124** : Production Director branché `/director` — migration `20260803180000_vhs_124_production_director.sql` ; `director_type=production` ; input `generation_plan` ; RPC `begin_or_get_production_director_run` / `complete_production_director_run` ; service `StartProductionForProject` ; API `GET|POST …/production`, `POST …/production/cancel`, `POST /api/internal/director-worker/run-once` ; UI `ProductionSection`.
- Fake universal adapters (`fal` / `openai` / `elevenlabs`) uniquement sur le chemin production Director — **aucun** adaptateur réel ni clé `FAL_KEY` / OpenAI / ElevenLabs.
- Worker `runOnce` exposé (non auto-démarré) derrière `DIRECTOR_V2_WORKER_ENABLED` + `DIRECTOR_V2_PAID_GENERATION_ENABLED` + secret `DIRECTOR_V2_WORKER_SECRET` (`timingSafeEqual`, fail-closed).
- Approbations API étendues : `video_project_brief` | `storyboard_project` | `generation_plan`.

### Validation

- Checkpoint Phase 4 : `db reset` vert (14 mig.) ; pgTAP **216/216** ; intégration DB **28/28** ; unitaires **686/686** ; typecheck / lint (0 erreur, warnings préexistants) / build verts.
- Page `app/storyboard/page.tsx` inchangée ; **0** appel réseau provider réel ; **0** apply distant / cron / AICCOS.

## [2.0.37] — 2026-08-03

### Added

- **VHS-123** : Model Router persistant + approbation GenerationPlan — migration `20260803170000_vhs_123_routing_director_runs.sql` ; `director_type=routing` ; input `scene_package_set` ; RPC `begin_or_get_routing_director_run` / `persist_generation_plan` / `persist_artifact_approval` ; service `RouteGenerationPlanForProject` + `ApproveArtifactForProject` ; API `GET|POST …/routing` et `POST …/approvals` ; UI `RoutingSection`.
- Registry snapshot versionné content-addressé (`legacy-pricing-usd-v1:<hash>`) depuis le catalogue local ; politique `routing-policy-v1` ; zéro provider, zéro réservation budget, zéro `vh_spend`.
- Approbation append-only sur révision active ; stale automatique après nouvelle révision ; optimistic locking projet.

### Validation

- Checkpoint Phase 3 : `db reset` vert (13 mig.) ; pgTAP **199/199** ; intégration DB **27/27** ; unitaires **678/678** ; typecheck / lint (0 erreur, 14 warnings préexistants) / build verts.
- Page `app/storyboard/page.tsx` inchangée ; Prompt Director reste déterministe ; **0** OpenAI / provider / distant / déploiement / réservation génération.

## [2.0.36] — 2026-08-03

### Added

- **VHS-122** : Prompt Director persistant déterministe — migration `20260803160000_vhs_122_prompt_director_runs.sql` ; artifact canonique `scene_package_set` (lot atomique) ; RPC `begin_or_get_prompt_director_run` / `persist_scene_package_set` ; service `BuildScenePackagesForProject` ; API `GET|POST …/prompts` ; UI `PromptSection`.
- Aucun adaptateur IA : reconstruction domaine + analyzer déterministe vide ; `providerCalled: false` ; zéro réservation budget.
- Idempotence `prm:…` ; gate `expectedStoryboardRevision` ; couverture 1:1 scènes.

### Validation

- Checkpoint Phase 2 : `db reset` vert (12 mig.) ; pgTAP **176/176** ; intégration DB **26/26** ; unitaires **672/672** ; typecheck / lint (0 erreur) / build verts.
- Page `app/storyboard/page.tsx` inchangée ; **0** OpenAI / provider / distant / déploiement.

## [2.0.35] — 2026-08-03

### Fixed

- Checkpoint Phase 1 local validé : UUID pgTAP VHS-121B corrigé, correlation IDs d'intégration VHS-120B/VHS-121B rendus valides, et runner Windows `test:integration:db` rendu autonome pour la configuration Supabase locale avec refus strict des hôtes distants.

### Validation

- `supabase db reset` : vert ; pgTAP **160/160** ; intégration DB **25/25** ; unitaires **670/670** ; typecheck vert ; lint 0 erreur (14 warnings préexistants) ; build vert.
- Aucun appel provider réel, aucune opération Supabase distante, aucun déploiement.

## [2.0.34] — 2026-08-03

### Added

- **VHS-121B** : Storyboard persistant dans `/director` — migration `20260803150000_vhs_121b_storyboard_director_runs.sql` ; RPC `begin_or_get_storyboard_director_run` / `persist_storyboard_project` (+ projection `storyboard_scenes`) ; service `AnalyzeStoryboardForProject` ; API `GET|POST …/storyboard` ; UI `StoryboardSection`.

### Notes (checkpoint Phase 1)

- Unitaires **670** + typecheck + lint (0 erreur) + build — verts.
- **STOP checkpoint SQL/intégration** : Docker non installé sur la machine agent → `npx supabase db reset` / `supabase test db` / `test:integration:db` non exécutables. Relancer dès Docker disponible avant Phase 2.
- Gate : brief + Marketing Plan + Creative Concept + Script + Direction art actifs + readiness.
- Idempotence : clé `stb:…` ; gate optimiste `expectedVisualDirectionRevision`.
- Page historique `app/storyboard/page.tsx` **inchangée**.

### Notes

- Aucun appel OpenAI réel ; flags AI off par défaut ; aucune opération Supabase distante.

## [2.0.33] — 2026-08-03

### Added

- **VHS-121A** : adaptateur OpenAI `StoryboardAnalyzerPort` — Responses API + Structured Outputs `storyboard-analysis-candidate-v1`, prompt `storyboard-analyzer-v1`, mapping délimité incluant `visualDirection`, dry-run sans réseau.
- Flags : `DIRECTOR_V2_STORYBOARD_AI_ENABLED` + `canExecuteStoryboardAi` ; config `OPENAI_STORYBOARD_*`.
- StoryboardDirector : `provider_failed` pour erreurs provider (taxonomie VHS-117D).

### Notes

- Le domaine Storyboard reste seul autorité de timing ; aucun appel OpenAI réel.

## [2.0.32] — 2026-08-03

### Added

- **VHS-120B** : Art persistant dans `/director` — migration `20260803140000_vhs_120b_art_director_runs.sql` ; RPC `begin_or_get_art_director_run` / `persist_visual_direction` ; service `AnalyzeArtForProject` ; API `GET|POST …/art` ; UI `ArtSection`.
- Gate : brief + Marketing Plan + Creative Concept + Script actifs + readiness.
- Idempotence : clé `art:…` ; gate optimiste `expectedVideoScriptRevision`.

### Notes

- Aucun appel OpenAI réel ; flags AI off par défaut.

## [2.0.31] — 2026-08-03

### Added

- **VHS-120A** : adaptateur OpenAI `ArtAnalyzerPort` — Responses API + Structured Outputs `art-analysis-candidate-v1`, prompt `art-analyzer-v1`, mapping délimité Brief/Marketing/Creative/Script (+ characterCapabilities IDs/labels), dry-run sans réseau.
- Flags : `DIRECTOR_V2_ART_AI_ENABLED` + `canExecuteArtAi` ; config `OPENAI_ART_*` (modèle défaut `gpt-5.6-terra`, effort `low`, ~2800 tokens).
- ArtDirector : `provider_failed` pour erreurs provider (taxonomie VHS-117D).

### Notes

- Aucun appel OpenAI réel ; aucun branchement persistance dans 120A seul.

## [2.0.30] — 2026-08-03

### Added

- **VHS-119B** : Script persistant dans `/director` — migration `20260803130000_vhs_119b_script_director_runs.sql` ; RPC `begin_or_get_script_director_run` / `persist_video_script` ; service `WriteScriptForProject` ; API `GET|POST …/script` ; UI `ScriptSection`.
- Gate : brief + Marketing Plan + Creative Concept actifs + readiness (pas d’approval humaine en schéma).
- Idempotence : clé `scr:…` incluant `SPEECH_TIMING_ENGINE_VERSION` ; fingerprint SHA-256 des révisions sources.
- Timing : moteur VHS-103 seule autorité ; durée cible / calculée / tolérance exposées en view model.

### Notes

- Checkpoint final lot : `db reset` (9 migrations) + `test db` (**137**) + integration DB (**23**) + unitaires (**648**) + typecheck/lint/build — verts.
- Aucun appel OpenAI réel ; aucun smoke ; aucune opération Supabase distante ; flags AI toujours off.

## [2.0.29] — 2026-08-03

### Added

- **VHS-119A** : adaptateur OpenAI `ScriptAnalyzerPort` — Responses API + Structured Outputs `script-analysis-candidate-v1`, prompt `script-analyzer-v1`, mapping délimité Brief/Marketing/Creative et dry-run sans réseau.
- Flags serveur désactivés par défaut : `DIRECTOR_V2_SCRIPT_AI_ENABLED` + `DIRECTOR_V2_PAID_AI_ENABLED`; config Script dédiée (modèle, effort, tokens).

### Notes

- ScriptWriter préserve les erreurs provider en `provider_failed`; le moteur déterministe VHS-103 reste seul autorité de timing.
- Checkpoint : unitaires **643** + typecheck/lint/build — verts ; aucun réseau.
- Aucun branchement `/director`, route, persistance, migration ou appel OpenAI réel.

## [2.0.28] — 2026-08-03

### Added

- **VHS-118B** : Creative persistant dans `/director` — migration `20260803120000_vhs_118b_creative_director_runs.sql` ; RPC `begin_or_get_creative_director_run` / `persist_creative_concept` ; service `AnalyzeCreativeForProject` ; API `GET|POST …/creative` ; UI `CreativeSection`.
- Gate : brief actif + Marketing Plan actif + readiness (pas de champ approval Marketing dans le schéma).
- Idempotence : clé `cre:{projectId}:{briefArtId}:{briefRev}:{mktArtId}:{mktRev}:{model}:{prompt}:{schema}` ; fingerprint SHA-256 des révisions sources.
- Tests : pgTAP `vhs_118b_creative_director.sql` ; intégration `director-creative.integration.test.ts` ; unitaires service.

### Notes

- Checkpoint : `db reset` + `test db` (126) + integration DB (22) + unitaires (637) + typecheck/lint/build — verts.
- Aucun appel OpenAI réel ; aucun smoke ; aucune opération Supabase distante ; flags AI toujours off.

## [2.0.27] — 2026-08-03

### Added

- **VHS-118A** : adaptateur OpenAI `CreativeAnalyzerPort` — Responses API + Structured Outputs `creative-analysis-candidate-v1` ; prompt `creative-analyzer-v1` ; dry-run infra ; flags `DIRECTOR_V2_CREATIVE_AI_ENABLED` (off).
- Config : `OPENAI_CREATIVE_MODEL` (défaut `gpt-5.6-terra`), effort `low`, max tokens défaut 1600.
- Mapping OpenAI partagé remonté en `infrastructure/ai/openai/map-to-analyzer-failure.ts` ; Creative Director gère `provider_failed`.

### Notes

- Aucun branchement `/director` / route / persistance Creative ; aucun appel OpenAI réel ; aucun smoke.
- Suite unitaire : **629** pass.

## [2.0.26] — 2026-08-03

### Fixed

- **VHS-117D** : préservation de la taxonomie provider Marketing — `rate_limited` (et autres échecs OpenAI) ne deviennent plus `invalid_candidate`.
- Frontière : `MarketingAnalyzerError` → Director `provider_failed` ; candidat métier invalide reste `invalid` / `invalid_candidate`.
- HTTP : 429 + `Retry-After` borné ; timeout 504 ; indisponible 503 ; mapping via `mapMarketingFailureToHttp`.
- UI : messages publics sûrs ; dry-run conservé ; aucun retry automatique.

### Notes

- Aucun appel OpenAI réel ; aucun second smoke ; aucune migration.
- Persistance sans migration : seul `error_code` canonique dans `director_runs` (`retryable`/HTTP non stockés).
- Suite unitaire : **615** pass.

## [2.0.25] — 2026-08-03

### Added

- **VHS-117C** : runner smoke Marketing OpenAI local `scripts/smoke-marketing-openai.mjs` (`npm run smoke:marketing-openai`) — confirmation exacte, Supabase local only, compteur 1 appel, plafond 0,10 USD, flags process-local.

### Notes

- Smoke exécuté : **1** appel OpenAI réel via `AnalyzeMarketingForProject` ; réponse provider `rate_limited` ; budget réservé puis **libéré** ; aucun `marketing_plan` ; aucun retry.
- Conclusion : `VHS-117C échoué — aucun second appel autorisé`.
- Écart : mapping `rate_limited` → `invalid_candidate` côté Director — **corrigé en VHS-117D**.

## [2.0.24] — 2026-08-02

### Added

- **VHS-117B** : Marketing sur `/director/[projectId]` — dry-run UI ; table `director_runs` ; budget `scope_type=director_run` ; RPC `begin_or_get_marketing_director_run` / `reserve_director_budget` / `persist_marketing_plan` / `fail_director_run` ; API `GET|POST …/marketing` ; service `AnalyzeMarketingForProject`.
- Migration locale `20260802180600_vhs_117b_director_runs.sql`.
- Tests : SQL **113** ; integration **21** ; unitaires **599**.

### Notes

- Execute réel derrière flags AI (off) ; validations manuelles = dry-run uniquement.
- Aucun appel OpenAI payant ; aucune opération distante.
- Risque documenté : crash après OpenAI avant persist → replay idempotent côté run, pas d’idempotence provider confirmée.

## [2.0.23] — 2026-08-02

### Added

- **VHS-117A** : adaptateur OpenAI pour `MarketingAnalyzerPort` — client Responses injectable (`fetch`, pas de SDK) ; Structured Outputs strict ; prompt `marketing-analyzer-v1` ; schema candidat v1.0.0 ; dry-run ; pricing injecté (aucun prix marché en dur) ; `safety_identifier` HMAC.
- Flags serveur : `DIRECTOR_V2_MARKETING_AI_ENABLED`, `DIRECTOR_V2_PAID_AI_ENABLED` (défaut off ; séparés de `PAID_GENERATION`).
- Config : `OPENAI_MARKETING_MODEL` (défaut `gpt-5.6-terra`), `OPENAI_MARKETING_REASONING_EFFORT`, `OPENAI_MARKETING_MAX_OUTPUT_TOKENS`.

### Notes

- Aucun branchement `/director` / route Marketing / persistance `MarketingPlan`.
- Aucun appel OpenAI réel dans les tests ; aucun SDK `openai` ajouté.
- Suite `npm test` : **593** pass.

## [2.0.22] — 2026-08-02

### Added

- **VHS-116** : persistance brief `/director` — RPC atomique `create_director_project_with_brief` ; services create/get/list ; routes API + pages `/director/[projectId]` ; flag `DIRECTOR_V2_PERSISTENCE_ENABLED` (défaut off) ; seed local workspace (`npm run supabase:seed-workspace`).
- Migration locale `20260802180500_vhs_116_create_project_with_brief.sql`.
- Tests : SQL **100** assertions (dont 18 VHS-116) ; integration **20** ; unitaires **574** ; typecheck / lint (11 warnings préexistants) / build OK.

### Notes

- Autosave reste **local** (pas d’autosave serveur à chaque frappe).
- Aucun Directeur métier, provider, génération, endpoint worker.
- **Aucune** opération distante.

## [2.0.21] — 2026-08-02

### Added

- **VHS-115** : validation locale réelle — `npx supabase db reset` ×2 ; `supabase test db` **82** assertions ; `npm run test:integration:db` **15** tests (repositories + concurrence `Promise.allSettled`) ; types générés `database.types.ts` depuis `--local`.
- Tests SQL : `vhs_115_schema_rls.sql`, `vhs_115_behavior.sql`.
- Gate locale sans fallback distant ; `supabase/.temp/` ignoré (gitignore + eslint).

### Fixed

- **GRANT** manquant sur tables V2 pour `service_role` (erreur 42501) — corrigé dans `20260802180300_vhs_113_v2_rls_grants.sql` (non déployée distante).

### Notes

- CLI `npx supabase` **2.111.0** ; Docker **29.6.2** ; PG major 17 local.
- **Aucune** opération distante.
- Application distante des migrations : **toujours soumise à autorisation écrite séparée**.

## [2.0.20] — 2026-08-02

### Added

- **VHS-115 (préparation)** : inventaire prérequis ; `scripts/check-local-supabase.mjs` ; `npm run test:integration:db` (gate Docker) ; `local-integration.gate.ts`.

## [2.0.19] — 2026-08-02

### Added

- **VHS-114** : worker de production borné `studio/src/application/worker` (`ProductionWorker.runOnce`) ; policy / lease-guard / dispatcher / dry-run ; factory `infrastructure/worker` (pas d’auto-start).
- Production Director : `planEnqueueCommands` + `processClaimedJob` (scheduling/budget/fallback restent dans le PD).
- Feature flags serveur : `DIRECTOR_V2_WORKER_ENABLED`, `DIRECTOR_V2_PAID_GENERATION_ENABLED` (défaut off ; lectures centralisées).
- Migration locale `20260802180400_vhs_114_reschedule_payload.sql` — RPC `reschedule_production_job` (payload mode poll).
- Suite `npm test` à 558 tests.

### Notes

- Worker **désactivé par défaut** ; aucun endpoint HTTP ni cron.
- Garantie documentée : **at-least-once** + idempotence durable — pas exactly-once.
- Migrations V2 / RPC reschedule **non appliquées** distant.
- Aucune activation provider ; `/director` et routes historiques inchangés.

## [2.0.18] — 2026-08-02

### Added

- **VHS-113** : persistance Supabase V2 additive — migrations locales `studio/supabase/migrations/20260802*` (workspaces, artifacts, runs, queue/leases, ledger, idempotence, outbox, assets, audit) ; adapters injectables `studio/src/infrastructure/db` ; ports `application/projects` ; plan `SUPABASE_V2_MIGRATION_PLAN.md`.
- `DIRECTOR_V2_WORKSPACE_ID` documenté dans `.env.example`.
- Suite `npm test` à 536 tests (checks SQL statiques + fakes repositories).

### Notes

- **Aucune** application sur le projet Supabase distant.
- `vh_spend` / `vh_products` / `vh_scenes` inchangés ; ledger V2 en parallèle.
- Aucun worker / génération payante / modification `/director` ou routes historiques.
- CLI Supabase absent de l’environnement agent → `supabase test db` non exécuté (bloquant avant apply distant).

## [2.0.17] — 2026-08-02

### Added

- **VHS-111C** : pipeline AICCOS partagé `studio/src/infrastructure/export/aiccos` (download → import → PUT → complete) ; ports injectables ; mapping HTTP historique ; adapter `createAiccosExportAdapter` ; `mapExportPackageToAiccosRequest` ; dry-run AICCOS optionnel.
- Suite `npm test` à 528 tests.

### Changed

- Route historique `/api/aiccos/send` délègue au pipeline partagé — contrat HTTP, messages et auth inchangés.

### Notes

- Adapter AICCOS V2 **non** branché au Production Director ni à `/director` ; composant `SendToAiccos` inchangé.
- Aucun réseau en tests ; token uniquement dans la fabrique infra.

## [2.0.16] — 2026-08-02

### Added

- **VHS-111B** : helper pur partagé `studio/src/infrastructure/postproduction/fal-compose` (`buildFalComposePayload`, durées historiques, normalisation résultat/erreurs, port `FalComposeClientPort`) ; tests de caractérisation du mapping historique.
- Adapter injectable `createFalComposeMergeEngine` + `mapMergePlanToFalComposeInput` ; dry-run distingue stub / adapter configuré / polling / plan mappable (`providerCalled: false`).
- Suite `npm test` à 516 tests.

### Changed

- Route historique `/api/generate/merge` consomme le helper partagé pour `tracks/keyframes` — contrat HTTP, budget, modèle et submit inchangés.

### Notes

- Adapter V2 **non** branché au Production Director ni à `/director`.
- merge-audio / carousel / AICCOS hors périmètre (VHS-111C pour AICCOS).

## [2.0.15] — 2026-08-02

### Added

- **VHS-111** : Postproduction — domaine `studio/src/domain/postproduction` (qualité finale technique/contractuelle/éditoriale, revue humaine, `MergePlan`, capacités merge déclarées, export package/manifeste) ; application `studio/src/application/postproduction` (`PostProductionDirector`, dry-run, stubs Merge/AICCOS).
- **ProductionResult 1.1.0** : champ additif `delivery` (statuts `not_started`…`delivered`) ; migration pure `1.0.0` → `1.1.0` ; même `artifactType: production_result`.
- Backlog **VHS-111B** (extraction fal compose tracks/keyframes) et **VHS-111C** (extraction pipeline AICCOS).
- Suite `npm test` à 502 tests.

### Notes

- Merge/AICCOS = stubs `merge_adapter_not_configured` / `destination_not_configured` — aucun faux asset, aucun réseau.
- Routes historiques merge/merge-audio/carousel/aiccos **inchangées**.

## [2.0.14] — 2026-08-02

### Added

- **VHS-110** : Production Director — domaine `studio/src/domain/production` (états run/step, tentatives, scheduling, fallbacks du plan, qualité structurée, manifeste `ProductionResult`) ; application `studio/src/application/production` (`start` / `advance` / `requestCancellation`, ports budget/idempotence/qualité/events/run-store, dry-run `providerCalled: false`).
- Fallbacks uniquement ceux du `GenerationPlan` ; budget réservé par tentative ; idempotence PD (engine sans double-begin) ; fakes mémoire **tests uniquement**.
- Suite `npm test` à 486 tests.

### Notes

- Aucune queue durable, Supabase, merge/export, UI, route payante ni store mémoire en runtime prod.
- Reprise après crash non garantie sans store durable.

## [2.0.13] — 2026-08-02

### Added

- **VHS-109** : Generation Engine — domaine `studio/src/domain/generation` (commande, entrées canoniques, résultats, erreurs, idempotence/empreinte, ports) ; application `studio/src/application/generation` (`GenerationEngine`, Adapter Registry, dry-run `providerCalled: false`) ; infrastructure `studio/src/infrastructure/providers` (wrappers fal / OpenAI image / ElevenLabs voice via ports injectables).
- Cancel/webhook explicitement **unsupported** (absents des helpers existants).
- Suite `npm test` à 466 tests.

### Notes

- Aucun appel réseau réel ; routes historiques et `lib/providers/*` non modifiés.
- Idempotence validée/transmise sans store durable ; pas de Production Director / queue / UI / persistance.

## [2.0.12] — 2026-08-02

### Added

- **VHS-108** : Model Router — domaine `studio/src/domain/routing/router` (`GenerationPlan`, bibliothèque de stratégies provider-agnostic, scoring explicite, estimation `Money`/`CostEstimate`, fallbacks ≤2, explications, validation, moteur pur) et application `studio/src/application/routing/model-router` (`createModelRouter`, dry-run `providerCalled: false`).
- Politique versionnée `routing-policy-v1` (poids normalisés, tie-break lexical, inconnus non inventés).
- Suite `npm test` à 450 tests.

### Notes

- Snapshot legacy partiel : nombreuses scènes `no_eligible_strategy` (dialogue/identité) — attendu ; tests happy-path sur registre synthétique vérifié.
- Aucun appel réseau, aucune exécution, aucune réservation budget, aucune route/UI/persistance.
- Generation Engine / Production Director non démarrés.

## [2.0.11] — 2026-08-02

### Added

- **VHS-107** : Capability Registry versionné — domaine `studio/src/domain/routing/capabilities` (`ProviderDefinition`, `ModelCapabilities`, `CapabilityRegistrySnapshot`, pricing `Money`, éligibilité pure, requirements depuis `ScenePackage`, dry-run `providerCalled: false`) et application `studio/src/application/routing` (adaptateur legacy depuis catalogue `pricing.ts` sans le modifier, builder déterministe).
- Inventaire factuel des modèles/providers réellement référencés ; capacités absentes laissées `unknown` ; aucun score/classement/Router.
- Suite `npm test` à 430 tests.

### Notes

- Snapshot partiel valide depuis le catalogue legacy ; dialogue natif / multi-personnage / régions **non déduits** des labels.
- Aucun appel réseau, aucune route API, aucune modification `/director` ni `pricing.ts` / adapters providers.
- Model Router / Generation Engine non démarrés.

## [2.0.10] — 2026-08-02

### Added

- **VHS-106** : Prompt Director — domaine `studio/src/domain/prompt` (`ScenePackage` par scène, blocs sémantiques provider-agnostic, profils de capacités abstraits, contraintes, références, renderers déterministes `prompt-renderer-v1`, protection injection FR/EN, Zod, finalize) et orchestration `studio/src/application/directors/prompt` (`PromptDirector`, `PromptAnalyzerPort`, dry-run `providerCalled: false`).
- Enveloppe applicative `PromptDirectorOutput` ; candidat analyzer non autoritaire ; reconstruction depuis Storyboard + chaîne amont.
- Suite `npm test` à 390 tests.

### Notes

- Dry-run = readiness chaîne brief→…→Storyboard — **aucun ScenePackage inventé**.
- Aucun adaptateur IA, aucun composer modèle-spécifique, aucune route/API, aucune modification des prompts historiques ni de `/director`, aucune persistance.
- Model Router / Generation Engine non démarrés.

## [2.0.9] — 2026-08-02

### Added

- **VHS-105** : Storyboard Director — domaine `studio/src/domain/storyboard` (`StoryboardProject`, scènes de production, couverture segment→scènes, timing déterministe, continuité projetée, transitions, Zod, finalize) et orchestration `studio/src/application/directors/storyboard` (`StoryboardDirector`, `StoryboardAnalyzerPort`, dry-run `providerCalled: false`).
- Note de coexistence `historical-mapping.ts` : page `app/storyboard/page.tsx` reste le seul moteur UI ; domaine = cible d’extraction ; interdiction `/storyboard-v2`.
- Suite `npm test` à 356 tests.

### Notes

- Dry-run = readiness chaîne brief→…→VisualDirection — **aucun storyboard inventé**.
- Aucun adaptateur IA, aucune route/API, aucune modification de la page Storyboard historique ni de `/director`, aucune persistance.
- Prompt Director / Model Router non démarrés.

## [2.0.8] — 2026-08-02

### Added

- **VHS-104** : Art Director — domaine `studio/src/domain/art` (`VisualDirection`, palette, continuité, direction par segment script, accessibilité couleurs, Zod, finalize) et orchestration `studio/src/application/directors/art` (`ArtDirector`, `ArtAnalyzerPort`, dry-run `providerCalled: false`).
- Snapshot Runtime domaine-safe `CharacterCapabilitiesSnapshot` + adaptateur pur `application/runtime/character-capabilities.ts` (pas d’I/O, pas de chemins).
- Conservation Marketing/Creative/Script ; frontières anti prompt/provider/modèle/découpage technique.
- Suite `npm test` à 309 tests.

### Notes

- Dry-run = readiness brief/plan/concept/script (+ snapshot si personnage) — **aucune VisualDirection inventée**.
- Aucun adaptateur IA, aucune route/API, aucune modification `/director`, aucune persistance, Runtime SDK inchangé.
- Storyboard Director et Prompt Director non démarrés.

## [2.0.7] — 2026-08-02

### Added

- **VHS-103** : Script Writer — domaine `studio/src/domain/script` (`VideoScript`, segments, hook/CTA, moteur de timing déterministe `timing.ts`, Zod, finalize) et orchestration `studio/src/application/directors/script` (`ScriptWriter`, `ScriptAnalyzerPort`, dry-run `providerCalled: false`).
- Profils linguistiques versionnés FR/EN + fallback ; tolérance ±10 % ; rapport de timing toujours recalculé (jamais confié au candidat).
- Conservation MarketingPlan + CreativeConcept ; frontières anti décor/caméra/prompt/provider.
- Suite `npm test` à 256 tests.

### Notes

- Dry-run = readiness brief/plan/concept uniquement — **aucun script inventé**.
- Aucun adaptateur IA, aucune route/API, aucune modification `/director`, aucune persistance.
- `emotion` = intention vocale uniquement.

## [2.0.6] — 2026-08-02

### Added

- **VHS-102** : Creative Director — domaine `studio/src/domain/creative` (`CreativeConcept`, schémas Zod, arc émotionnel, dispositifs, références génériques, conservation du `MarketingPlan`, finalize) et orchestration `studio/src/application/directors/creative` (`CreativeDirector`, `CreativeAnalyzerPort`, dry-run `providerCalled: false`).
- Réutilisation de `DirectorRunContext` marketing ; fake analyzer uniquement dans les tests.
- Helpers `toCreativeConceptViewModel` ; suite `npm test` à 217 tests.

### Notes

- Dry-run vérifie readiness plan+brief — **ne fabrique pas** de `CreativeConcept`.
- Aucun adaptateur IA, aucune route/API, aucune modification `/director`, aucune persistance.
- Frontières : pas de dialogue, découpage, caméra, prompt, provider ni coût de génération.

## [2.0.5] — 2026-08-02

### Added

- **VHS-101** : Marketing Director — domaine `studio/src/domain/marketing` (`MarketingPlan`, schémas Zod, invariants, normalisation, traçabilité, readiness) et orchestration `studio/src/application/directors/marketing` (interface `MarketingDirector`, port `MarketingAnalyzerPort`, dry-run local `providerCalled: false`).
- Objectif marketing aligné sur le vocabulaire brief (`mapBriefObjectiveToMarketing` identité) ; métrique structurée ; preuves / hypothèses / rationale sans brief complet.
- Fake analyzer **uniquement** dans les tests ; aucun adaptateur provider, aucune route API, aucune intégration `/director`.
- Helpers de présentation purs `toMarketingPlanViewModel` (préparation UI future).
- Tests schémas / invariants / dry-run / director / compatibilité ; suite `npm test` à 177 tests.

### Notes

- Dry-run valide la préparation du brief uniquement — **ne fabrique pas** de `MarketingPlan`.
- Mode `execute` exige un port injectable ; **aucune implémentation IA en production** dans cet incrément.
- Pas de persistance Supabase ; bouton « Analyse marketing — prochainement » inchangé.

## [2.0.4] — 2026-08-02

### Added

- **VHS-112 (stub)** : parcours `/director` et `/director/new` derrière le feature flag serveur `DIRECTOR_V2_ENABLED` (désactivé par défaut).
- Domaine brief `studio/src/domain/brief` — `VideoProjectBrief` / brouillon distinct / `finalizeBrief`, schemas Zod, erreurs exploitables.
- Couche application `studio/src/application/director` — autosave local versionné (`virtual-humans:director:v2:brief-draft`), debounce, quarantine des brouillons corrompus.
- Config centralisée `studio/src/infrastructure/config/feature-flags.ts` ; exposition lecture seule via `GET /api/settings` → `features.directorV2` (pas de `NEXT_PUBLIC_*`, pas de toggle Settings).
- Lien nav « Réalisateur IA » uniquement si le flag est actif ; layout `/director` → `notFound()` si désactivé.
- Variable documentée dans `studio/.env.example` : `DIRECTOR_V2_ENABLED=0`.
- Tests flag / brief / draft ; suite `npm test` à 139 tests.

### Notes

- Autosave **local uniquement** (navigateur) ; aucune persistance Supabase ; aucun Directeur métier ; aucune production / provider ; studios historiques inchangés.
- Activation preview locale : `DIRECTOR_V2_ENABLED=1` (ou `true`) dans l’env serveur, redémarrer Next.

## [2.0.3] — 2026-08-02

### Added

- **VHS-004** : fondation domaine `studio/src/domain/project` — machines d’état projet/scène (transitions explicites + préconditions), `Revision<T>` immuables, pointeur `ActiveRevision`, verrouillage optimiste, `Approval` + `checkProductionReadiness`, schemas Zod, taxonomie d’erreurs.
- Tests associés (project-state, scene-state, revision, concurrency, approval, schemas) ; suite `npm test` à 121 tests.

### Notes

- Aucune persistance Supabase ; aucune page `/director` ; `vh_scenes` et storyboard historique inchangés.

## [2.0.2] — 2026-08-02

### Added

- **VHS-006 (partiel)** : fondation domaine `studio/src/domain/cost` — `Money` (`amountMinor`), `CostEstimate`, budget pur (`BudgetPolicy` / `BudgetSnapshot` / `BudgetDecision`), dry-run (`providerCalled: false`), erreurs de domaine, schemas Zod.
- Adapter legacy pur `fromLegacyUsdEstimate` / `toLegacyEstimateResponse` (prépare la migration depuis `pricing.ts` / `/api/estimate` sans bascule production).
- Tests domaine coût (money, estimate, budget, dry-run, legacy) ; suite `npm test` à 92 tests.

### Notes

- Aucune table `cost_ledger` ; `vh_spend` inchangé ; aucune route generate modifiée ; décision Q3 (coexistence ledger / `vh_spend`) toujours ouverte.

## [2.0.1] — 2026-08-02

### Added

- **VHS-003** : fondation domaine `studio/src/domain/shared` (`ArtifactMetadata`, unités `costCents` / `durationMs`).
- **VHS-005 (partiel)** : observabilité serveur `studio/src/infrastructure/observability` — correlation ID (`x-correlation-id`), redaction, logger JSON structuré, helper `startObservedRoute`.
- Intégration limitée sur `GET /api/settings`, `POST /api/estimate`, `POST /api/generate/image`.
- Tests unitaires associés (correlation, redact, logger, http) ; suite `npm test` à 61 tests.

### Changed

- Script `npm test` : glob `src/**/__tests__/**/*.test.ts`.
- Script `npm run typecheck` ajouté.

## [2.0.0] — 2026-08-02

### Added

- Developer Handover Pack complet de 25 documents.
- Contrats, règles, tests, données, déploiement et audit final.
- Objets métier versionnés et chaîne d'approbation.
- Budget guard, idempotence, reprise, observabilité et dry-run.

### Changed

- Architecture figée en pipeline découplé.
- `Production Director` remplace définitivement l'ancien concept `Quality Director` comme orchestration de production et de qualité.
- `AI Video Director` est défini comme expérience `/director`, non comme Directeur métier supplémentaire.
- Prompt Director produit des `ScenePackage`; Model Router produit un `GenerationPlan` ; Production Director l'exécute.

### Removed

- appels directs entre Directeurs ;
- choix utilisateur obligatoire d'un modèle/provider ;
- noms de personnages codés en dur ;
- retry non borné et appels payants sans estimation.

## Politique

Toute modification de contrat ou responsabilité est inscrite ici. Une rupture de pipeline exige une version majeure et une décision explicite d'architecture.
