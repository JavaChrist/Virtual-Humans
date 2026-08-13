# Backlog V2

**Autorité ops courante** (11 août 2026) : ce fichier + `00_README.md` + derniers rapports (`57_`, `58_`).
Les identifiants VHS-* sont stables ; chaque item exige critères d'acceptation, tests et documentation.
Protocole d’audit initial : `03_CURRENT_AUDIT.md` (**historique**) — audit réel : `CURRENT_CODEBASE_AUDIT.md`.

```text
Checkpoint : 10F-V4 Storyboard PASS · 11A media PREP DECISION_REQUIRED
Motion     : ARCHITECTURE_READY · MT-001…012 IMPLEMENTED · MT-013A…E DONE
             MT-013F prep READY_FOR_MEDIA_AND_DEPLOY_AUTH (`84_`)
             MT-013G2 8s PREPARED + MEDIA_VALIDATED (`86_`)
             MT-013H hard 274 / available 162 / shortfall 0 (`87_`)
             MT-013I MEDIA_UPLOADED · 2 private assets (`88_`)
             MT-013J READY_FOR_PAID_AUTH · flags OFF (`89_`)
             MT-013K-WIRE Production orchestrator WIRED (`90_`) · 0 fal
             MT-013K-DURABILITY polling recovery PASS (`91_`)
             MT-013K-QC-CONSUMER post-qc drain WIRED (`92_`) · 0 fal
             MT-013K-OUTPUT-TRANSPORT fal result+ingest WIRED (`93_`) · 0 fal
             MT-013L FULL PREFLIGHT READY_FOR_FINAL_PAID_AUTH (`94_`) · 0 fal
             MT-013M FINAL PAID SINGLE CALL CONSUMED (`95_`) · submit=1
             MT-013N REVIEW INTEGRITY PASS + private preview prep (`96_`) · 0 fal
             MT-013O HUMAN REVIEW APPROVE (`97_`) · decision=1 approved
             MT-013P OPERATIONAL RECOVERY HARDENED (`98_`) · stub REMOVED
             MT-014 BENCHMARK EVAL (`99_`) · PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY
             MT-015A MV-002 DESIGN READY (`100_`) · OPS = DEFERRED
             Phase 11A-RESUME (`101_`) · BLOCKED_MEDIA_PRODUCTION_WIRING (historique)
             Phase 11A-WIRE (`102_`) · WIRED_DISABLED
             Phase 11A-PREFLIGHT (`103_`) · READY_FOR_11A_PAID_AUTH
             Phase 11A-FINAL-PREFLIGHT (`104_`) · source **9952380** PASS
             Phase 11A-PAID-SMOKE (`105_`) · BLOCKED_PRECONDITION (provider non consommé)
             Phase 11A-STORAGE/PLAN (`106_`) · READY_FOR_NEW_11A_LIVE_PREFLIGHT
             MV001 = PASS_WITH_HUMAN_APPROVAL · Motion Registry DISABLED
             RUNTIME_MOTION = UNAVAILABLE · RUNTIME_PAID_MEDIA = OFF
Budget     : 274 / committed 247 / reserved 0 / available 27
Runtime AI : OFF
Media jobs : 0 (générique) · Motion MV-001 settled à part
P0         : pas d’appel OpenAI sans Auth · pas de legacy PASS
P1         : Auth 11A-LIVE-PREFLIGHT-NO-PROVIDER (nouveau SHA) → smoke once
P1 fermé   : STORAGE/PLAN-MATERIALIZE · SMOKE-BLOCKED · MV-002 DEFERRED
Next major : live preflight no-provider (pas MV-002)
```

## P0 — fondations

- **VHS-001** ✅ Auditer dépôt, schéma et flux actuels. *(voir `CURRENT_CODEBASE_AUDIT.md`)*
- **VHS-002** ✅ Authentification fail-closed — Phase 7 + E2E Phase 8 ; checkpoint Phase 9 (unitaires 785).
- **VHS-003** ✅ Types/schemas communs et métadonnées d'artifact.
- **VHS-004** ✅ Révisions, états et optimistic locking (domaine + persistance V2).
- **VHS-005** 🟡 Corrélation, logs redacted, métriques et traces. *(Phase 9 : redaction data URL renforcée ; restent métriques/traces distribuées)*
- **VHS-006** 🟡 Ledger, estimation, réservation et plafond dur. *(ledger V2 + budget `/director` ; routes generate historiques + rapprochement coûts réels restent ouverts)*

## P1 — parcours métier

- **VHS-101…VHS-112** ✅ Pipeline `/director` local Brief → … → Export (fakes) — Phases 1–8 ; flags AI/paid off. *(Texte réel Marketing→Storyboard validé en 10B–10F ; média réel `/director` toujours non validé — 11A.)*
- **VHS-111B** ✅ Helper fal compose historique — **sans** basculer `/director`.
- **VHS-111C** ✅ Pipeline AICCOS extractible — stub `/director` ; envoi réel off.
- **VHS-113** ✅ Persistance Supabase V2 additive locale — **sans** apply distant. *(voir `SUPABASE_V2_MIGRATION_PLAN.md`)*
- **VHS-114** ✅ Worker borné `run-once` — secret + flags off ; **sans** cron.
- **VHS-115** ✅ Validation locale migrations — Porte 1 : 17 mig. ; pgTAP 286 ; intégration 31 ; **2 cycles** verts.
- **VHS-116…VHS-126** ✅ Brief → Marketing → … → stale cascade — livrés localement ; flags off.
- **VHS-127** ✅ Stockage durable médias finaux — bucket privé `director-final-assets` + `AssetContentPort` Supabase Storage ; mémoire impossible en Production ; **apply distant non effectué**.
- **VHS-117C** ✅ Smoke Marketing OpenAI réel — Phase 10B PASS : 1 appel `gpt-5.6`, plan Zod valide, ledger 24¢ réservés / 4¢ consommés / 20¢ libérés, replay idempotent sans second appel ; runtime AI refermé OFF.
- **Phase 9** ✅ Audit final + gate fake-delivery + docs + 2 cycles complets locaux — **pas** production distante.
- **Phases 10A–10B** ✅ Préflight distant, isolation environnement, validation DB locale et premier smoke Marketing réel terminés ; migrations **29/29**, pgTAP **378**, intégration **33**, unitaires **1016** ; **0 média**.
- **P1 backup/restore** ✅ **FERMÉ** (`78_`) — `RESTORE_DRILL = PASS` · cible isolée `qmsh…qlnq` · Production non mutée.
- **Phase 10C-PREP** ✅ Préparation Creative sans provider : MarketingPlan 10B réutilisable, dry-run estimate 12¢ / plafond 100¢.
- **VHS-118C / Phase 10C** ✅ Smoke Creative OpenAI réel : 1 appel `gpt-5.6`, concept Zod valide, ledger 12¢/5¢/7¢, replay idempotent, flags OFF.
- **Phase 10D-PREP** ✅ Préparation Script sans provider : Marketing+Creative réutilisés, dry-run estimate 7¢ / plafond 100¢ ; **aucune** exécution Script réelle.
- **Phase 10D** ✅ Smoke Script OpenAI réel (réauth) : 1 appel `gpt-5.6`, VideoScript Zod valide, ledger 12¢/3¢/9¢, replay idempotent, flags OFF (`31_PHASE_10D_FIRST_REAL_SCRIPT_SMOKE.md`).
- **Phase 10D-RECONCILE** ✅ Canon Script = Production : `gpt-5.6` / `medium` / `4096` / **12¢** ; PREP corrigé (`32_PHASE_10D_SCRIPT_CONFIG_RECONCILIATION.md`).
- **Phase 10E-PREP** ✅ Préparation Art texte sans provider/média : amont Marketing+Creative+Script réutilisés, dry-run estimate 13¢ / plafond 100¢ ; **aucune** exécution Art réelle (`33_PHASE_10E_ART_TEXT_SMOKE_PREP.md`).
- **Phase 10E** ⚠️ Smoke Art texte réel **BLOCKED** : 1 appel `gpt-5.6`, dry-run live OK (13¢), candidat `invalid_candidate` (continuité lieu) — **0** VisualDirection ; ledger 13/12/1¢ ; flags OFF (`34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md`).
- **Phase 10E-DIAG** ✅ Cause = prompt v2 insuffisant + candidat Zod-valide incohérent métier ; prompt **`art-analyzer-v3`** ; `/art/retry` incompatible (`invalid_candidate` non allowlisté + mismatch v2→v3) (`35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md`).
- **Phase 10E-RETRY-PREP** ✅ Nouvel execute v3 préparé (clé ≠ v2, attempt 1, estimate 13¢, guards) ; **0** provider (`36_PHASE_10E_ART_V3_NEW_EXECUTE_PREP.md`).
- **Phase 10E-V3** ✅ Smoke Art texte réel PASS : 1 appel `gpt-5.6` / `art-analyzer-v3`, VisualDirection rev.1, ledger 13/12/1¢, replay idempotent, run v2 immuable, flags OFF (`37_PHASE_10E_ART_V3_NEW_EXECUTE.md`).
- **Phase 10F-PREP** ✅ Préparation Storyboard texte sans provider/média : amont Marketing+Creative+Script+VisualDirection réutilisés, dry-run estimate 13¢ / plafond 100¢, prompt `storyboard-analyzer-v2` ; **aucune** exécution Storyboard réelle (`38_PHASE_10F_STORYBOARD_TEXT_SMOKE_PREP.md`).
- **Phase 10F** ⚠️ Smoke Storyboard texte **BLOCKED** : dry-run live OK (13¢) ; `budget_exceeded` (hard limit 100 / restant 7) — **0** appel provider ; **0** storyboard_project ; flags OFF (`39_PHASE_10F_FIRST_REAL_STORYBOARD_TEXT_SMOKE.md`).
- **Phase 10F-BUDGET-AUDIT** ✅ Ledger cohérent (93¢ commits / 7¢ dispo) ; Auth A→113¢ + Auth B (salt) préparés ; **0** write (`40_PHASE_10F_WORKSPACE_BUDGET_AUDIT.md`).
- **Phase 10F-BUDGET-AUTH-A** ✅ Hard limit **100→113¢** (+13) + audit_log ; available **20¢** ; **0** provider / réservation / Storyboard ; runtime OFF (`41_PHASE_10F_BUDGET_AUTH_A.md`).
- **Phase 10F-AUTH-B** ⚠️ Storyboard texte **BLOCKED** : stale deploy (`42_…`) puis resume salt-ready (`43_…`) : execute `request_failed` — **1** provider, 0 storyboard ; flags OFF.
- **Phase 10F-PROVIDER-DIAG** ✅ Cause = schéma `oneOf`/`spokenContent` ; fix `oneOf→anyOf` + mapping/logs ; **0** provider (`44_…`, `READY_FOR_RETRY_PREP`).
- **Phase 10F-RETRY2-PREP** ✅ Préparation execute post-fix : schéma oneOf=0 / anyOf-compatible, parité Zod, obs provider redacted, salt `10f-auth-b-retry2-20260810` (clé `0b7e8fb44e0acd4d`), dry-run gates ; **0** provider (`45_…`, `READY_FOR_PUSH_AND_REAUTH`).
- **Phase 10F-RETRY2-DEPLOY-PREFLIGHT** ✅ Salt RETRY2 posé ; deploy `a849e03` ; dry-run live gates verts ; fermeture OFF ; **0** provider (`46_…`).
- **Phase 10F-RETRY2-EXECUTE** ⚠️ **BLOCKED** : 1 appel `gpt-5.6` → `invalid_candidate` (continuité `location:espace-numerique-principal`) ; ledger 13/8/5 ; available **12¢** ; **0** storyboard ; flags OFF (`47_…`).
- **Phase 10F-CONTINUITY-DIAG** ✅ Cause = prompt v2 ; fix `storyboard-analyzer-v3` + map clés location ; validateur fail-closed inchangé ; **0** provider (`48_…`, `READY_FOR_RETRY_PREP`).
- **Phase 10F-V3-RETRY-PREP** ✅ Préparation execute v3 : salt `10f-storyboard-v3-20260810` (clé `1bf9daeb68eb6432`), map 5× `location:espace-numerique-principal`, estimate **13¢**, shortfall **1¢**, oneOf=0 ; **0** provider (`49_…`, `READY_FOR_BUDGET_AND_PUSH_AUTH`).
- **Phase 10F-V3-BUDGET-AND-PUSH** ✅ Hard limit **113→115** (+2) + audit ; available **14¢** ; push `a849e03..a82b9cf` ; **0** provider (`50_…`, `PASS`).
- **Phase 10F-V3-DEPLOY-PREFLIGHT** ✅ Salt `10f-storyboard-v3-20260810` ; deploy `a82b9cf` ; dry-run live v3 gates verts ; fermeture OFF ; **0** provider (`51_…`, `READY_FOR_PROVIDER_REAUTH`).
- **Phase 10F-V3-EXECUTE** ⚠️ **BLOCKED** : 1 appel `gpt-5.6` / v3 → `invalid_candidate` (continuité `lighting:studio|cool`) ; ledger 13/6/7 ; available **8¢** ; **0** storyboard ; flags OFF (`52_…`).
- **Phase 10F-ALL-CONTINUITY-DIAG** ✅ Cause = map v3 limitée à `location` ; fix générique `storyboard-analyzer-v4` ; validateur fail-closed inchangé ; **0** provider (`53_…`, `READY_FOR_V4_PREP`).
- **Phase 10F-V4-RETRY-PREP** ✅ Préparation execute v4 : map `MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` (lighting preferred → tokens quand même obligatoires), salt `10f-storyboard-v4-20260811` (clé `801c34a1080bbcf0`), matrice 24/9/5 fp `9d34b42ddc3bb85c`, estimate **13¢**, shortfall **5¢** ; **0** provider (`54_…`, `READY_FOR_BUDGET_AND_PUSH_AUTH`).
- **Phase 10F-V4-BUDGET-AND-PUSH** ✅ Hard limit **115→122** (+7) + audit ; available **15¢** ; push `a82b9cf..90fb6fb` (5 commits) ; **0** provider (`55_…`, `PASS`).
- **Phase 10F-V4-DEPLOY-PREFLIGHT** ✅ Salt `10f-storyboard-v4-20260811` ; deploy `90fb6fb` ; dry-run live v4 gates verts (24/9/5 fp `9d34b42ddc3bb85c`) ; fermeture OFF ; **0** provider (`56_…`).
- **Phase 10F-V4-EXECUTE** ✅ Smoke Storyboard texte PASS : 1 appel `gpt-5.6` / v4, `storyboard_project` rev.1, continuité 24/9/5, ledger 13/5/8, available **10¢**, replay idempotent, flags OFF (`57_…`, `PASS`).
- **Phase 11A** 🟡 Audit + prep premier smoke média : reco **1 image OpenAI** (~1–2¢, scene-2 text_motion) ; **DECISION_REQUIRED** (VHS-124 forbids real adapters on `/director`) (`58_…`). *Suspendue — ne pas relancer sans Auth.*
- **Doc refresh** ✅ Canon 00–20 + `17_SUPABASE` alignés schéma réel / Phases 10–11A.
- **Motion / Performance Transfer** 🟡 Architecture `59_` · **MT-001…015A** (`60_`…`100_`) · MV-002 **DEFERRED** · Registry Motion **disabled** · MV-001 **PASS_WITH_HUMAN_APPROVAL** · Runtime UNAVAILABLE.
- **Phase 11A média** 🟢 **READY_FOR_NEW_11A_LIVE_PREFLIGHT** (`106_`) — routing single-step + Storage privé + strip base64 · FP `c532c400334f5b22` · runtime OFF · **0** appel ; suite = Auth live preflight.
- **P1 budget** : hard **274** ; committed **247** ; available **27** ; image shortfall **0** ; vidéo Hailuo shortfall **9** (réserve 36).
- **Prochaine porte majeure** : Auth **`11A-PAID-OPENAI-IMAGE-SMOKE-ONCE`** — 1 call/job/output · réserve ≤2¢ ; pas MV-002 · pas Registry Motion.
- Budget : hard **274** / committed **112** / available **162** (`87_`).
- MT-005 remote : **APPLIED** (`82_`). Privacy : **ACCEPTED_LIMITED** (`81_`).
- Cible restore `qmsh…qlnq` : **supprimée** (`80_`).

## P2 — durcissement

- **VHS-201** 🟡 Matrice E2E multi-formats/plateformes. *(Phase 8–9 : harnais Playwright `/director` fake livré et validé ×2 cycles ; multi-formats restent à étendre.)*
- **VHS-202** Chaos tests providers et workers.
- **VHS-203** Dashboard coût, fiabilité et fallbacks.
- **VHS-204** Outils de support : replay sûr et inspection de manifest.
- **VHS-205** Baseline performance, SLO et alertes.
- **VHS-206** Rétention, export utilisateur et purge automatisée.

## P3 — après V2

- **VHS-301** Poids du Router proposés par données historiques.
- **VHS-302** Collaboration et rôles d'équipe avancés.
- **VHS-303** Publication sociale assistée.
- **VHS-304** Bibliothèque de styles et tendances gouvernées.

## Definition of Ready

Dépendances identifiées, maquette/contrat disponible, risque et données classifiés, métrique de succès définie, stratégie de test et rollback compris.
