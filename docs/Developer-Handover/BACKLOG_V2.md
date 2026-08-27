# Backlog V2

**Autorité ops courante** (14 août 2026) : [`CURRENT_STATE_AND_RESUME.md`](./CURRENT_STATE_AND_RESUME.md) puis ce fichier + `00_README.md` + derniers rapports.
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
             Phase 11A-LIVE-PREFLIGHT (`107_`) · source **7a67c77** · FP c532c400334f5b22
             · READY_FOR_11A_PAID_AUTH · runtime OFF
             Phase 11A-PAID-SMOKE (`108_`) · Auth provider CONSUMED · image privée needs_review
             Phase 11A-LEDGER-RECONCILE (`109_`) · **PASS_LEDGER_RECONCILED_HUMAN_REVIEW_PENDING**
             · reserve 0 · commit smoke 1¢ provisional · HR PENDING
             Phase 11A-HR-REJECT (`110_`) · **PASS_TECHNICAL_ASSET_HUMAN_REJECTED**
             · décision `rejected` ×1 · asset non actif · 0 retry
             Phase 11A-HARDEN (`111_`) · **READY_FOR_TEXT_FREE_IMAGE_RETRY_PREFLIGHT**
             · provider no-text · overlay déterministe WIRED_DISABLED · 0 OpenAI
             Phase 11A-TEXT-FREE-RETRY-PREFLIGHT (`112_`) · **BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT**
             · source 20e8783 · dry-run HTTP PASS · copy encore dans le variant image
             Phase 11A-STRIP-OVERLAY-COPY (`113_`) · screenText/CTA hors variant
             Phase 11A-TEXT-FREE-RETRY-LIVE-PREFLIGHT (`114_`)
             · **READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH** · source e4c3de3
             · 0 OpenAI · flags refermés
             Phase 11A-TEXT-FREE-PAID (`115_`)
             · **COMPOSITOR_FAILED_NO_RETRY** · 1 submit · asset `7832765d` · 0 composed
             Phase 11A-PNG-FILTER-DECODER (`116_`)
             · **READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT**
             · decode 0–4 · 0 provider · 0 lecture Production · 0 composed
             Phase 11A-EXISTING-PROVIDER-COMPOSE-PREFLIGHT (`117_`)
             · **READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION**
             · 1 read · filtres 1–4 · compose mémoire PASS · 0 write
             Phase 11A-EXISTING-PROVIDER-COMPOSE-EXECUTION (`118_`)
             · **COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING**
             · composed `6a2beca9` · QC PASS · HR seedée · 0 OpenAI
             Phase 11A-COMPOSED-HR-REJECT (`119_`)
             · **PASS_PROVIDER_ASSET_COMPOSED_ASSET_HUMAN_REJECTED**
             · glyphes corrompus · parent réutilisable · 0 OpenAI
             Phase 11A-BITMAP-GLYPH-DIAG (`120_`)
             · **BITMAP_GLYPH_RENDERING_FIXED_READY_FOR_RECOMPOSITION_PREFLIGHT**
             Phase 11A-CORRECTED-RECOMPOSITION-PREFLIGHT (`121_`)
             · **READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION**
             · runtime 245bea2 · checksum b284e877… · 0 write
             Phase 11A-CORRECTED-RECOMPOSITION-EXECUTION (`122_`)
             · **CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING**
             · enfant `4429654f` · composeur 1.1.0 · HR seedée · 0 OpenAI
             Phase 11A-CORRECTED-COMPOSED-HR-REJECT (`123_`)
             · **PASS_PROVIDER_AND_GLYPHS_TECHNICAL_COMPOSED_ASSET_HUMAN_REJECTED**
             · glyphes PASS · layout FAIL · parent réutilisable · 0 OpenAI
             Phase 11A-OVERLAY-TYPO-LAYOUT (`124_`)
             · **OVERLAY_TYPOGRAPHY_LAYOUT_IMPROVED_READY_FOR_REAL_PARENT_PREFLIGHT**
             · composeur 1.2.0 local · fixtures synthétiques · 0 OpenAI
             Phase 11A-PROFESSIONAL-PARENT-PREFLIGHT (`125_`)
             · **PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_READY_FOR_HUMAN_VISUAL_DECISION**
             · 1 lecture parent · compose 1.2.0 mémoire · 0 write · 0 OpenAI
             Phase 11A-PROFESSIONAL-RECOMPOSITION-EXECUTION (`126_`)
             · **PROFESSIONAL_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING**
             · enfant `49284892` · HR seedée · 0 décision · 0 OpenAI
             Phase 11A-PROFESSIONAL-COMPOSED-HR-APPROVE (`127_`)
             · **PHASE_11A_PASS_WITH_HUMAN_APPROVED_PROFESSIONAL_IMAGE**
             · enfant `49284892` · `approved` · `active=false` · 0 OpenAI
             Phase 11A-CLOSE-ROADMAP (`128_`)
             · **PHASE_11A_CLOSED_NEXT_MEDIA_GATE_DEFINED**
             · PHASE_11A = PASS_WITH_NOTES · next = I2V wiring
             Phase 11B-I2V-WIRING (`129_`)
             · **I2V_PRODUCTION_PATH_WIRED_DISABLED_READY_FOR_LIVE_PREFLIGHT**
             · Kling allowlist OFF · 0 fal · existing_asset
             Phase 11B-I2V-LIVE-PREFLIGHT (`130_`)
             · **I2V_LIVE_PREFLIGHT_NO_PROVIDER_READY_FOR_PAID_AUTH**
             · `57de914` déployé · 0 fal
             Phase 11B-I2V-HARD-437 (`131_`)
             · **I2V_BUDGET_HARD_LIMIT_437_APPLIED_PAID_EXECUTION_STILL_LOCKED**
             · hard 437 · available 188 · 0 réserve · 0 fal
             Phase 11B-I2V-PAID-PREFLIGHT (`132_`)
             · **I2V_PAID_SMOKE_FINAL_PREFLIGHT_READY_FOR_SINGLE_PAID_AUTH**
             · 0 réserve · 0 fal · EXECUTION_AUTHORIZED=false
             Phase 11B-I2V-FIRST-PAID (`133_`)
             · **I2V_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING**
             · 1 fal · 1 MP4 privé · HR pending · flags OFF
             Phase 11B-I2V-HR-APPROVE (`134_`)
             · **I2V_FIRST_PAID_VIDEO_HUMAN_APPROVED_PRIVATE_INACTIVE**
             · 1 APPROVE · MP4 approved inactif · 0 fal · flags OFF
             Phase 11B-CLOSE (`135_`)
             · **PHASE_11B_CLOSED_PASS_WITH_NOTES**
             · attempt `started` P1 · 0 resubmit · 0 write
             Phase 11B-ATTEMPT-HARDENING (`136_`)
             · **I2V_ATTEMPT_TERMINAL_STATE_HARDENED_READY_FOR_LIVE_RECONCILIATION_PREFLIGHT**
             · code hardené · live `started` inchangé
             Phase 11B-ATTEMPT-RECON-PREFLIGHT (`137_`)
             · **I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH**
             · hardening déployé · CAS prêt · 0 write
             Phase 11B-ATTEMPT-RECON (`138_`)
             · **I2V_ATTEMPT_LIVE_RECONCILED_TERMINAL_NO_RESUBMIT**
             · 1 CAS · attempt `completed` · 0 resubmit
             Phase 11B-POINTER-COHERENCE (`139_`)
             · **ARTIFACT_POINTER_COHERENCE_HARDENED_NO_LIVE_MUTATION_REQUIRED**
             · stratégie C · 0 mutation pointeur · merge_ready insuffisant
             Phase 11C-VOICE-WIRING (`140_`)
             · **VOICE_TTS_PATH_WIRED_DISABLED_BLOCKED_VOICE_OR_CONSENT**
             · path disabled · 0 ElevenLabs · narrateur non lié
             Phase 11C-VOICE-BINDING (`141_`)
             · **BLOCKED_VOICE_NARRATOR_BINDING_CONFIG_UNAVAILABLE**
             · config = Mei · 0 persist · runtime OFF
             Phase 11C-VOICE-CATALOG (`142_`)
             · **VOICE_IDENTITY_CATALOG_DESIGN_READY_BLOCKED_MISSING_SECURE_CONFIG**
             · 4 identités · migration locale · env narrateur absente à l’époque
             Phase 11C-VOICE-PREFLIGHT (`143_`)
             · **VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT_READY_FOR_APPLY_AUTH**
             Phase 11C-VOICE-APPLY (`144_`)
             · **VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLIED_EMPTY_RUNTIME_OFF**
             · 31/31 · 3 tables vides · 0 seed
             Phase 11C-VOICE-GRANTS (`145_`)
             · **VOICE_IDENTITY_CATALOG_GRANTS_HARDENING_READY_FOR_REMOTE_APPLY_PREFLIGHT**
             · remote 31 / local 32 · overlay service_role · 0 apply
             Phase 11C-VOICE-GRANTS-PREFLIGHT (`146_`)
             · **VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH**
             · drift 31/32 · SQL inchangé · 0 apply
             Phase 11C-VOICE-GRANTS-APPLY (`147_`)
             · **VOICE_IDENTITY_CATALOG_GRANTS_HARDENED_REMOTE_TABLES_EMPTY_RUNTIME_OFF**
             · 32/32 · ACL durcies · 0 seed
             Phase 11C-VOICE-SEED-PREFLIGHT (`148_`)
             · **VOICE_IDENTITY_CATALOG_SEED_PREFLIGHT_READY_FOR_SINGLE_TRANSACTION_AUTH**
             · plan 4+4 · 0 persist · 0 binding
             Phase 11C-VOICE-SEED (`149_`)
             · **VOICE_IDENTITY_CATALOG_SEEDED_CONSENTED_RUNTIME_OFF_NO_BINDING**
             · 4/4/0 · execution=false · 0 ElevenLabs
             Phase 11C-I2V-NARRATOR-PREFLIGHT (`150_`)
             · **I2V_NARRATOR_FEMALE_BINDING_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH**
             · choix female · 0 binding live
             Phase 11C-I2V-NARRATOR-WRITE (`151_`)
             · **I2V_NARRATOR_FEMALE_BOUND_PRIVATE_RUNTIME_OFF**
             · 1 INSERT · 4/4/1 · execution=false
             Phase 11C-TTS-LIVE-PREFLIGHT (`152_`)
             · **VOICE_TTS_LIVE_PREFLIGHT_READY_FOR_FINAL_PAID_AUTH**
             · 0 write · cap 2¢ · dry-run OFF
             Phase 11C-TTS-FIRST-PAID (`153_`)
             · **VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING**
             · 1 ElevenLabs · 1 MP3 privé · HR none · flags OFF
             Phase 11C-TTS-HR-APPROVE (`155_`)
             · **VOICE_TTS_FIRST_PAID_AUDIO_HUMAN_APPROVED_PRIVATE_INACTIVE**
             · 1 APPROVE inactif · 0 ElevenLabs · pointeurs I2V figés
             Phase 11C-CLOSE (`156_`)
             · **PHASE_11C_CLOSED_PASS_WITH_NOTES**
             · 0 Production · assets = preuves privées · next = RideCloud preflight
             RideCloud input preflight (`157_`)
             · **RIDECLOUD_INPUT_COLLECTION_BLOCKED_INPUTS_REQUIRED**
             RideCloud supply pack (`158_`)
             · **RIDECLOUD_INPUT_COLLECTION_READY**
             · 10 captures + logo + banner · musique waived · 0 projet Production
             RideCloud HD variants addendum (`159_`)
             · **RIDECLOUD_PACK_HIGH_RES_VARIANTS_ADDED**
             · 5 variantes officielles · 12 refs `158_` inchangées
             RideCloud first-ad storyboard (`160_`)
             · **RIDECLOUD_FIRST_AD_STORYBOARD_READY**
             · 26 s · 6 plans · 0 projet Production
             RideCloud storyboard VO harden (`161_`)
             · **RIDECLOUD_FIRST_AD_STORYBOARD_AUDIO_CONTINUITY_HARDENED**
             · VO continue · CTA scindé
             RideCloud storyboard VO polish (`162_`)
             · **RIDECLOUD_FIRST_AD_STORYBOARD_VO_COPY_POLISHED**
             · s03/s04 · 144/150 wpm
             RideCloud project create preflight (`163_`)
             · **RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_READY**
             · IDs déterministes · 0 write
             RideCloud project create idempotent (`164_`)
             · **RIDECLOUD_SEPARATE_PROJECT_CREATED**
             · projet draft + brief rev.1 · replay existing
             RideCloud storyboard/pack bind preflight (`165_`)
             · **RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_READY**
             RideCloud bind kind schema preflight (`166_`)
             · **RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_READY**
             RideCloud bind kind schema remote preflight (`167_`)
             · **RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH**
             · CHECK distant 13 kinds · 0 apply
             MV001 = PASS_WITH_HUMAN_APPROVAL · Motion Registry DISABLED
             RUNTIME_MOTION = UNAVAILABLE · RUNTIME_PAID_MEDIA = OFF
Budget     : 437 / committed **391** / reserved **0** / available **46**
Runtime AI : OFF
Media jobs : 2 image + 1 I2V + 1 Voice completed · 1 MP4 + 1 MP3 approved inactifs
P0         : pas de 3e OpenAI · ne pas activer les assets · 0 second submit fal/ElevenLabs
P1         : apply CHECK bind kinds bloqué · pricing TTS non ferme
P1 fermé   : remote schema RideCloud · schema kinds RideCloud · bind preflight RideCloud · create idempotent RideCloud · create preflight RideCloud · polish VO RideCloud · durcissement VO RideCloud · storyboard RideCloud · addendum HD RideCloud · supply RideCloud · preflight RideCloud · clôture 11C · Voice HR APPROVE
Next major : AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER
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
- **Phase 11A média** 🟢 smoke réel (`108_`) · ledger 1¢ **soldé** (`109_`) · HR **REJECT** (`110_`) · overlay **WIRED_DISABLED** · strip (`113_`) · paid (`115_`) · decode PNG 0–4 (`116_`) · compose (`118_`) · composed HR REJECT (`119_`) · glyphes (`120_`) · preflight 1.1.0 (`121_`) · recomposition 1.1.0 (`122_`) · HR 1.1.0 REJECT (`123_`) **PASS_PROVIDER_AND_GLYPHS_TECHNICAL_COMPOSED_ASSET_HUMAN_REJECTED**.
- **P1 budget** : hard **437** ; committed **389** ; reserved **0** ; available **48**.
- **Phase 11C Voice binding** ✅ **BLOCKED** (`141_`) — voix configurée = identité Mei · 0 persist Production · 0 ElevenLabs · runtime OFF.
- **Phase 11C Voice catalog** ✅ **READY_BLOCKED_MISSING_SECURE_CONFIG** (`142_`) — 4 identités · migration locale.
- **Phase 11C Voice remote preflight** ✅ **READY_FOR_APPLY_AUTH** (`143_`).
- **Phase 11C Voice remote apply** ✅ **APPLIED_EMPTY_RUNTIME_OFF** (`144_`) — 31/31 · 3 tables vides · 0 seed.
- **Phase 11C Voice grant hardening preflight** ✅ **READY_FOR_REMOTE_APPLY_PREFLIGHT** (`145_`) — overlay DEFAULT PRIVILEGES · migration locale · 0 apply.
- **Phase 11C Voice grant apply preflight** ✅ **READY_FOR_APPLY_AUTH** (`146_`) — drift 31/32 · checksum inchangé · 0 apply.
- **Phase 11C Voice grant hardening apply** ✅ **GRANTS_HARDENED_REMOTE_TABLES_EMPTY_RUNTIME_OFF** (`147_`) — 32/32 · ACL durcies · 0 seed.
- **Phase 11C Voice seed/consent preflight** ✅ **READY_FOR_SINGLE_TRANSACTION_AUTH** (`148_`) — plan 4+4 · 0 persist · 0 binding.
- **Phase 11C Voice seed/consent transaction** ✅ **SEEDED_CONSENTED_RUNTIME_OFF_NO_BINDING** (`149_`) — 8 INSERT · 4/4/0 · execution=false.
- **Phase 11C I2V narrator binding preflight** ✅ **READY_FOR_SINGLE_WRITE_AUTH** (`150_`) — choix `narrator_female` · 0 persist.
- **Phase 11C I2V narrator binding write** ✅ **I2V_NARRATOR_FEMALE_BOUND_PRIVATE_RUNTIME_OFF** (`151_`) — 1 INSERT · 4/4/1 · execution=false.
- **Phase 11C Voice/TTS live preflight** ✅ **VOICE_TTS_LIVE_PREFLIGHT_READY_FOR_FINAL_PAID_AUTH** (`152_`) — 0 write · cap 2¢ · dry-run OFF.
- **Phase 11C Voice/TTS first paid** ✅ **VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING** (`153_`) — 1 ElevenLabs · 1 MP3 privé · 2¢ provisional · flags OFF.
- **Phase 11C Voice/TTS Human Review APPROVE** ✅ **VOICE_TTS_FIRST_PAID_AUDIO_HUMAN_APPROVED_PRIVATE_INACTIVE** (`155_`) — 1 APPROVE inactif · 0 ElevenLabs · pointeurs I2V figés.
- **Phase 11C close + next gate** ✅ **PHASE_11C_CLOSED_PASS_WITH_NOTES** (`156_`) — 0 Production · preuves privées inactives · 0 provider.
- **RideCloud input preflight** ✅ **RIDECLOUD_INPUT_COLLECTION_BLOCKED_INPUTS_REQUIRED** (`157_`) — audience vérifiée · pack manquant · 0 projet Production.
- **RideCloud supply pack** ✅ **RIDECLOUD_INPUT_COLLECTION_READY** (`158_`) — 10 captures + logo + banner · musique waived · refs opaques.
- **RideCloud HD variants addendum** ✅ **RIDECLOUD_PACK_HIGH_RES_VARIANTS_ADDED** (`159_`) — 4 captures `1080×2424` + banner `1794×876` · 12 refs `158_` inchangées.
- **RideCloud first-ad storyboard** ✅ **RIDECLOUD_FIRST_AD_STORYBOARD_READY** (`160_`) — 26 s · 6 plans · copy verrouillée · 0 provider.
- **RideCloud storyboard VO harden** ✅ **RIDECLOUD_FIRST_AD_STORYBOARD_AUDIO_CONTINUITY_HARDENED** (`161_`) — VO continue · CTA scindé · 0 silence.
- **RideCloud storyboard VO polish** ✅ **RIDECLOUD_FIRST_AD_STORYBOARD_VO_COPY_POLISHED** (`162_`) — s03/s04 · 144/150 wpm · 0 silence.
- **RideCloud project create preflight** ✅ **RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_READY** (`163_`) — IDs déterministes · 0 write · 0 projet créé.
- **RideCloud project create idempotent** ✅ **RIDECLOUD_SEPARATE_PROJECT_CREATED** (`164_`) — 1 RPC · draft + brief rev.1 · replay existing · 0¢.
- **RideCloud storyboard/pack bind preflight** ✅ **RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_READY** (`165_`) — kinds `storyboard_contract` + `media_input_manifest` · 0 persist · 0¢.
- **RideCloud bind kind schema preflight** ✅ **RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_READY** (`166_`) — migration locale `20260827133000` · 13 kinds + 2 · 0 apply · 0¢.
- **RideCloud bind kind schema remote preflight** ✅ **RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH** (`167_`) — distant 32 · CHECK 13 kinds · 0 apply · 0¢.
- **Prochaine porte majeure** : Auth **`AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_REMOTE_APPLY_ONCE_NO_PROVIDER`** — apply unique · 0 RPC · 0 artifact write · 0¢. Living handover : `CURRENT_STATE_AND_RESUME.md`.
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
