# Virtual Humans Studio — Developer Handover Pack V2

**Version :** 2.0
**Architecture :** V2 Frozen
**Date :** août 2026
**Rafraîchi :** 14 août 2026

## Qui fait autorité ?

| Besoin | Document |
|---|---|
| **État vivant + reprise de chat** | **[`CURRENT_STATE_AND_RESUME.md`](./CURRENT_STATE_AND_RESUME.md)** |
| État opérationnel courant (portes, budget, flags, prochaine phase) | living handover → **`BACKLOG_V2.md`** → derniers rapports numérotés |
| Contrats d’architecture immuables | `02_ARCHITECTURE.md` + ce README |
| Schéma Supabase réel | **`17_SUPABASE_PROJECTS.md`** (pas les snapshots Phase 9) |
| Contrats métier Directors | `07`–`15` (section Ops = état prouvé) |
| Snapshot Phase 9 local fakes | `20_FINAL_AUDIT.md` (**historique**) |
| Historique d’incidents / smokes | rapports `21`–`58` (**ne pas réécrire**) |

En cas de contradiction factuelle d’état : **code + état réel vérifié** > [`CURRENT_STATE_AND_RESUME.md`](./CURRENT_STATE_AND_RESUME.md) > BACKLOG + rapport le plus récent > snapshot historique.
En cas de contradiction d’architecture : ce README → `02_ARCHITECTURE` → document du composant.

Une phase qui change l’état du projet **n’est pas clôturée** sans mise à jour du living handover.

---

## État courant (checkpoint)

```text
Dernier checkpoint texte : Phase 10F-V4-EXECUTE PASS (rapport 57)
Motion / Performance     : MV-001 PASS_WITH_HUMAN_APPROVAL · Registry DISABLED
                           MV-002 DESIGN_READY + DEFERRED (`100_`)
Phase 11A média          : smoke image réel (`108_`) · ledger 1¢ soldé (`109_`)
                           HR REJECT (`110_`) · overlay WIRED_DISABLED (`111_`)
                           preflight retry text-free (`112_`) · **BLOCKED_TEXT_LEAK** (historique)
                           strip overlay copy (`113_`) · preflight live (`114_`)
                           paid text-free (`115_`) · **COMPOSITOR_FAILED_NO_RETRY**
                           PNG decoder 0–4 (`116_`) · **READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT**
Runtime AI / paid media  : OFF · runtime Production **e4c3de3** (nouveau SHA Git ≠ runtime tant que non promu)
Budget                   : hard 274 / committed 249 / reserved 0 / available 25 ¢
production_jobs média    : 2 jobs image completed · 1 REJECT · 1 pending_review · 0 composed
P0                       : pas de 3e OpenAI · ne pas activer les 2 assets · ne pas composer sans Auth
P1 ouverts               : preflight/compose de `7832765d…`
P1 fermé                 : decode PNG filtres 0–4 · paid text-free 1 submit
Prochaine porte majeure  : AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS
Living handover          : CURRENT_STATE_AND_RESUME.md
```

### Portes Directors texte

| Directeur | Smoke réel | Prompt canon |
|---|---|---|
| Marketing | PASS (10B) | `marketing-analyzer-v2` |
| Creative | PASS (10C) | `creative-analyzer-v5` |
| Script | PASS (10D) | `script-analyzer-v1` |
| Art | PASS (10E-V3) | `art-analyzer-v3` |
| Storyboard | PASS (10F-V4) | `storyboard-analyzer-v4` |

Post-Storyboard (Prompt → Router → Production média) : **implémenté en fakes** ; **non prouvé** provider réel sur `/director`.

---

## Mission

Virtual Humans Studio est un Assistant Réalisateur IA. À partir d'un brief simple, il construit une stratégie, un concept, un script, une direction visuelle, un storyboard, des packages de scène, un plan de génération, puis pilote la production, le montage et l'export.

L'utilisateur ne choisit ni fournisseur, ni modèle, ni syntaxe de prompt. Les studios historiques restent disponibles comme outils avancés.

## Pipeline immuable

```text
Utilisateur → AI Video Director (/director)
→ Marketing Director → MarketingPlan
→ Creative Director → CreativeConcept
→ Script Writer → VideoScript
→ Art Director → VisualDirection
→ Storyboard Director → StoryboardProject
→ Prompt Director → ScenePackage[] / scene_package_set
→ Model Router → GenerationPlan
→ Production Director → ProductionResult
→ Generation Engine → Providers
→ Merge → Export
```

`AI Video Director` est le nom de l'expérience et de l'orchestrateur de workflow, pas un Directeur métier et pas un fichier supplémentaire.

## Règles cardinales

1. Un module possède une responsabilité unique.
2. Les Directeurs ne s'appellent jamais entre eux ; le workflow transmet des objets métier immuables et versionnés.
3. Toute frontière valide les données avec Zod et conserve le type TypeScript correspondant.
4. Les Directeurs ignorent les API ; les providers ignorent le métier.
5. Le Model Router choisit une stratégie de production, pas seulement un modèle.
6. Le Production Director est le seul orchestrateur d'exécution.
7. Une scène est indépendante, reprenable et régénérable.
8. Tout appel payant est précédé d'une estimation et possède un mode dry-run.
9. L'application manipule `Character`, jamais des personnages codés en dur.
10. Les secrets restent côté serveur et ne sont jamais journalisés.

---

## Classification documentaire

| Classe | Signification |
|---|---|
| `CURRENT` | Décrit l’architecture ou l’état encore valides |
| `NEEDS_UPDATE` | (temporaire pendant refresh) — corriger puis reclasse |
| `HISTORICAL_SNAPSHOT` | Figé à une date ; bandeau obligatoire ; ne pas réécrire l’histoire |
| `FUTURE_DESIGN` | Vision / cible ; ≠ livré |

---

## Index complet 00–58

### Canon fondation (00–20)

| Doc | Titre | Classe |
|---|---|---|
| [`00_README.md`](./00_README.md) | Index et règles | `CURRENT` |
| [`01_PROJECT_CONTEXT.md`](./01_PROJECT_CONTEXT.md) | Contexte produit | `CURRENT` |
| [`02_ARCHITECTURE.md`](./02_ARCHITECTURE.md) | Architecture figée | `CURRENT` |
| [`03_CURRENT_AUDIT.md`](./03_CURRENT_AUDIT.md) | Protocole d’audit initial | `HISTORICAL_SNAPSHOT` |
| [`04_TARGET_VISION.md`](./04_TARGET_VISION.md) | Vision UX / NFR | `FUTURE_DESIGN` |
| [`05_DEVELOPMENT_RULES.md`](./05_DEVELOPMENT_RULES.md) | Règles d’ingénierie | `CURRENT` |
| [`06_ROADMAP_V2.md`](./06_ROADMAP_V2.md) | Roadmap théorique + carte exécutée | `CURRENT` |
| [`07_MARKETING_DIRECTOR.md`](./07_MARKETING_DIRECTOR.md) | Contrat Marketing | `CURRENT` |
| [`08_CREATIVE_DIRECTOR.md`](./08_CREATIVE_DIRECTOR.md) | Contrat Creative | `CURRENT` |
| [`09_SCRIPT_WRITER.md`](./09_SCRIPT_WRITER.md) | Contrat Script | `CURRENT` |
| [`10_ART_DIRECTOR.md`](./10_ART_DIRECTOR.md) | Contrat Art | `CURRENT` |
| [`11_STORYBOARD_DIRECTOR.md`](./11_STORYBOARD_DIRECTOR.md) | Contrat Storyboard | `CURRENT` |
| [`12_PROMPT_DIRECTOR.md`](./12_PROMPT_DIRECTOR.md) | Contrat Prompt | `CURRENT` |
| [`13_MODEL_ROUTER.md`](./13_MODEL_ROUTER.md) | Contrat Router | `CURRENT` |
| [`14_PRODUCTION_DIRECTOR.md`](./14_PRODUCTION_DIRECTOR.md) | Contrat Production | `CURRENT` |
| [`15_GENERATION_ENGINE.md`](./15_GENERATION_ENGINE.md) | Contrat Generation Engine | `CURRENT` |
| [`16_DIRECTOR_UI.md`](./16_DIRECTOR_UI.md) | UI Director | `CURRENT` |
| [`17_SUPABASE_PROJECTS.md`](./17_SUPABASE_PROJECTS.md) | **Schéma Supabase réel** | `CURRENT` |
| [`18_TESTING.md`](./18_TESTING.md) | Stratégie tests + baselines | `CURRENT` |
| [`19_DEPLOYMENT.md`](./19_DEPLOYMENT.md) | Déploiement / flags / ops | `CURRENT` |
| [`20_FINAL_AUDIT.md`](./20_FINAL_AUDIT.md) | Audit final Phase 9 (fakes) | `HISTORICAL_SNAPSHOT` |

### Rapports historiques / ops (21–58) — ne pas réécrire

| Doc | Sujet |
|---|---|
| [`21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`](./21_VHS_125_REMOTE_MIGRATION_INCIDENT.md) | Incident migrations Production |
| [`22_DIRECTOR_HUMAN_RETRY.md`](./22_DIRECTOR_HUMAN_RETRY.md) | Retry humain Director |
| [`23_PHASE_10A_REMOTE_PREFLIGHT.md`](./23_PHASE_10A_REMOTE_PREFLIGHT.md) | Préflight distant |
| [`24_PHASE_10AB_ENVIRONMENT_SAFETY.md`](./24_PHASE_10AB_ENVIRONMENT_SAFETY.md) | Isolation environnement / backup P1 |
| [`25_PHASE_10AC_VERCEL_KILL_SWITCH_RESET.md`](./25_PHASE_10AC_VERCEL_KILL_SWITCH_RESET.md) | Kill switches Vercel |
| [`26_PHASE_10AD_LOCAL_DB_SAFE_REDEPLOY.md`](./26_PHASE_10AD_LOCAL_DB_SAFE_REDEPLOY.md) | Redeploy DB local sûr |
| [`27_PHASE_10B_FIRST_REAL_TEXT_SMOKE.md`](./27_PHASE_10B_FIRST_REAL_TEXT_SMOKE.md) | Marketing PASS |
| [`28_PHASE_10C_CREATIVE_SMOKE_PREP.md`](./28_PHASE_10C_CREATIVE_SMOKE_PREP.md) | Creative PREP |
| [`29_PHASE_10C_FIRST_REAL_CREATIVE_SMOKE.md`](./29_PHASE_10C_FIRST_REAL_CREATIVE_SMOKE.md) | Creative PASS |
| [`30_PHASE_10D_SCRIPT_SMOKE_PREP.md`](./30_PHASE_10D_SCRIPT_SMOKE_PREP.md) | Script PREP |
| [`31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md`](./31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md) | Script PASS |
| [`32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md`](./32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md) | Canon Script |
| [`33_PHASE_10E_ART_TEXT_SMOKE_PREP.md`](./33_PHASE_10E_ART_TEXT_SMOKE_PREP.md) | Art PREP |
| [`34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md`](./34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md) | Art BLOCKED v2 |
| [`35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md`](./35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md) | Diag Art |
| [`36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md`](./36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md) | Art v3 PREP |
| [`37_PHASE_10E_ART_V3_NEW_EXECUTE.md`](./37_PHASE_10E_ART_V3_NEW_EXECUTE.md) | Art PASS v3 |
| [`38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md`](./38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md) | Storyboard PREP |
| [`39_PHASE_10F_FIRST_REAL_STORYBOARD_TEXT_SMOKE.md`](./39_PHASE_10F_FIRST_REAL_STORYBOARD_TEXT_SMOKE.md) | Storyboard budget BLOCKED |
| [`40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md`](./40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md) | Audit budget |
| [`41_PHASE_10F_BUDGET_AUTH_A.md`](./41_PHASE_10F_BUDGET_AUTH_A.md) | Budget Auth A |
| [`42_PHASE_10F_STORYBOARD_AUTH_B.md`](./42_PHASE_10F_STORYBOARD_AUTH_B.md) | Auth B |
| [`43_PHASE_10F_STORYBOARD_AUTH_B_RESUME.md`](./43_PHASE_10F_STORYBOARD_AUTH_B_RESUME.md) | Auth B resume |
| [`44_PHASE_10F_STORYBOARD_PROVIDER_DIAG.md`](./44_PHASE_10F_STORYBOARD_PROVIDER_DIAG.md) | Diag provider schéma |
| [`45_PHASE_10F_STORYBOARD_RETRY2_PREP.md`](./45_PHASE_10F_STORYBOARD_RETRY2_PREP.md) | Retry2 PREP |
| [`46_PHASE_10F_RETRY2_DEPLOY_PREFLIGHT.md`](./46_PHASE_10F_RETRY2_DEPLOY_PREFLIGHT.md) | Retry2 deploy |
| [`47_PHASE_10F_STORYBOARD_RETRY2_EXECUTE.md`](./47_PHASE_10F_STORYBOARD_RETRY2_EXECUTE.md) | Retry2 BLOCKED |
| [`48_PHASE_10F_STORYBOARD_CONTINUITY_DIAG.md`](./48_PHASE_10F_STORYBOARD_CONTINUITY_DIAG.md) | Diag continuité → v3 |
| [`49_PHASE_10F_STORYBOARD_V3_RETRY_PREP.md`](./49_PHASE_10F_STORYBOARD_V3_RETRY_PREP.md) | V3 PREP |
| [`50_PHASE_10F_V3_BUDGET_AND_PUSH.md`](./50_PHASE_10F_V3_BUDGET_AND_PUSH.md) | V3 budget+push |
| [`51_PHASE_10F_V3_DEPLOY_PREFLIGHT.md`](./51_PHASE_10F_V3_DEPLOY_PREFLIGHT.md) | V3 deploy |
| [`52_PHASE_10F_STORYBOARD_V3_EXECUTE.md`](./52_PHASE_10F_STORYBOARD_V3_EXECUTE.md) | V3 BLOCKED |
| [`53_PHASE_10F_STORYBOARD_ALL_CONTINUITY_DIAG.md`](./53_PHASE_10F_STORYBOARD_ALL_CONTINUITY_DIAG.md) | Diag → v4 |
| [`54_PHASE_10F_STORYBOARD_V4_RETRY_PREP.md`](./54_PHASE_10F_STORYBOARD_V4_RETRY_PREP.md) | V4 PREP |
| [`55_PHASE_10F_V4_BUDGET_AND_PUSH.md`](./55_PHASE_10F_V4_BUDGET_AND_PUSH.md) | V4 budget+push |
| [`56_PHASE_10F_V4_DEPLOY_PREFLIGHT.md`](./56_PHASE_10F_V4_DEPLOY_PREFLIGHT.md) | V4 deploy |
| [`57_PHASE_10F_STORYBOARD_V4_EXECUTE.md`](./57_PHASE_10F_STORYBOARD_V4_EXECUTE.md) | **Storyboard PASS** |
| [`58_PHASE_11A_FIRST_REAL_MEDIA_SMOKE_PREP.md`](./58_PHASE_11A_FIRST_REAL_MEDIA_SMOKE_PREP.md) | **Media PREP / DECISION_REQUIRED** |
| [`59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md`](./59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md) | **Motion Transfer — ARCHITECTURE_READY_FOR_IMPLEMENTATION** |
| [`60_MT001_MOTION_TRANSFER_DOMAIN_CONTRACTS.md`](./60_MT001_MOTION_TRANSFER_DOMAIN_CONTRACTS.md) | **MT-001 domain contracts — Gate MT-1 PASS** |
| [`61_MT002_MOTION_TRANSFER_CAPABILITY_REGISTRY.md`](./61_MT002_MOTION_TRANSFER_CAPABILITY_REGISTRY.md) | **MT-002 Capability Registry — Gate MT-2 Registry PASS** |
| [`62_MT003_MOTION_TRANSFER_ROUTER.md`](./62_MT003_MOTION_TRANSFER_ROUTER.md) | **MT-003 Router strategy — Gate MT-2 Router PASS** |
| [`63_MT004_MOTION_TRANSFER_GENERATION_ENGINE.md`](./63_MT004_MOTION_TRANSFER_GENERATION_ENGINE.md) | **MT-004 Engine dry-run — Gate MT-3 PASS** |
| [`64_MT005_MOTION_TRANSFER_SUPABASE_STORAGE.md`](./64_MT005_MOTION_TRANSFER_SUPABASE_STORAGE.md) | **MT-005 Persistence/Storage — Gate MT-3 PASS** |
| [`65_MT006_MOTION_TRANSFER_PROVIDER_PORT.md`](./65_MT006_MOTION_TRANSFER_PROVIDER_PORT.md) | **MT-006 Provider Port + fake — Gate MT-4 PASS** |
| [`66_MT007A_MOTION_TRANSFER_PROVIDER_SPIKE.md`](./66_MT007A_MOTION_TRANSFER_PROVIDER_SPIKE.md) | **MT-007A Provider spike — fal Kling v3 Pro selected (disabled)** |
| [`67_MT007B_FAL_KLING_MOTION_CONTROL_ADAPTER.md`](./67_MT007B_FAL_KLING_MOTION_CONTROL_ADAPTER.md) | **MT-007B fal Kling adapter — disabled / Gate MT-5 PASS** |
| [`68_MT008_MOTION_TRANSFER_WORKER_POLLING.md`](./68_MT008_MOTION_TRANSFER_WORKER_POLLING.md) | **MT-008 Worker polling — Gate MT-6 PASS** |
| [`69_MT009_MOTION_QUALITY_CONTROL.md`](./69_MT009_MOTION_QUALITY_CONTROL.md) | **MT-009 Motion QC — Gate MT-7 PASS** |
| [`70_MT010_MOTION_TRANSFER_HUMAN_REVIEW.md`](./70_MT010_MOTION_TRANSFER_HUMAN_REVIEW.md) | **MT-010 Human Review API/UI — Gate MT-8 PASS** |
| [`71_MT011_MOTION_TRANSFER_OBSERVABILITY_SECURITY.md`](./71_MT011_MOTION_TRANSFER_OBSERVABILITY_SECURITY.md) | **MT-011 Observability & Security — Gate MT-9 PASS** |
| [`72_MT012_MOTION_TRANSFER_FULL_DRY_RUN.md`](./72_MT012_MOTION_TRANSFER_FULL_DRY_RUN.md) | **MT-012 Full dry-run & synthetic E2E — Gate MT-012 PASS** |
| [`73_MT013A_MV001_BENCHMARK_READINESS.md`](./73_MT013A_MV001_BENCHMARK_READINESS.md) | **MT-013A MV-001 governance readiness — READY_FOR_HUMAN_GOVERNANCE_DECISIONS** |
| [`74_MT013B_RESTORE_DRILL_PRIVACY_DUE_DILIGENCE.md`](./74_MT013B_RESTORE_DRILL_PRIVACY_DUE_DILIGENCE.md) | **MT-013B journal · restore PASS / privacy ACCEPTED via 78_ + 81_** |
| [`81_MT013D_MV001_PRIVACY_DECISION_PACK_ACCEPTED.md`](./81_MT013D_MV001_PRIVACY_DECISION_PACK_ACCEPTED.md) | **Privacy Decision Pack MV-001 ACCEPTED_LIMITED · expire 2026-09-10 · pas d’exécution** |
| [`82_MT005_REMOTE_APPLY_PASS.md`](./82_MT005_REMOTE_APPLY_PASS.md) | **MT-005 remote apply PASS · Production 30/30 · runtime Motion UNAVAILABLE** |
| [`83_MT013E_MV001_BUDGET_HARD_LIMIT_174.md`](./83_MT013E_MV001_BUDGET_HARD_LIMIT_174.md) | **MT-013E budget hard 122→174 · available 62¢ · pas de réservation** |
| [`84_MT013F_MV001_CONTROLLED_BENCHMARK_PREP.md`](./84_MT013F_MV001_CONTROLLED_BENCHMARK_PREP.md) | **MT-013F prep · READY_FOR_MEDIA_AND_DEPLOY_AUTH · 0 fal / 0 upload** |
| [`85_MT013G_MV001_LOCAL_MEDIA_VALIDATE.md`](./85_MT013G_MV001_LOCAL_MEDIA_VALIDATE.md) | **MT-013G local media · MEDIA_INVALID (source 16s/360p — historique)** |
| [`86_MT013G2_MV001_8S_MEDIA_PREPARATION.md`](./86_MT013G2_MV001_8S_MEDIA_PREPARATION.md) | **MT-013G2 8s 720p préparé · MEDIA_VALIDATED · shortfall 100¢ (pré-H)** |
| [`87_MT013H_MV001_8S_BUDGET_HARD_LIMIT_274.md`](./87_MT013H_MV001_8S_BUDGET_HARD_LIMIT_274.md) | **MT-013H budget hard 174→274 · available 162¢ · shortfall 0** |
| [`88_MT013I_MV001_PRIVATE_MEDIA_UPLOAD.md`](./88_MT013I_MV001_PRIVATE_MEDIA_UPLOAD.md) | **MT-013I private upload · 2 assets · project `390c25db-…` · 0 fal** |
| [`89_MT013J_MV001_DEPLOY_PREFLIGHT_NO_PROVIDER.md`](./89_MT013J_MV001_DEPLOY_PREFLIGHT_NO_PROVIDER.md) | **MT-013J deploy preflight · READY_FOR_PAID_AUTH · flags OFF** |
| [`95_MT013M_MV001_FINAL_PAID_SINGLE_EXECUTION.md`](./95_MT013M_MV001_FINAL_PAID_SINGLE_EXECUTION.md) | **MT-013M paid single call · submit=1 · 135¢** |
| [`96_MT013N_MV001_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW.md`](./96_MT013N_MV001_REVIEW_INTEGRITY_AND_PRIVATE_PREVIEW.md) | **MT-013N review integrity · private preview** |
| [`97_MT013O_MV001_HUMAN_REVIEW_APPROVE.md`](./97_MT013O_MV001_HUMAN_REVIEW_APPROVE.md) | **MT-013O Human Review APPROVE · PASS_WITH_HUMAN_APPROVAL** |
| [`98_MT013P_MOTION_OPERATIONAL_HARDENING.md`](./98_MT013P_MOTION_OPERATIONAL_HARDENING.md) | **MT-013P operational recovery hardened · stub REMOVED** |
| [`99_MT014_MOTION_TRANSFER_BENCHMARK_EVALUATION.md`](./99_MT014_MOTION_TRANSFER_BENCHMARK_EVALUATION.md) | **MT-014 eval · PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY** |
| [`100_MT015A_MV002_BENCHMARK_DESIGN_PREP.md`](./100_MT015A_MV002_BENCHMARK_DESIGN_PREP.md) | **MT-015A MV-002 design · DESIGN_READY · DEFERRED** |
| [`101_PHASE_11A_MEDIA_PIPELINE_RESUME_AUDIT.md`](./101_PHASE_11A_MEDIA_PIPELINE_RESUME_AUDIT.md) | **11A-RESUME · BLOCKED_MEDIA_PRODUCTION_WIRING** |
| [`102_PHASE_11A_WIRE_OPENAI_IMAGE_ALLOWLIST.md`](./102_PHASE_11A_WIRE_OPENAI_IMAGE_ALLOWLIST.md) | **11A-WIRE · OPENAI_IMAGE path WIRED_DISABLED** |
| [`103_PHASE_11A_OPENAI_IMAGE_LIVE_PREFLIGHT.md`](./103_PHASE_11A_OPENAI_IMAGE_LIVE_PREFLIGHT.md) | **11A-PREFLIGHT · READY_FOR_11A_PAID_AUTH** |
| [`104_PHASE_11A_FINAL_PREFLIGHT_9952380.md`](./104_PHASE_11A_FINAL_PREFLIGHT_9952380.md) | **11A-FINAL-PREFLIGHT · source 9952380** |
| [`105_PHASE_11A_FIRST_REAL_OPENAI_IMAGE_SMOKE.md`](./105_PHASE_11A_FIRST_REAL_OPENAI_IMAGE_SMOKE.md) | **11A-PAID-SMOKE · BLOCKED_PRECONDITION** |
| [`106_PHASE_11A_STORAGE_PLAN_AND_PAYLOAD_WIRING.md`](./106_PHASE_11A_STORAGE_PLAN_AND_PAYLOAD_WIRING.md) | **11A-WIRE storage/plan · READY_FOR_NEW_PREFLIGHT** |
| [`107_PHASE_11A_FINAL_LIVE_PREFLIGHT_AFTER_STORAGE_WIRING.md`](./107_PHASE_11A_FINAL_LIVE_PREFLIGHT_AFTER_STORAGE_WIRING.md) | **11A-LIVE-PREFLIGHT · 7a67c77 · READY_FOR_11A_PAID_AUTH** |
| [`108_PHASE_11A_FIRST_REAL_OPENAI_IMAGE_SMOKE.md`](./108_PHASE_11A_FIRST_REAL_OPENAI_IMAGE_SMOKE.md) | **11A-PAID-SMOKE · RECONCILIATION_REQUIRED** (supersédé ops par `109_`) |
| [`109_PHASE_11A_IMAGE_LEDGER_RECONCILIATION.md`](./109_PHASE_11A_IMAGE_LEDGER_RECONCILIATION.md) | **11A-LEDGER-RECONCILE · PASS_LEDGER_RECONCILED_HUMAN_REVIEW_PENDING** |
| [`110_PHASE_11A_HUMAN_REVIEW_REJECT.md`](./110_PHASE_11A_HUMAN_REVIEW_REJECT.md) | **11A-HR-REJECT · PASS_TECHNICAL_ASSET_HUMAN_REJECTED** |
| [`111_PHASE_11A_DETERMINISTIC_TYPOGRAPHY_HARDENING.md`](./111_PHASE_11A_DETERMINISTIC_TYPOGRAPHY_HARDENING.md) | **11A-HARDEN · READY_FOR_TEXT_FREE_IMAGE_RETRY_PREFLIGHT** |
| [`112_PHASE_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT.md`](./112_PHASE_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT.md) | **11A-TEXT-FREE-RETRY-PREFLIGHT · BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT** |
| [`113_PHASE_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT.md`](./113_PHASE_11A_STRIP_OVERLAY_COPY_FROM_IMAGE_VARIANT.md) | **11A-STRIP-OVERLAY-COPY · READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT** |
| [`114_PHASE_11A_TEXT_FREE_IMAGE_RETRY_LIVE_PREFLIGHT.md`](./114_PHASE_11A_TEXT_FREE_IMAGE_RETRY_LIVE_PREFLIGHT.md) | **11A-TEXT-FREE-RETRY-LIVE-PREFLIGHT · READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH** |
| [`115_PHASE_11A_TEXT_FREE_IMAGE_PAID_GENERATION.md`](./115_PHASE_11A_TEXT_FREE_IMAGE_PAID_GENERATION.md) | **11A-TEXT-FREE-PAID · COMPOSITOR_FAILED_NO_RETRY** |
| [`116_PHASE_11A_PNG_FILTER_DECODER_HARDENING.md`](./116_PHASE_11A_PNG_FILTER_DECODER_HARDENING.md) | **11A-PNG-FILTER-DECODER · READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT** |
| [`75_MT013C_ISOLATED_RESTORE_TARGET_STOP.md`](./75_MT013C_ISOLATED_RESTORE_TARGET_STOP.md) | **MT-013C STOP — coût branche ≠ 0 · pas de restore backup via MCP** |
| [`76_MT013C_RESTORE_PAID_TARGET_STOP.md`](./76_MT013C_RESTORE_PAID_TARGET_STOP.md) | **MT-013C-PAID STOP — restore backup non disponible via MCP · clone Dashboard requis** |
| [`77_MT013C_DASHBOARD_QUOTE_PREFLIGHT.md`](./77_MT013C_DASHBOARD_QUOTE_PREFLIGHT.md) | **MT-013C-QUOTE CAPTURED — total $10.18/mois · STOP avant Continue** |
| [`78_MT013C_RESTORE_DRILL_PASS.md`](./78_MT013C_RESTORE_DRILL_PASS.md) | **MT-013C Restore drill PASS — cible `qmsh…qlnq` · P1 restore fermé** |
| [`79_MT013C_DELETE_TARGET_STOP.md`](./79_MT013C_DELETE_TARGET_STOP.md) | **MT-013C Delete STOP — préflight OK · pas de `delete_project` MCP** |
| [`80_MT013C_DELETE_TARGET_VERIFIED.md`](./80_MT013C_DELETE_TARGET_VERIFIED.md) | **MT-013C Delete VERIFIED — `qmsh…` absent · Production healthy** |

### Pilotage (hors numérotation)

| Doc | Rôle |
|---|---|
| [`CURRENT_STATE_AND_RESUME.md`](./CURRENT_STATE_AND_RESUME.md) | **Living handover — état réel + reprise** |
| [`BACKLOG_V2.md`](./BACKLOG_V2.md) | **État ops + items** |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historique documentaire / livraisons |
| [`CHECKLIST_RELEASE.md`](./CHECKLIST_RELEASE.md) | Checklist release |
| [`CURRENT_CODEBASE_AUDIT.md`](./CURRENT_CODEBASE_AUDIT.md) | Audit Phase 0→Porte 1 (**snapshot** + bandeau courant) |
| [`SUPABASE_V2_MIGRATION_PLAN.md`](./SUPABASE_V2_MIGRATION_PLAN.md) | Plan apply + baseline locale |
| [`GLOSSARY.md`](./GLOSSARY.md) | Vocabulaire normatif |

---

## Ordre de lecture recommandé

1. [`CURRENT_STATE_AND_RESUME.md`](./CURRENT_STATE_AND_RESUME.md) (état réel + prochaine porte).
2. Ce README (index).
3. `BACKLOG_V2.md` + `CHANGELOG.md` (items).
4. `02_ARCHITECTURE.md` + `05_DEVELOPMENT_RULES.md`.
5. Contrats `07`–`15` selon le module.
6. `17_SUPABASE_PROJECTS.md` pour toute question données.
7. `18_TESTING.md` / `19_DEPLOYMENT.md` pour qualité et ops.
8. Rapports `27`–`58` pour preuves smokes ; `20` / `03` seulement comme historique.
9. Avant média image borné : `58_` puis décision humaine — **ne pas** relancer sans Auth.
10. Chantier majeur Motion Transfer : `59_` → `60_`…`66_` (MT-001…007A) → MT-007B+ — **pas** de benchmark payant sans gates.

---

## Definition of Done globale

- contrats validés et persistables ;
- tests unitaires, intégration et E2E pertinents au vert ;
- aucun appel fournisseur depuis React ou un Directeur ;
- observabilité, coûts, erreurs et reprises vérifiés ;
- migration et rollback documentés ;
- documentation, changelog **et living handover** mis à jour.
