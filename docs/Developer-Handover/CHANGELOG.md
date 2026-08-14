# Changelog

Format inspiré de Keep a Changelog ; versions selon SemVer documentaire.

## [2.0.143] — 2026-08-14

### Fixed (Phase 11A bitmap glyph rendering)

- Cause racine : `glyphRowsForCodepoint` générait un motif LCG, pas une police (`120_`).
- Atlas local `vhs-overlay-latin-bitmap-shapes-v1` · composeur `1.1.0` · golden `9dec964f…` · 0 OpenAI · 0 média Production.
- Verdict **`BITMAP_GLYPH_RENDERING_FIXED_READY_FOR_RECOMPOSITION_PREFLIGHT`**. Correction locale non déployée.

## [2.0.142] — 2026-08-14

### Added (Phase 11A composed-asset Human Review REJECT)

- Décision append-only `rejected` sur `6a2beca9…` (`119_`) · motif `human.corrupted_overlay_glyphs`.
- Parent `7832765d…` inchangé et réutilisable · ledger 274/249/0/25 · 0 OpenAI · 0 Storage write.
- Verdict **`PASS_PROVIDER_ASSET_COMPOSED_ASSET_HUMAN_REJECTED`**.

## [2.0.141] — 2026-08-14

### Added (Phase 11A existing-provider composition execution)

- Composition Production de `7832765d…` (`118_`) : 1 PNG composed · asset `6a2beca9…` · QC PASS · HR seedée sans décision.
- Replay idempotent · ledger inchangé 274/249/0/25 · 0 OpenAI · applicatif `60cc335`.
- Verdict **`COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING`**.

## [2.0.140] — 2026-08-14

### Added (Phase 11A existing-provider composition preflight)

- Preflight live `60cc335` (`117_`) : 1 lecture privée · filtres PNG **1–4** · compose mémoire PASS · 0 write.
- Asset `7832765d…` inchangé · run/job/ledger inchangés · flags refermés.
- Verdict **`READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION`**.

## [2.0.139] — 2026-08-14

### Added (Phase 11A PNG filter decoder hardening)

- `decodeRgbPng` : filtres PNG 0–4 (None/Sub/Up/Average/Paeth) + limites fail-closed (`116_`).
- Fixtures synthétiques · dry-run local · preflight compose **préparé non exécuté**.
- 0 provider · 0 lecture/écriture média Production · verdict **`READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT`**.

## [2.0.138] — 2026-08-14

### Added (Phase 11A text-free paid generation)

- 1 submit OpenAI Image no-text (`115_`) · asset provider `7832765d…` privé `pending_review`.
- Composeur local : **échec** `png: unsupported filter` · 0 asset composé · 0 retry.
- Ledger +1¢ provisional · budget 274/249/0/25 · flags refermés e4c3de3.
- Verdict **`COMPOSITOR_FAILED_NO_RETRY`**.

## [2.0.137] — 2026-08-14

### Added (Phase 11A text-free retry live preflight)

- Preflight live `e4c3de3` (`114_`) · HTTP dry-run executable · copy overlay absente · 0 OpenAI.
- Alias OFF refermé sur la même source · asset `5d68ef64…` inchangé · deltas 0.
- Verdict **`READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH`**.

## [2.0.136] — 2026-08-14

### Added (canonical living handover)

- `CURRENT_STATE_AND_RESUME.md` : état réel, prochaine porte, restart prompt.
- Script de fraîcheur `studio/scripts/check-current-state-freshness.mjs`.
- Règle : une phase n’est pas clôturée sans mise à jour du living handover.

## [2.0.135] — 2026-08-14

### Added (Phase 11A strip overlay copy from image variant)

- Prompt Director : `text_motion` dérive un sujet visuel ; `screenText` / CTA hors variant image (`113_`).
- Contrat `ImageVisualVariant` + détecteur de fuite overlay-leak-v1 (seuil 16, faux positifs génériques autorisés).
- Dry-run local no-provider · overlay FP inchangé `fdfae63fe1c7d003…` · 0 OpenAI · 0 write Production.
- Verdict **`READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`**.

## [2.0.134] — 2026-08-14

### Added (Phase 11A text-free retry live preflight)

- Preflight live `20e8783` (`112_`) · dry-run HTTP executable · **0** OpenAI · flags refermés.
- Overlay spec revue (`De l’idée à la structure` / `Découvrir Virtual Humans Studio`) · composeur synthétique PASS.
- Verdict **`BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT`** : screenText encore dans le variant image ; builder v2 fail-closed.

## [2.0.133] — 2026-08-14

### Added (Phase 11A deterministic typography hardening)

- Contrat `ImageTextOverlaySpec` + prompt OpenAI Image **no-text** v2 + composeur bitmap déterministe (`111_`).
- OCR gate fake / `unavailable_humanOnly` · assets parent/enfant · QC typographique · HR comparative.
- Runtime overlay **WIRED_DISABLED** · 0 OpenAI · 0 génération · REJECT historique inchangé.
- Verdict **`READY_FOR_TEXT_FREE_IMAGE_RETRY_PREFLIGHT`**.

## [2.0.132] — 2026-08-14

### Added (Phase 11A Human Review REJECT)

- Décision append-only `rejected` sur l’asset smoke `5d68ef64…` (`110_`) · 0 OpenAI · 0 retry.
- Scaffold delivery minimal `quality_report` + `production_result` · delivery `blocked`.
- Verdict **`PASS_TECHNICAL_ASSET_HUMAN_REJECTED`** · pipeline technique PASS · asset non actif · flags OFF.

## [2.0.131] — 2026-08-14

### Added (Phase 11A Image Ledger Reconciliation)

- Réservation smoke 1¢ soldée en commit **provisional** (`109_`) · reserved **0** · HR pending.
- Correctif pipeline : `needs_review` règle le ledger avant Human Review ; compteur worker corrigé.
- Verdict **`PASS_LEDGER_RECONCILED_HUMAN_REVIEW_PENDING`** · 0 second OpenAI · flags OFF.

## [2.0.130] — 2026-08-13

### Added (Phase 11A First Real OpenAI Image Smoke)

- Smoke payant once sur `7a67c77` (`108_`) · image privée PNG 1024 · HR needs_review.
- Verdict **`RECONCILIATION_REQUIRED`** · réservation 1¢ active non soldée · Auth provider **consommée**.
- Runtime OFF · 0 HR decision · pas de second appel.

## [2.0.129] — 2026-08-13

### Added (Phase 11A Final Live Preflight after Storage wiring)

- Live preflight no-provider sur `7a67c77` + FP `c532c400334f5b22` (`107_`) · `READY_FOR_11A_PAID_AUTH`.
- Plan matérialisé · sanitize base64 · Storage ingest wired · Δ compteurs = 0 · runtime OFF.

## [2.0.128] — 2026-08-13

### Added (Phase 11A Storage / Plan / Payload wiring)

- Canonical `POST /routing` single-step GenerationPlan (VHS-124) (`106_`).
- Private `director-final-assets` ingest + strip base64 from `production_runs.state`.
- Composition fingerprint `c532c400334f5b22` · `READY_FOR_NEW_11A_LIVE_PREFLIGHT` · 0 provider.

## [2.0.127] — 2026-08-13

### Added (Phase 11A Paid Smoke — blocked)

- Auth `11A-PAID-OPENAI-IMAGE-SMOKE-ONCE` → **`BLOCKED_PRECONDITION`** (`105_`).
- STOP avant provider : Ready `67187b8` ≠ `9952380` · ingest Storage / strip base64 / plan single-step non câblés.
- Provider **non consommé** · 0 OpenAI · flags non ouverts.

## [2.0.126] — 2026-08-13

### Added (Phase 11A Final Preflight on 9952380)

- Preflight final no-provider sur commit exact `9952380` (`104_`) · `READY_FOR_11A_PAID_AUTH`.
- Correctif `[DATA:…]` validé live · hostiles URL/Motion toujours rejetés · runtime OFF.

## [2.0.125] — 2026-08-13

### Added (Phase 11A OpenAI Image Live Preflight)

- Preflight live no-provider `READY_FOR_11A_PAID_AUTH` (`103_`) · source `be415f5`.
- Fenêtre VHS-124 + Director/Persistence/Paid · worker OFF · fermeture OFF · 0 OpenAI / 0 write métier.
- Prompt-gate : faux positifs `[DATA:…]` corrigés (commit docs — redéployer avant smoke payant).

## [2.0.124] — 2026-08-13

### Added (Phase 11A-WIRE OpenAI Image Allowlist)

- Exception VHS-124 bornée `VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION` (OFF par défaut) (`102_`).
- Chemin Production Director OpenAI `gpt-image-1` low 1024 — **WIRED_DISABLED** · 0 appel · 0 write.
- Plan single-step scene-2 · QC technique · Human Review gate · isolation Motion/legacy.

## [2.0.123] — 2026-08-13

### Added (Phase 11A-RESUME Media Pipeline Reassessment)

- Audit post-Motion : verdict `BLOCKED_MEDIA_PRODUCTION_WIRING` (`101_`).
- MV-002 **DEFERRED** · VHS-124 fakes-only confirmé · reco cible Option A (1¢) après Auth wiring.
- Guards isolation Motion · 0 provider · 0 budget write.

## [2.0.122] — 2026-08-13

### Added (MT-015A MV-002 Benchmark Design Prep)

- Design MV-002 *same motion, different character* (`100_`) · `MV002_DESIGN_READY`.
- Guards isolation Privacy/assets/idempotency · budget shortfall 135¢ (available 27) · 0 média/provider/write.

## [2.0.121] — 2026-08-13

### Added (MT-014 Motion Transfer Benchmark Evaluation)

- Évaluation post-MV-001 : verdict `PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY` (`99_`).
- Matrice capacités SUPPORTED/PARTIAL/UNVERIFIED/NOT_SUPPORTED · Registry design-only `enabled=false` / `paidExecution=false`.
- 0 fal · 0 activation Production · critical fidelity non hard-eligible · limited beta NO.

## [2.0.120] — 2026-08-12

### Fixed (MT-013P Motion Operational Hardening)

- `resumeInput` durable · stub `pollHydrateMotionInput` retiré · reclaim ≠ provider submit (`98_`).
- Anti faux `qc_rejected` sur hydrate incomplet · tests cold-start/multi-invocation.

## [2.0.119] — 2026-08-12

### Added (MT-013O MV-001 Human Review APPROVE)

- Décision Human Review `approved` 1× · `PASS_WITH_HUMAN_APPROVAL` (`97_`).
- Output lifecycle approved / `active=false` · historique `qc_rejected` conservé · capability NOT_YET_ENABLED.

## [2.0.118] — 2026-08-12

### Added (MT-013M/N MV-001 paid execution + review integrity)

- Paid single call submit=1 · ledger 162/135/27 (`95_`) · review integrity + private preview (`96_`).

## [2.0.117] — 2026-08-12

### Added (MT-013K-WIRE Production Motion Worker Orchestrator)

- Injecte `createMotionTransferWorkerOrchestrator` dans `createWorker` → factory → claimed-job-processor.
- Composition lazy fal (pas d’import FAL_KEY) · lifecycle admission/submit/poll · fake Production interdit.
- Flags OFF · 0 fal · 0 réservation · `MV001_REQUIRES_NEW_DEPLOY_PREFLIGHT=YES`. Rapport `90_`.

## [2.0.116] — 2026-08-12

### Added (MT-013J MV-001 Deploy Preflight No Provider)

- Auth `AUTH_MV001_DEPLOY_PREFLIGHT_NO_PROVIDER` sur `db1d64c` : fenêtre ON → dry-run `READY_FOR_PAID_AUTH` → finally OFF.
- `providerCalled=false` · worker OFF · runtime Motion UNAVAILABLE · 0 fal/réserve/run. Rapport `89_`.

## [2.0.115] — 2026-08-12

### Fixed (MT-013J-HOTFIX typecheck)

- Post-upload verify : `source_kind` inclus au select + rejet si ≠ `internal` (plus de bloc mort).
- Helper `mv001-post-upload-verify` + tests ciblés · build typecheck débloqué pour deploy auto.

## [2.0.114] — 2026-08-12

### Added (MT-013I MV-001 Private Media Upload)

- Auth `AUTH_CREATE_EXACTLY_ONE_MV001_VIDEO_PROJECT` : projet `390c25db-…5e84`.
- Auth `AUTH_MV001_UPLOAD_EXACTLY_TWO_PRIVATE_MEDIA` : 2 objets privés + 2 assets (source mp4 + identity png).
- Checksums inchangés · bucket privé · 0 URL persistée · ledger 59 · jobs/runs 0 · Motion UNAVAILABLE. Rapport `88_`.

## [2.0.113] — 2026-08-12

### Changed (MT-013H MV-001 8s Budget Hard Limit)

- Auth `AUTH_MV001_8S_RAISE_HARD_LIMIT_174_TO_274` : hard **174→274** (+100¢).
- committed 112 / reserved 0 / available **162** · audit ×1 · shortfall **0** · pas de réservation. Rapport `87_`.

## [2.0.112] — 2026-08-12

### Changed (MT-013G2 MV-001 8s Media Preparation)

- Auth `AUTH_MV001_PREPARE_LOCAL_8S_VIDEO_ONLY` : dérivé local 8s 1280×720 H.264 yuv420p @25fps, audio stripped.
- Profil MV-001 : durée **8s** · estimate **135¢** · reservation **162¢** · cap **200¢** · shortfall **100¢**.
- Budget inchangé 174/112/0/62 · MEDIA_VALIDATED local · 0 upload/fal. Rapport `86_`.

## [2.0.111] — 2026-08-12

### Added (MT-013G MV-001 Local Media Validate)

- Auth `AUTH_MV001_LOCAL_MEDIA_VALIDATE_ONLY` : probe piste `vide` + SHA-256 + manifeste redacted.
- Verdict **`MEDIA_INVALID`** : source 16.04s / 640×360 (fps 25 OK) ; identity PNG 971×1619 OK.
- 0 upload · 0 fal · 0 chemins absolus dans Git/docs. Rapport `85_`.

## [2.0.110] — 2026-08-11

### Added (MT-013F MV-001 Controlled Benchmark Prep)

- Profil benchmark-only MV-001 + exception Registry scopée/expirante (Production registry reste disabled).
- Gates, `Mv001MediaManifest`, validateur offline, upload/dry-run/execute/shutdown prep — **0** fal / upload / réserve.
- Verdict `READY_FOR_MEDIA_AND_DEPLOY_AUTH`. Rapport `84_`.

## [2.0.109] — 2026-08-11

### Changed (MT-013E MV-001 Budget Hard Limit)

- Auth `AUTH_MV001_RAISE_HARD_LIMIT_122_TO_174` : `hard_limit_minor` **122 → 174** (+52¢).
- committed 112 / reserved 0 / available **62** · audit `budget.hard_limit_raised` ×1 · pas de ledger/reservation. Rapport `83_`.

## [2.0.108] — 2026-08-11

### Changed (MT-005 Remote Apply — PASS)

- Auth `AUTH_MT005_REMOTE_APPLY_ONLY` : migration MT-005 appliquée Production (`ejdb…nmvi`) via MCP.
- Version distante `20260811211757` ; local renommé pour alignement 30/30. CHECK 5 décisions · RPC service_role · RLS on.
- Tests : migrations-static 14/14 · integration:db 33/33. Runtime Motion UNAVAILABLE. Rapport `82_`.

## [2.0.107] — 2026-08-11

### Added (MT-013D Privacy Decision Pack — ACCEPTED)

- Auth `AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED` : 5 clés gouvernance = **true** · portée MV-001 / fal / Kling MC · expire **2026-09-10**.
- `PRIVACY_DUE_DILIGENCE = ACCEPTED_LIMITED_MV001`. Aucun upload, fal call, spend, deploy, MT-005. Rapport `81_`.

## [2.0.106] — 2026-08-11

### Added (MT-013C Delete Target — VERIFIED)

- Delete Dashboard humain de `VHS Restore Drill 2026-08-09` (`qmsh…qlnq`) vérifié : cible **absente**.
- Production `ejdb…nmvi` **ACTIVE_HEALTHY** ; aucune autre ressource manquante. Rapport `80_`.

## [2.0.105] — 2026-08-11

### Added (MT-013C Delete Target — STOP)

- Auth delete `qmsh…qlnq` : préflight **PASS** (identité, ≠ Production, `78_` présent, isolation runtime).
- STOP : MCP sans `delete_project` ; `pause` non substitué. Cible encore présente. Rapport `79_`.

## [2.0.104] — 2026-08-11

### Added (MT-013C Restore Drill — PASS)

- Clone Dashboard humain : `VHS Restore Drill 2026-08-09` (`qmsh…qlnq`) · backup 09 Aug 2026 05:24:51 UTC · $10.18/mois · `eu-west-3`.
- Vérif redacted : migrations **29** identiques, 22 tables, RLS on, fonctions 52, counts data non vides (≤ Production).
- `RESTORE_DRILL = PASS` · P1 `BACKUP_PRESENT_RESTORE_UNPROVEN` **fermé**. Production inchangée · MT-005 non appliqué. Rapport `78_`.

## [2.0.103] — 2026-08-11

### Changed (MT-013C-DASHBOARD-QUOTE — devis capturé)

- Captures Dashboard : org JavaChrist · région `eu-west-3` · total **$10.18/mois** (compute $9.68 + disk $0.5, disk 1.5×).
- Backups COMPLETED visibles 04–09 Aug 2026 UTC ; bouton final **Continue** non cliqué.
- `77_` → `QUOTE_CAPTURED` · plafond prior 10 USD **insuffisant** · Auth clone proposée `…_MAX_10_18_USD`.

## [2.0.102] — 2026-08-11

### Added (MT-013C-DASHBOARD-QUOTE — préflight)

- Auth `AUTH_RESTORE_DASHBOARD_QUOTE_ONLY` : runbook humain jusqu’à l’écran de devis « Restore to a New Project ».
- STOP obligatoire avant Confirm ; 0 clone, 0 credentials, 0 mutation Production.
- Template de capture §5 dans `77_` · statut `AWAITING_HUMAN_CAPTURE`.

## [2.0.101] — 2026-08-11

### Added (MT-013C-RESTORE-PAID-TARGET — STOP)

- Auth `AUTH_RESTORE_DRILL_PAID_ISOLATED_PROJECT_MAX_10_USD` : coût projet vide **$10/mois** ≤ plafond, mais STOP.
- Motifs : `create_project` ≠ restore backup ; `restore_project` = unpause ; clone plateforme = Dashboard miroir (coût non prouvé ≤ 10) ; PAT absent.
- 0 création · 0 dépense · 0 mutation Production. Rapport `76_`. Auth Dashboard clone + plafond miroir requise.

## [2.0.100] — 2026-08-11

### Added (MT-013C Isolated Restore Target — STOP)

- Préflight Auth `AUTH_RESTORE_DRILL_ISOLATED_TARGET` : Production identifiée ; 0 branches.
- STOP : coût branche **$0.01344/h** et projet **$10/mois** ≠ 0 ; `create_branch` data-less ≠ restore backup.
- Aucune ressource créée · 0 mutation Production. Rapport `75_`. Auth dépense/PITR séparée requise.

## [2.0.99] — 2026-08-11

### Added (MT-013B Restore Drill & Privacy Due Diligence)

- Verdicts séparés : `RESTORE_DRILL = BLOCKED_TARGET_REQUIRED` · `PRIVACY_DUE_DILIGENCE = READY_FOR_HUMAN_DECISION`.
- Preuve MCP : Production 29 migrations, 0 branches isolées, 0 mutation ; due diligence 5 décisions (LIMIT_TO_MV001 / UNRESOLVED) sans flip `true`.
- Rapport `74_`. Pas d’apply MT-005 · pas de benchmark · `REAL_PROVIDER_CALLS = 0`.

## [2.0.98] — 2026-08-11

### Added (MT-013A MV-001 Benchmark Governance & Readiness)

- Audit gates A–J + Privacy Decision Pack (5 décisions PENDING) + plan restore drill isolé (non exécuté).
- Définition MV-001 (3 s, fal Kling v3 Pro MC, estimate 51¢ / réserve 62¢) ; shortfall budget documenté.
- Audit fal re-vérifié (retention/CDN/pricing) sans API payante ; MT-005 auditée ; Registry reste UNVERIFIED.
- Rapport `73_`. Verdict `READY_FOR_HUMAN_GOVERNANCE_DECISIONS`. `MV001_NOT_EXECUTED` · `REAL_PROVIDER_CALLS = 0`.

## [2.0.97] — 2026-08-11

### Added (MT-012 Motion Transfer Full Dry-Run & Synthetic E2E)

- Harness E2E canonique `runMotionTransferE2E` (compose Registry→Router→Engine→Worker→QC→Review, stores mémoire).
- Dry-run public `runMotionTransferPublicDryRun` (Production = unavailable ; synthétique redacted).
- Fixture opaque MV-001-like + suite scénarios A–L (31 tests) ; invariants quantifiés ; `REAL_PROVIDER_CALLS = 0`.
- Rapport `72_`. Gate MT-012 **PASS**. Runtime Production toujours unavailable · privacy NOT AUTHORIZED · remote migration NOT APPLIED · **PAS** Production-ready.

## [2.0.96] — 2026-08-11

### Added (MT-011 Motion Transfer Observability & Security)

- Catalogue événements `mt011-events-1.0.0` + façade `emitMotionObservabilityEvent` (sanitize/assert/freeze).
- Sanitizer central Motion + classification données + contrat privacy `mt011-privacy-1.0.0` + gates fail-closed consolidées.
- Compat privacy gate MT-007B ; asserts worker/QC/review délégués au sanitizer. Tests hostiles **29**. Rapport `71_`. Gate MT-9 **PASS**.
- `REAL_PROVIDER_CALLS = 0` · runtime unavailable · remote migration NOT APPLIED · privacy decisions NOT YET AUTHORIZED.

## [2.0.95] — 2026-08-11

### Added (MT-010 Motion Transfer Human Review)

- API `GET/POST …/motion/review` + extension `/quality/review` (5 décisions SQL) + helper `allowedHumanReviewDecisions`.
- UI Director `MotionReviewSection` (attestation, justification, confirm modale) ; retry = intent only (**0** job/ledger/provider).
- Orchestrateur append-only + idempotence `reviewRequestId` ; harness fail-closed Production. Tests ciblés **25**. Rapport `70_`. Gate MT-8 **PASS**. Migration MT-005 **LOCAL_ONLY** inchangée.

## [2.0.94] — 2026-08-11

### Added (MT-009 Motion Quality Control)

- Couches QC Motion (technical → fidelity → checkpoints opaques → human review) + policy versionnée + port de mesure provider-agnostic.
- Fake measurement port TEST_ONLY (garde Production/Vercel) ; agrégation déterministe ; evidence `motion_qc_evidence` ; mapping `quality_report`.
- Handoff worker `qc_pending` → `qc_passed` / `needs_review` / `rejected` / `retry_recommended` (tests only) ; **0** adapter CV réel ; **0** appel fal.
- Tests ciblés **35**. Rapport `69_MT009_MOTION_QUALITY_CONTROL.md`. Gate MT-7 Motion QC **PASS**.

## [2.0.93] — 2026-08-11

### Added (MT-008 Motion Transfer Worker / Polling)

- Branche `motion_transfer` sur worker canonique `run-once` (max 1 job/invocation) + orchestrateur submit/poll/ledger/QC-pending.
- Exactly-once honnête : `submission_unknown` sans resubmit auto ; cancel unsupported ; late result quarantiné.
- Gates fail-closed + harness local ; **0** appel fal ; migration = no. Tests ciblés **17**. Rapport `68_`. Gate MT-6 **PASS**.

## [2.0.92] — 2026-08-11

### Added (MT-007B fal Kling Motion Control Adapter — Disabled)

- Adapter `MotionTransferProviderPort` pour `fal-ai/kling-video/v3/pro/motion-control` + transport injectable + fake transport.
- Factory SDK réelle présente mais **unresolvable** tant que flags OFF + privacy gate blocked ; **0** appel fal / **0** lecture `FAL_KEY` en tests.
- Flags `MOTION_TRANSFER_*` (strict `1|true`) ; privacy gate fail-closed ; Registry profile UNVERIFIED/`enabled=false`.
- Contract suite PASS ; cancel `cancel_unsupported` ; pricing firm $0.168/s (integer). Rapport `67_MT007B_FAL_KLING_MOTION_CONTROL_ADAPTER.md`. Gate MT-5 **PASS**.

## [2.0.91] — 2026-08-11

### Added (MT-007A Motion Transfer Provider Capability Spike)

- Spike documentaire officiel fal Kling motion-control (v3/v2.6) + comparaison Runway Act-Two ; **0** appel provider.
- Décision : `PROVIDER_SELECTED_FOR_ADAPTER_IMPLEMENTATION` → `fal-ai/kling-video/v3/pro/motion-control` (disabled adapter only).
- Mapping statique + anti-I2V + profil Registry design `enabled=false` ; tests **8** ciblés. Rapport `66_MT007A_MOTION_TRANSFER_PROVIDER_SPIKE.md`.

## [2.0.90] — 2026-08-11

### Added (MT-006 Motion Transfer Provider Port & Fake Adapter)

- Port domaine `MotionTransferProviderPort` (`estimate`/`submit`/`poll`/`cancel?`) + context sans credentials.
- Fake synthétique TEST_ONLY (garde Vercel/Production) ; suite contractuelle obligatoire pour MT-007.
- Codes provider étendus ; mapping statuts `running→processing` / `succeeded→completed` / `timed_out` ; descriptors de sortie sans URL signée.
- Tests ciblés **16** (+ contract suite) ; unitaires **1245** ; Engine/Router/Registry motion inchangés verts. Rapport `65_MT006_MOTION_TRANSFER_PROVIDER_PORT.md`. Gate MT-4 Provider Port **PASS**. MT-007 **NOT STARTED**. Real adapters = **0**.

## [2.0.89] — 2026-08-11

### Added (MT-005 Motion Transfer Supabase & Storage)

- Contrats persistence/storage Motion : réutilise tables V2 (`production_*`, `assets`, `generation_plan`, `quality_report`, ledger/idempotency/audit) — **aucune** table `motion_*`.
- Bucket privé réutilisé `director-final-assets` ; path builder `{ws}/{proj}/motion/{role}/{assetId}.{ext}`.
- Migration locale additive `20260811180000_vhs_mt005_human_review_decision_extend.sql` : CHECK/RPC `decision` + intents retry Motion — **NOT APPLIED** Production.
- Port mémoire + tests hostiles (MIME, isolation, redaction signed URL). Tests ciblés **10** ; unitaires **1229** ; pgTAP **386** ; DB integration **33**. Rapport `64_MT005_MOTION_TRANSFER_SUPABASE_STORAGE.md`. Gate MT-3 Persistence/Storage **PASS**. MT-006 **NOT STARTED**. Migration history : LOCAL_ONLY drift=1 (attendu).

## [2.0.88] — 2026-08-11

### Added (MT-004 Motion Transfer Generation Engine dry-run)

- Action `motion_transfer` + `runMotionTransferGenerationDryRun` : validate → resolve media → route MT-003 → plan → dry-run (`providerCalled=false`).
- Fake media resolver strict ; fingerprints stables ; Production → `motion_capability_unavailable` / non-executable.
- Tests **19** ciblés ; unitaires **1218** ; rapport `63_MT004_MOTION_TRANSFER_GENERATION_ENGINE.md`. Gate MT-3 **PASS**. MT-005 **NOT STARTED**.

## [2.0.87] — 2026-08-11

### Added (MT-003 Motion Transfer Router strategy)

- Stratégie `motion_transfer` (library VHS-108) + `routeMotionTransfer` pur : hard constraints MT-002, scoring, allowlist, budget compare-only, `maximumFallbacksPerStep=0`.
- Échec Production : `motion_capability_unavailable` ; **0** candidat ; **0** fallback I2V/T2V.
- Tests **20** ciblés ; unitaires **1199** ; rapport `62_MT003_MOTION_TRANSFER_ROUTER.md`. Gate MT-2 Router **PASS**. MT-004 **NOT STARTED**.

## [2.0.86] — 2026-08-11

### Added (MT-002 Motion Transfer Capability Registry)

- Extension Registry VHS-107 : profil `video.motion_transfer`, `MediaInputType` `source_video`, bloc versionné `MotionTransferModelCapabilities` (`SupportLevel`, fidélité, contrôles, limites, `estimateStrategy`).
- Helpers purs : `supportsMotionTransfer`, `satisfiesMotionTransferHardConstraints`, `explainMotionTransferIneligibility`.
- Tests **30** ciblés SYNTHETIC ; unitaires **1179** ; **0** entrée Production enabled ; runtime unavailable.
- Rapport : `61_MT002_MOTION_TRANSFER_CAPABILITY_REGISTRY.md`. Gate MT-2 Registry **PASS**. MT-003 **NOT STARTED**.

## [2.0.85] — 2026-08-11

### Added (MT-001 Motion Transfer domain contracts)

- Module `studio/src/domain/motion/` : capability `video.motion_transfer`, MediaReference (AssetInputRef), Input/Spec/QC/Result, Zod, invariants, fingerprint, redaction.
- Tests **27** ciblés ; unitaires **1149** ; Gate MT-1 **PASS**. Rapport : `60_MT001_MOTION_TRANSFER_DOMAIN_CONTRACTS.md`.
- **0** adapter/router/engine/API/migration/provider/push. Runtime capability toujours unavailable.

## [2.0.84] — 2026-08-11

### Architecture (Motion / Performance Transfer)

- Spec complète `59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md` : `video.motion_transfer`.
- Statut : `ARCHITECTURE_READY_FOR_IMPLEMENTATION` · `IMPLEMENTATION_NEXT` · `RUNTIME_NOT_IMPLEMENTED_YET` · `PROVIDER_NOT_SELECTED_YET` · `NO PAID BENCHMARK_YET`.
- Contrats domaine, Registry/Router, Engine, port provider, QC, human review, tickets MT-001…014, gates MT-0…11.
- Canon 00/02/04/06/13–15/17–19 + BACKLOG + GLOSSARY mis à jour. **0** code · **0** migration · **0** provider · **0** push.

## [2.0.83] — 2026-08-11

### Documentation (Developer-Handover refresh)

- Réécrit `17_SUPABASE_PROJECTS.md` sur le schéma réel (29 migrations, tables/RPCs, RLS service_role, rétention).
- `00_README.md` : index 00–58, autorité docs, checkpoint ops, portes Directors.
- Bandeaux CURRENT / HISTORICAL / FUTURE sur 01–20 ; Ops sur 07–16 ; baselines 18/CHECKLIST ; plan Supabase + audit.
- **0** code applicatif · **0** provider · **0** push. Totaux documentés : mig. 29 / pgTAP 378 / intégration 33 / unitaires 1122.

## [2.0.82] — 2026-08-11

### Prepared (Phase 11A MEDIA PREP)

- Audit chaîne post-Storyboard ; dry-run local Prompt+Router sans provider ; comparaison 4 options smoke.
- Reco : 1 image OpenAI `gpt-image-1` 1024 low (~1¢ / réserve 2¢) sur scene-2 `text_motion` ; budget 122/112/10 inchangé.
- Verdict `DECISION_REQUIRED` (VHS-124) ; guards + script prep ; **0** provider. Rapport : `58_PHASE_11A_FIRST_REAL_MEDIA_SMOKE_PREP.md`.

## [2.0.81] — 2026-08-11

### Validation provider (Phase 10F-V4-EXECUTE)

- 1 appel Storyboard `gpt-5.6` / `storyboard-analyzer-v4` : run `8ca5dfce` `completed`, artifact `storyboard_project` rev.1.
- Continuité mandatory 24/9/5 fp `9d34b42ddc3bb85c` ; ledger 13¢ reserve / 5¢ commit / 8¢ release ; available **15→10** ; replay `existing`.
- Fermeture OFF `3h1fdwxr8` ; runtime OFF. Rapport : `57_PHASE_10F_STORYBOARD_V4_EXECUTE.md` (`PASS`).

## [2.0.80] — 2026-08-11

### Deployed (Phase 10F-V4-DEPLOY-PREFLIGHT)

- Salt `10f-storyboard-v4-20260811` (salt fp `05be5ef9a08d005f`, clé `801c34a1080bbcf0`) ; deploy runtime `90fb6fb` (`osaz404ey` → OFF `eeczhjco7`).
- Dry-run live PASS : prompt v4, 24/9/5, tokensFp `9d34b42ddc3bb85c`, estimate 13¢, oneOf=0 ; **0** provider / réservation / run / artifact.
- Rapport : `56_PHASE_10F_V4_DEPLOY_PREFLIGHT.md` (`READY_FOR_PROVIDER_REAUTH`).

## [2.0.79] — 2026-08-11

### Budget + Push (Phase 10F-V4-BUDGET-AND-PUSH)

- Hard limit workspace **115→122¢** (+7) + audit `phase_10f_storyboard_v4_budget_authorization` ; available **15¢**.
- Push `main` `a82b9cf..90fb6fb` (5 commits) ; **0** provider / réservation / deploy manuel.
- Rapport : `55_PHASE_10F_V4_BUDGET_AND_PUSH.md` (`PASS`). Commit docs local `ad168f6` (non poussé).

## [2.0.78] — 2026-08-11

### Prepared (Phase 10F-V4-RETRY-PREP)

- Finalise le contrat continuité Storyboard : `MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` (tokens projetés obligatoires même si rule lighting = preferred).
- Salt `10f-storyboard-v4-20260811` (empreinte `801c34a1080bbcf0`) ≠ 4 runs failed ; matrice Prod 24/9/5 fp `9d34b42ddc3bb85c` ; estimate **13¢** ; shortfall **5¢** (Auth Budget D → 122).
- Rapport : `54_PHASE_10F_STORYBOARD_V4_RETRY_PREP.md` (`READY_FOR_BUDGET_AND_PUSH_AUTH`). **0** provider / budget write / push.

## [2.0.77] — 2026-08-11

### Fixed (Phase 10F-ALL-CONTINUITY-DIAG)

- Cause `invalid_candidate` v3 : map limitée aux clés `location` alors que le validateur exige tous les tokens projetés (ex. `lighting:studio|cool`, pipe opaque).
- Prompt **`storyboard-analyzer-v4`** + `REQUIRED_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` ; inventaire/fingerprint dry-run ; validateur métier inchangé.
- Tests inventaire / scopes / opaque / required-advisory ; **0** provider. Rapport : `53_PHASE_10F_STORYBOARD_ALL_CONTINUITY_DIAG.md` (`READY_FOR_V4_PREP`). Aucun push.

## [2.0.76] — 2026-08-10

### Validation provider (Phase 10F-V3-EXECUTE) — BLOCKED

- 1 appel Storyboard `gpt-5.6` / `storyboard-analyzer-v3` : run `60a1d9c6` `failed`/`invalid_candidate` (continuité `lighting:studio|cool`).
- Ledger 13¢ reserve / 6¢ commit / 7¢ release ; available **14→8** ; **0** storyboard ; salt `10f-storyboard-v3-20260810` brûlé.
- Fermeture OFF `eq0cql3di` ; runtime OFF. Rapport : `52_PHASE_10F_STORYBOARD_V3_EXECUTE.md`. Aucun push.

## [2.0.75] — 2026-08-10

### Deployed (Phase 10F-V3-DEPLOY-PREFLIGHT)

- Salt Production `10f-storyboard-v3-20260810` ; deploy source `a82b9cf` ; dry-run live gates v3 verts (prompt v3, location 5/complete, oneOf=0, clé `1bf9daeb68eb6432`).
- Fermeture flags + redeploy OFF `iqw0b8di0` ; runtime OFF ; **0** provider / run / ledger. Rapport : `51_PHASE_10F_V3_DEPLOY_PREFLIGHT.md` (`READY_FOR_PROVIDER_REAUTH`). Aucun push.

## [2.0.74] — 2026-08-10

### Budget + Push (Phase 10F-V3-BUDGET-AND-PUSH)

- Hard limit workspace **113→115¢** (+2) + audit `phase_10f_storyboard_v3_budget_authorization` ; available **14¢**.
- Push `main` `a849e03..a82b9cf` (4 commits) ; **0** provider / réservation / deploy manuel.
- Rapport : `50_PHASE_10F_V3_BUDGET_AND_PUSH.md` (`PASS`).

## [2.0.73] — 2026-08-10

### Prepared (Phase 10F-V3-RETRY-PREP)

- Préparation Storyboard v3 **sans** provider : map 5× `location:espace-numerique-principal`, oneOf=0 / anyOf-compatible, dry-run expose `requiredLocationKeyCount` / `Coverage`.
- Salt `10f-storyboard-v3-20260810` (empreinte `1bf9daeb68eb6432`) ≠ 3 runs failed ; estimate **13¢** ; shortfall **1¢** (Auth Budget C proposée 114/115).
- Rapport : `49_PHASE_10F_STORYBOARD_V3_RETRY_PREP.md` (`READY_FOR_BUDGET_AND_PUSH_AUTH`). **0** provider / budget write / push.

## [2.0.72] — 2026-08-10

### Fixed (Phase 10F-CONTINUITY-DIAG)

- Cause `invalid_candidate` : prompt Storyboard v2 ne forçait pas `location:<continuityKey>` exact depuis VisualDirection.
- Prompt **`storyboard-analyzer-v3`** + map `REQUIRED_LOCATION_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` ; validateur métier inchangé.
- Tests continuity FAIL/PASS ; **0** provider. Rapport : `48_PHASE_10F_STORYBOARD_CONTINUITY_DIAG.md` (`READY_FOR_RETRY_PREP`). Aucun push.

## [2.0.71] — 2026-08-10

### Validation provider (Phase 10F-RETRY2-EXECUTE) — BLOCKED

- 1 appel Storyboard `gpt-5.6` : run `4914c203` `failed`/`invalid_candidate` (continuité `location:espace-numerique-principal`).
- Ledger 13¢ reserve / 8¢ commit / 5¢ release ; available **20→12** ; **0** storyboard ; salt `10f-auth-b-retry2-20260810` brûlé.
- Fermeture OFF `gb5fi4973` ; runtime OFF. Rapport : `47_PHASE_10F_STORYBOARD_RETRY2_EXECUTE.md`. Aucun push.

## [2.0.70] — 2026-08-10

### Deployed (Phase 10F-RETRY2-DEPLOY-PREFLIGHT)

- Salt Production `10f-auth-b-retry2-20260810` ; deploy source `a849e03` ; dry-run live gates verts (oneOf=0, anyOf-compatible, metadata ready, clé `0b7e8fb44e0acd4d`).
- Fermeture flags + redeploy OFF `oa57qfz26` ; runtime OFF ; **0** provider / run / ledger. Rapport : `46_PHASE_10F_RETRY2_DEPLOY_PREFLIGHT.md` (`READY_FOR_PROVIDER_REAUTH`). Aucun push doc.

## [2.0.69] — 2026-08-10

### Prepared (Phase 10F-RETRY2-PREP)

- Préparation Storyboard post-fix structured output **sans** provider : projection `oneOf=0` / `anyOf-compatible`, parité Zod locale, obs provider redacted (HTTP/code/request-id/stage/attempts/usage).
- Dry-run expose `structuredSchemaOneOfCount`, `structuredSchemaProjection`, `providerErrorMetadataCapture=ready` ; blocage executable si projection invalide.
- Salt proposé `10f-auth-b-retry2-20260810` (empreinte `0b7e8fb44e0acd4d`) distinct des runs `b446a0ed` / `f5b75018`.
- Rapport : `45_PHASE_10F_STORYBOARD_RETRY2_PREP.md` (`READY_FOR_PUSH_AND_REAUTH`). **0** provider / ledger / push.

## [2.0.68] — 2026-08-10

### Fixed (Phase 10F-PROVIDER-DIAG)

- Cause `request_failed` Storyboard : JSON Schema `oneOf` (Zod `discriminatedUnion` sur `spokenContent`) interdit en OpenAI strict.
- `toOpenAIStrictJsonSchema` convertit `oneOf` → `anyOf` ; mapping HTTP 400 schéma/invalid_request clarifié ; logs failed redacted enrichis.
- Tests fake transport + schema-parity ; **0** provider. Rapport : `44_PHASE_10F_STORYBOARD_PROVIDER_DIAG.md` (`READY_FOR_RETRY_PREP`). Aucun push.

## [2.0.67] — 2026-08-10

### Validation provider (Phase 10F-AUTH-B RESUME) — BLOCKED

- Runtime salt-ready : lignée `d2mth5hp7` → `im5dy49ry` ; Root Directory `studio` ; dry-run `idempotencySaltPresent=true` ; empreinte clé `3f39…`.
- Execute unique : run `f5b75018` `failed`/`request_failed` ; ledger 13 reserve / 13 release / 0 commit ; **1** appel provider ; **0** storyboard.
- Run `b446a0ed` immuable ; flags OFF + redeploy `ox4qwh5wf` ; runtime OFF prouvé.
- Rapport : `43_PHASE_10F_STORYBOARD_AUTH_B_RESUME.md`. Autorisation provider consommée. Aucun push.

## [2.0.66] — 2026-08-10

### Validation provider (Phase 10F-AUTH-B) — BLOCKED

- Préconditions + dry-run live OK (13¢ / `gpt-5.6` / `medium` / `4096` / `storyboard-analyzer-v2`).
- Execute unique → HTTP 500 `internal_error` : redeploy d’ouverture sur déploiement **stale** (sans salt) → clé = run `budget_exceeded` → `director_run_terminal_reuse`.
- **0** appel OpenAI ; **0** run/ledger/réservation Auth B ; `storyboard_project` absent ; run `b446a0ed` immuable.
- Salt Production `10f-auth-b-20260810` posé ; fermeture flags + redeploy OFF ; Production alias sur HEAD salt-ready OFF.
- Rapport : `42_PHASE_10F_STORYBOARD_AUTH_B.md`. Checkpoint local — **aucun push**.

## [2.0.65] — 2026-08-10

### Changed (Phase 10F-BUDGET-AUTH-A)

- `workspace_budget_policies.hard_limit_minor` : **100¢ → 113¢** (+13¢) sur le workspace du projet `984507af-…`.
- `audit_log` : 1 entrée redacted (`corr-10f-budget-auth-a-…`, motif `phase_10f_storyboard_budget_authorization`).
- Exposure commits **93¢** inchangée ; disponible **7 → 20** ; **0** réservation / ledger / provider / Storyboard / flags.
- Rapport : `41_PHASE_10F_BUDGET_AUTH_A.md` (`PASS`). `verify-budget-ready` vert (non payant). Aucun push.

## [2.0.64] — 2026-08-10

### Added (Phase 10F-BUDGET-AUDIT)

- Audit non payant : exposure commits **93¢**, hard limit **100¢**, disponible **7¢** ; formule `reserve_director_budget` documentée (releases ≠ free exposure).
- Aucune réservation orpheline ; tentative 10F **non facturée** ; run `b446a0ed` terminal immuable.
- Préparation Auth A (raise → **113¢**) + Auth B (gate smoke + salt idempotence sans bump prompt).
- Rapport : `40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md` (`READY_FOR_BUDGET_AUTH`). **0** write budget/ledger. Aucun push.

## [2.0.63] — 2026-08-10

### Validation provider réelle (Phase 10F) — BLOCKED

- Smoke Storyboard texte : dry-run live exact (`gpt-5.6` / `medium` / `4096` / 13¢ / `storyboard-analyzer-v2`).
- Réservation refusée : hard limit workspace **100¢**, commits **93¢**, reste **7¢** < 13¢ → HTTP 402 `budget_exceeded`.
- **0** appel OpenAI ; **0** `storyboard_project` ; **0** ledger 10F ; run failed `b446a0ed-…` immuable.
- Flags refermés OFF + redeploy ; `CURRENT_RUNTIME_REAL_AI=OFF` prouvé.
- Rapport : `39_PHASE_10F_FIRST_REAL_STORYBOARD_TEXT_SMOKE.md` (BLOCKED). Checkpoint local — **aucun push**.

## [2.0.62] — 2026-08-10

### Added (Phase 10F-PREP)

- Préparation smoke Storyboard texte sans appel provider ni média : scripts verify / dry-run / flags / smoke dry-only / replay.
- Réutilisation MarketingPlan + CreativeConcept + VideoScript + VisualDirection ; Marketing/Creative/Script/Art/worker/média exclus.
- Prompt Storyboard `storyboard-analyzer-v1` → **`storyboard-analyzer-v2`** (segments / spoken / continuity / assets) ; validateurs métier inchangés.
- Dry-run Storyboard : estimate **13¢**, réservation prévue **13¢**, plafond proposé **100¢** ; knobs Production pattern `gpt-5.6`/`medium`/`4096` (à confirmer live).
- Dry-run Storyboard expose `provider` / `reasoningEffort` / `maxOutputTokens` / `idempotencyKeyVersion`. Rapport : `38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md`. Aucune exécution 10F, aucun push.

## [2.0.61] — 2026-08-10

### Validation provider réelle (Phase 10E-V3) — PASS

- Nouvel execute Art texte sous **`art-analyzer-v3`** : **1** appel OpenAI `gpt-5.6`, VisualDirection rev.1 persistée (5 segments).
- Budget : **13¢** estimés/réservés, **12¢** commités, **1¢** libérés ; run v2 failed + ledger v2 immuables.
- Replay idempotent `existing` ; **0** `/art/retry` / Storyboard / média / worker ; runtime OFF prouvé.
- Rapport : `37_PHASE_10E_ART_V3_NEW_EXECUTE.md` (PASS). Checkpoint local — **aucun push**.

## [2.0.60] — 2026-08-10

### Added (Phase 10E-RETRY-PREP)

- Préparation nouvel execute Art texte sous **`art-analyzer-v3`** (pas `/art/retry`) : dry-run expose `provider` / `idempotencyKeyVersion` / `previousFailedRunIgnoredForNewContract`.
- Scripts smoke/replay/prep v3 + guards confirmation `ONE_NEW_ART_V3_CALL_MAX_*` ; clé v3 ≠ v2 prouvée ; estimate local **13¢**.
- Rapport : `36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md` (`READY_FOR_HUMAN_AUTH`). **0** provider. Aucun push.

## [2.0.59] — 2026-08-10

### Fixed (Phase 10E-DIAG)

- Diagnostic `invalid_candidate` / continuité lieu : Zod OK, rejet métier `validateContinuityAgainstSegments` ; candidat brut non persisté ; **0** provider.
- Prompt Art `art-analyzer-v2` → **`art-analyzer-v3`** (contrat `continuityKey` / required stable) ; validateur inchangé (fail-closed).
- Tests de reproduction Zod vs métier + non-régression. Rapport : `35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md` (`READY_FOR_RETRY_PREP`). Aucun push.

## [2.0.58] — 2026-08-10

### Validation provider réelle (Phase 10E) — BLOCKED

- Smoke Art texte réel : **1** appel OpenAI `gpt-5.6` après dry-run live exact (13¢ / `medium` / 4096).
- Candidat rejeté domaine : `invalid_candidate` (« Continuité lieu ») — **0** `visual_direction` actif ; HTTP 422.
- Ledger réconcilié : **13¢** réservés / **12¢** commités / **1¢** libérés ; **0** retry / **0** Storyboard / **0** média / **0** worker.
- Flags refermés OFF + redeploy ; `CURRENT_RUNTIME_REAL_AI=OFF` prouvé.
- Rapport : `34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md` (BLOCKED). Checkpoint local — **aucun push**.

## [2.0.57] — 2026-08-10

### Added (Phase 10E-PREP)

- Préparation smoke Art texte sans appel provider ni média : scripts verify / dry-run / flags / smoke dry-only / replay.
- Réutilisation MarketingPlan + CreativeConcept + VideoScript ; Marketing/Creative/Script/Storyboard/worker/média exclus.
- Dry-run Art : estimate **13¢**, réservation prévue **13¢**, plafond proposé **100¢** ; knobs Production pattern `gpt-5.6`/`medium`/`4096` (à confirmer live).
- Dry-run Art expose `reasoningEffort` + `maxOutputTokens`. Rapport : `33_PHASE_10E_ART_TEXT_SMOKE_PREP.md`. Aucune exécution 10E, aucun push.

## [2.0.56] — 2026-08-10

### Validation provider réelle (Phase 10D REAUTH)

- Premier smoke Script texte réel : **1** appel OpenAI `gpt-5.6`, `VideoScript` Zod valide, persisté avec provenance.
- Budget : **12¢** estimés/réservés, **3¢** commités, **9¢** libérés ; ledger réconcilié.
- Replay idempotent : `status=existing`, **0** second appel provider.
- MarketingPlan 10B + CreativeConcept 10C réutilisés sans rejoue ; **0** média / **0** worker ; flags refermés OFF.
- Rapport : `31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md` (PASS). Checkpoint local — **aucun push**.

## [2.0.55] — 2026-08-10

### Fixed (Phase 10D-RECONCILE)

- Cause racine du BLOCKED 10D : PREP Script tombait sur défauts code (`gpt-5.6-terra` / 2400 → 7¢) faute de fallback Production documenté.
- Canon aligné sur Production live : `gpt-5.6` / `medium` / `4096` → estimate/réservation **12¢** ; **0** écriture Vercel.
- Dry-run Script expose `reasoningEffort` + `maxOutputTokens` ; guards et PREP mis à jour.
- Rapport : `32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md` (`READY_FOR_REAUTH`). Aucun push.

## [2.0.54] — 2026-08-10

### Validation provider réelle (Phase 10D) — BLOCKED

- Tentative smoke Script texte réel après autorisation humaine : flags ouverts puis redeploy ON.
- Dry-run Production divergent du PREP : estimate **12¢** / modèle `gpt-5.6` vs **7¢** / `gpt-5.6-terra` attendus.
- **0** appel provider Script ; **0** VideoScript ; Marketing/Creative non rejoués.
- Fermeture immédiate flags OFF + redeploy ; `CURRENT_RUNTIME_REAL_AI=OFF` prouvé.
- Rapport : `31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md`. Checkpoint local — **aucun push**.

## [2.0.53] — 2026-08-10

### Added (Phase 10D-PREP)

- Préparation smoke Script sans appel provider : scripts verify / dry-run / flags / smoke dry-only / replay.
- Réutilisation MarketingPlan 10B + CreativeConcept 10C ; Marketing/Creative/Art/Storyboard/worker/média exclus.
- Dry-run Script : estimate **7¢**, réservation prévue **7¢**, plafond proposé **100¢** ; preuves sous `studio/.tmp/`.
- Rapport : `30_PHASE_10D_SCRIPT_SMOKE_PREP.md`. Aucune exécution 10D, aucun push.

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
