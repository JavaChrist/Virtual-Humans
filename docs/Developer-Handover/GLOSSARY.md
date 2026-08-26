# Glossaire normatif

**Living handover** — document vivant `CURRENT_STATE_AND_RESUME.md` : état réel, preuves vs préparations, prochaine porte et restart de chat. Les rapports numérotés restent des snapshots immuables. Autorité : code + état vérifié > living handover > README > rapports.
**AI Video Director** — nom de l'expérience `/director` et du workflow applicatif ; ce n'est pas un neuvième Directeur métier.
**Artifact** — sortie immuable, versionnée et persistable d'une étape.
**Art Director** — produit la mise en scène et `VisualDirection`.
**Capability Registry** — catalogue versionné des possibilités, limites, prix et disponibilité des modèles.
**Character** — personnage abstrait fourni par le Runtime SDK ; Tom et Mei ne sont que des instances.
**Creative Concept** — grande idée, approche narrative et arc émotionnel.
**Creative Director** — transforme le plan marketing en `CreativeConcept`.
**Director** — décideur métier pur ; il ne produit aucun média et n'appelle pas un autre Director.
**Dry-run** — validation complète sans appel externe payant.
**VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION** — exception temporaire bornée (env homonyme, OFF par défaut) autorisant uniquement `openai` / `gpt-image-1` / `image.text_to_image` / projet+scène smoke 11A sur le chemin Production Director ; n’équivaut pas à `providerMode=real` ; n’active pas vidéo/voice/Motion ; voir `102_`.
**Phase 11A OpenAI image allowlist** — câblage Production (`WIRED_DISABLED`) pour 1 still scene-2 ; estimate 1¢ / réserve max 2¢ ; QC technique + Human Review obligatoires avant activation ; smoke 11A **HUMAN_REJECTED** (`110_`) sans régénération.
**Phase 11A composition fingerprint** — hash fonctionnel `phase11ARuntimeCompositionFingerprint()` (ex. `c532c400334f5b22`) prouvant routing single-step + Storage ingest + sanitize ; un commit docs-only ne suffit pas (`106_`).
**Phase 11A private image ingest** — path historique `{ws}/{project}/media/image/{assetId}.png` dans `director-final-assets` ; rôles nouveaux `…/media/image/provider|composed/{assetId}.png` (`111_`) ; asset `active=false` ; base64 jamais dans `production_runs.state`.
**ImageTextOverlaySpec** — contrat Zod strict des chaînes marketing (title/subtitle/CTA/legal + typo) composées en code, jamais peintes par le provider image (`111_`).
**Provider text policy no_text** — le prompt OpenAI Image v2 interdit lettres/mots/chiffres/UI textuelle ; overlay déterministe `WIRED_DISABLED` ; execution `118_` ; composed HR REJECT `119_` ; glyphes fix local `120_`.
**Phase 11A PNG filter decoder** — `decodeRgbPng` interne (zlib Node, pas `sharp`) : filtres 0–4 (`116_`). Asset provider réel : filtres **1–4** (`117_`). Composed `6a2beca9…` HUMAN_REJECTED pour glyphes bitmap (`119_`).
**human.corrupted_overlay_glyphs** — motif Human Review : titre/CTA illisibles car glyphes corrompus du composeur bitmap ; le fond provider peut rester exploitable (`119_`).
**vhs-overlay-latin-bitmap-shapes-v1** — atlas 8×8 local (ASCII + FR + U+2019) remplaçant le hash LCG du composeur 1.0.0 ; lookup fail-closed ; glyphes 1.1.0 PASS, layout HUMAN_REJECTED (`120_`–`123_`).
**vhs-overlay-latin-vector-v1** — police vectorielle géométrique originale (`original-work-in-repo`) du composeur `phase-11a-vector-compositor-1.2.0` ; layout `phase-11a-overlay-layout-1.2.0` ; fail-closed ; pas de fonte système (`124_`).
**ACCEPT_PREFLIGHT_VISUAL** — jugement visuel humain du preflight 1.2.0 autorisant l’écriture d’un enfant privé ; **≠** `APPROVE` dans `human_review_decisions` (`125_`/`126_`/`127_`).
**human.professional_overlay_visual_approved** — motif HR 1.2.0 : rendu professionnel validé (titre/CTA/accents/hiérarchie/contraste) ; asset `approved` mais `active=false` (`127_`).
**PHASE_11A_CLOSED** — clôture formelle 11A (`128_`) : `PASS_WITH_NOTES` · ≠ enablement Paid Media.
**ExistingMediaAssetReference** — contrat versionné inter-run (`existing-media-asset-reference-1.0.0`) : asset approuvé privé référencé explicitement (checksum/MIME/dims/HR) sans URL ni base64 ; `active=false` autorisé ; résolution Storage call-time seulement (`129_`).
**existing_asset** — `GenerationInputRef.kind` pour une source hors du même run (≠ `step_output`).
**VHS11B_FAL_I2V_DIRECTOR_EXCEPTION** — exception temporaire bornée (env homonyme, OFF, expire 2026-09-30) autorisant uniquement fal / Kling v2 Master I2V / `video.image_to_video` / projet+scène 11A ; n’active pas T2V/Motion/voice ; n’est pas `providerMode=real`.
**Phase 11B I2V allowlist** — câblage Production (`WIRED_DISABLED`) still approuvé inactif → vidéo 5s ; estimate 140¢ / réserve 168¢ / shortfall 143¢ vs 25¢ ; QC visuel `unavailable_humanOnly` ; HR obligatoire.
**I2V_PRODUCTION_PATH_WIRED_DISABLED_READY_FOR_LIVE_PREFLIGHT** — verdict `129_` : chemin I2V câblé et prouvé en fakes ; 0 fal.
**I2V_LIVE_PREFLIGHT_NO_PROVIDER_READY_FOR_PAID_AUTH** — verdict `130_` : SHA `57de914` déployé · dry-run `insufficient_funds` · 0 fal.
**I2V_BUDGET_HARD_LIMIT_437_APPLIED_PAID_EXECUTION_STILL_LOCKED** — verdict `131_` : hard **437¢** · committed 249 · reserved 0 · available 188 · 0 réserve I2V · 0 fal · smoke toujours interdit sans Auth distincte.
**I2V_PAID_SMOKE_FINAL_PREFLIGHT_READY_FOR_SINGLE_PAID_AUTH** — verdict `132_` : budget théoriquement suffisant · 0 réserve · 0 fal · `EXECUTION_AUTHORIZED=false` · prochaine Auth = first paid single execution.
**I2V_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING** — verdict `133_` : 1 fal · 1 MP4 privé inactif · QC humanOnly · HR pending · 0 décision · Auth consommée · 0 second submit.
**I2V_FIRST_PAID_VIDEO_HUMAN_APPROVED_PRIVATE_INACTIVE** — verdict `134_` : 1 HR APPROVE · MP4 `approved` · `active=false` · 0 fal · 0 Storage · 0 downstream · Auth consommée.
**PHASE_11B_CLOSED_PASS_WITH_NOTES** — verdict `135_` : chaîne I2V réelle clôturée · vidéo privée inactive · attempt `started` P1 · resubmit impossible · 0 write.
**I2V_ATTEMPT_TERMINAL_STATE_HARDENED_READY_FOR_LIVE_RECONCILIATION_PREFLIGHT** — verdict `136_` : helper + script empêchent la récidive · attempt live toujours `started` · 0 write Production.
**I2V_ATTEMPT_LIVE_RECONCILIATION_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH** — verdict `137_` : hardening déployé · CAS unique préparé · `completed_at` ingest · attempt live toujours `started` · 0 write.
**I2V_ATTEMPT_LIVE_RECONCILED_TERMINAL_NO_RESUBMIT** — verdict `138_` : 1 CAS · attempt `completed` · `completed_at` ingest · `retryable=false` · 0 resubmit.
**Artifact bundle** — ensemble cohérent résolu explicitement (GenerationPlan, run, job, source, output, Quality Report, Production Result, Human Review, delivery). Ce n’est pas l’union des pointeurs actifs par type (`139_`).
**Résolution explicite d’artifacts** — stratégie C : résoudre par run / plan / output, indépendamment des pointeurs globaux `active_artifact_revisions` (`139_`).
**Naive active pointer set** — ensemble formé en prenant un actif par `artifact_type` ; peut mélanger des pipelines distincts (ex. GP 11A + QR/PR I2V).
**mergeExportAuthorized** — autorisation explicite de merge/export, distincte de `delivery.status=merge_ready` et de Human Review APPROVE. Absent = false (fail-closed).
**ARTIFACT_POINTER_COHERENCE_HARDENED_NO_LIVE_MUTATION_REQUIRED** — verdict `139_` : contrat + guards durcis · 0 mutation de pointeur · prochaine porte Voice/TTS preflight.
**ExistingVoiceReference** — contrat générique de voix Production (`140_`) : provider, modèle, langue, consent, id redacted ; jamais de clé API ni fallback env.
**VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION** — exception temporaire bornée (OFF) pour ElevenLabs / `eleven_multilingual_v2` / `audio.voice` / projet+scène I2V ; n’active pas lipsync/merge ; n’est pas `providerMode=real`.
**VOICE_TTS_PATH_WIRED_DISABLED_BLOCKED_VOICE_OR_CONSENT** — verdict `140_` : chemin Voice/TTS câblé et désactivé · 0 ElevenLabs · narrateur non lié · MV-001 ≠ consent Voice.
**voice secret locator** — référence de configuration (`env:ELEVENLABS_VOICE_ID`) résolue call-time ; jamais le voiceId brut (`141_`).
**voice fingerprint** — hash sha256 redacted de la valeur configurée ; préfixe public seulement (`141_`).
**BLOCKED_VOICE_NARRATOR_BINDING_CONFIG_UNAVAILABLE** — verdict `141_` : voix configurée collisionne avec Mei · binding non persisté · runtime OFF.
**AUTH_11C_VOICE_NARRATOR_IDENTITY_DECISION** — porte `141_` proposée puis absorbée par le catalogue `142_`.
**voice identity catalog** — quatre identités distinctes `character_mei` / `character_tom` / `narrator_female` / `narrator_male` (`142_`).
**VOICE_IDENTITY_CATALOG_DESIGN_READY_BLOCKED_MISSING_SECURE_CONFIG** — verdict `142_` : architecture prête · locators narrateur absents · migration locale non appliquée.
**AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT** — porte `143_` : preflight distant lecture seule.
**VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT_READY_FOR_APPLY_AUTH** — verdict `143_` : drift 30/31 admissible · 0 collision · 0 write.
**AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE** — porte `144_` : une migration structurelle Production.
**VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLIED_EMPTY_RUNTIME_OFF** — verdict `144_` : 31/31 · 3 tables vides · runtime OFF.
**AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_PREFLIGHT** — porte `145_` : audit ACL + migration locale grants.
**VOICE_IDENTITY_CATALOG_GRANTS_HARDENING_READY_FOR_REMOTE_APPLY_PREFLIGHT** — verdict `145_` : overlay DEFAULT PRIVILEGES · local 32e · 0 apply.
**AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT** — porte `146_` : revérifier le hardening sans l’appliquer.
**VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH** — verdict `146_` : drift 31/32 · SQL inchangé · 0 apply.
**AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE** — porte `147_` : une migration ACL Production, sans seed.
**VOICE_IDENTITY_CATALOG_GRANTS_HARDENED_REMOTE_TABLES_EMPTY_RUNTIME_OFF** — verdict `147_` : 32/32 · ACL durcies · tables vides · runtime OFF.
**AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT** — porte `148_` : préparer seed/consentements sans write.
**VOICE_IDENTITY_CATALOG_SEED_PREFLIGHT_READY_FOR_SINGLE_TRANSACTION_AUTH** — verdict `148_` : plan 4+4 déterministe · 0 persist · runtime OFF.
**AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION** — porte `149_` : 4 identities + 4 consentements · 0 binding · execution=false.
**VOICE_IDENTITY_CATALOG_SEEDED_CONSENTED_RUNTIME_OFF_NO_BINDING** — verdict `149_` : catalog 4/4/0 · runtime OFF · 0 ElevenLabs.
**AUTH_11C_I2V_NARRATOR_BINDING_PREFLIGHT** — porte `150_` : préparer le choix `narrator_female` sans write.
**I2V_NARRATOR_FEMALE_BINDING_PREFLIGHT_READY_FOR_SINGLE_WRITE_AUTH** — verdict `150_` : plan déterministe · 0 persist · runtime OFF.
**AUTH_11C_I2V_NARRATOR_BINDING_SINGLE_WRITE** — porte `151_` : un binding projet female · execution=false · 0 ElevenLabs.
**I2V_NARRATOR_FEMALE_BOUND_PRIVATE_RUNTIME_OFF** — verdict `151_` : binding `e3a1cc87…` persisté · 4/4/1 · runtime OFF.
**AUTH_11C_VOICE_TTS_LIVE_PREFLIGHT_NO_PROVIDER** — porte `152_` : dry-run TTS arrêté avant média et ElevenLabs.
**VOICE_TTS_LIVE_PREFLIGHT_READY_FOR_FINAL_PAID_AUTH** — verdict `152_` : wiring/binding/pricing/budget prêts · cap 2¢ · 0 ElevenLabs.
**AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION** — porte `153_` : 1 appel ElevenLabs · 1 run/job/attempt/output privé · flags `finally`.
**VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING** — verdict `153_` : 1 MP3 privé inactif · QC humanOnly · HR none · Auth consommée · 0 second submit.
**AUTH_11C_VOICE_TTS_PRIVATE_PREVIEW_AND_HUMAN_DECISION** — porte `155_` : 1 lecture privée locale · 1 décision APPROVE · 0 activation · 0 lipsync · 0 second submit.
**VOICE_TTS_FIRST_PAID_AUDIO_HUMAN_APPROVED_PRIVATE_INACTIVE** — verdict `155_` : audio `bc36bba7…` approved · active=false · HR `068a2b25…` · pointeurs I2V figés · Auth consommée.
**AUTH_11C_CLOSE_AND_NEXT_MEDIA_GATE_AUDIT** — prochaine porte : audit de clôture Voice first paid · 0 provider · 0 activation automatique.
**human.i2v_visual_approved** — issue code HR I2V : vidéo privée visionnée et approuvée ; n’autorise ni activation ni downstream (`134_`).
**human.overlay_typography_layout_not_production_ready** — motif HR 1.1.0 : glyphes lisibles mais typo/layout insuffisants (pixelisation, bandeaux, orphelin `Studio`) (`123_`).
**ImageVisualVariant** — contrat Zod strict du visuel provider (sujet/action/environnement/espace négatif/no-text) ; aucune chaîne overlay (`113_`).
**Overlay leak detector** — comparaison normalisée overlay ↔ variant/prompt ; span significatif ≥ 16 ; mot générique isolé non bloqué (`113_`).
**Fallback** — alternative prévue par le Router et déclenchée par le Production Director après un échec admissible.
**Generation Engine** — exécuteur technique normalisant les adapters providers.
**Generation Plan** — DAG ordonné des étapes, modèles, coûts, fallbacks et explications.
**Idempotence** — propriété garantissant qu'une commande répétée ne duplique ni production ni dépense.
**Marketing Director** — produit le message stratégique `MarketingPlan`.
**Model Router** — système expert qui choisit une stratégie de production sous contraintes.
**Production Director** — unique orchestrateur d'exécution, qualité, reprise, merge et export.
**Prompt Composer** — rend des blocs structurés dans une syntaxe adaptée à un profil/modèle.
**Prompt Director** — produit les `ScenePackage`, sans décider du modèle.
**Provider** — service externe exécutant image, vidéo, voix, lipsync ou autre média.
**Revision** — nouvelle version append-only d'un artifact ; une révision active est explicitement désignée.
**Routing Rationale** — explication structurée et traçable d'une décision du Router.
**Scene Package** — représentation complète d'une scène : intention, sujet, action, environnement, caméra, lumière, références, contraintes et variantes de prompt.
**Script Writer** — produit `VideoScript`, propriétaire du texte prononcé/affiché.
**Storyboard Director** — découpe en scènes et produit `StoryboardProject`.
**Storyboard Project** — contrat de tournage approuvé et immuable pour une révision.
**Video Project Brief** — intention utilisateur normalisée et validée.
**Visual Direction** — style global et décisions visuelles par scène.
**Motion / Performance Transfer** — capability `video.motion_transfer` : transfert de mouvement depuis une vidéo source vers un personnage (identité/tenue), distinct de I2V/T2V ; architecture `59_` ; MT-001…014 ; adapter fal Kling MC validé benchmark-only (`99_`) ; Registry Production `enabled=false` ; runtime Motion UNAVAILABLE hors Auth.
**MotionTransferModelCapabilities** — bloc Registry versionné (`schemaVersion` 1.0.0) décrivant support source video / identité / tenue / pose / fidélité / limites ; niveaux `SUPPORTED|PARTIAL|UNVERIFIED|NOT_SUPPORTED`.
**routeMotionTransfer** — décision Router pure MT-003 ; `maximumFallbacksPerStep=0` ; échec stable `motion_capability_unavailable`.
**runMotionTransferGenerationDryRun** — préparation Engine MT-004 (validate/resolve/route/plan) ; toujours `providerCalled=false` ; pas de job/ledger/storage.
**MotionAssetRole** — rôles Storage/provenance MT-005 (`motion_source_video`, identity/outfit refs, provider output, qc evidence, approved output) ; pas de tables `motion_*`.
**Motion persistence** — mapping générique V2 (runs/jobs/attempts/artifacts/assets) + path privé sous `director-final-assets` ; migration locale human_review retry intents.
**MotionTransferProviderPort** — port provider-agnostic MT-006 (`estimate`/`submit`/`poll`/`cancel?`) ; fake TEST_ONLY ; adapter fal = MT-007B (disabled).
**fal Kling motion-control** — endpoint MT-007A/B (`fal-ai/kling-video/v3/pro/motion-control`) : `video_url` + `image_url` first-class ; **pas** I2V ; adapter code MT-007B ; enabled Production = false ; privacy gate blocked.
**Motion Transfer privacy gate** — contrat fail-closed MT-007B (rétention/CDN/biométrie/droits/geo) ; default blocked ; bloque tout submit réel.
**Motion Transfer worker orchestration** — branche MT-008 du worker `run-once` (`motion_transfer`) : claim→submit once→poll→ledger→qc_pending ; `submission_unknown` = pas de resubmit auto.
**submission_unknown** — état typé MT-008 : provider peut avoir accepté mais `providerJobId` non persisté ; réconciliation humaine ; interdit de resubmit automatique.
**MotionReferenceSpec** — contrat opaque fourni par un projet appelant (ex. Tai-Chi MV-001) : phases, checkpoints, contraintes ; VHS n’en interprète pas le métier ; schema `1.0.0`.
**MotionMediaReference** — référence média motion basée sur `AssetInputRef` + rôle (source_video/identity/outfit/…).
**Motion QC** — contrôles technique / identité / tenue / fidélité motion / intégrité / temporalité / caméra + checkpoints opaques + revue humaine ; contrat `MotionQcResult` v1 ; orchestrateur MT-009 (`69_`) ; port de mesure provider-agnostic (fake TEST_ONLY) ; mapping artifact `quality_report`.
**MotionQcMeasurementPort** — port de mesures QC Motion (similarité, timing, checkpoints, relations corporelles, etc.) ; aucun moteur OpenPose/DWPose dans VHS MT-009.
**motion_qc_evidence** — descriptor d’evidence privée QC Motion (asset/fingerprint, role, MIME, ranges, provenance) — jamais média inline ni URL signée.
**Motion human review** — validation humaine append-only (`human_review_decisions`) pour Motion Transfer ; intents `approved|rejected|retry_*|request_new_reference` ; API `/motion/review` (`70_`) ; retry = intention seulement (pas de job).
**reviewRequestId** — clé d’idempotence client pour une décision de revue (double-clic → `existing` ; payload différent → conflit).
**Motion observability catalog** — catalogue versionné `mt011-events-1.0.0` (`motion.route|plan|job|submit|poll|output|qc|review|ledger|security.*`) ; façade `emitMotionObservabilityEvent`.
**Motion sanitizer** — sanitiseur central `sanitizeMotionValue` / `assertMotionSurfaceRedacted` (MT-011) ; masque secrets, URLs signées, data URLs, prompts, payloads bruts.
**Privacy Decision Contract** — décisions obligatoires avant benchmark réel (`providerRetentionAccepted`, CDN, biométrie, droits commerciaux, geo) ; default blocked ; expiration honorée.
**Motion Transfer E2E harness** — harness synthétique MT-012 (`runMotionTransferE2E`) composant Registry→Review sans provider réel ni écriture Production ; dry-run public `runMotionTransferPublicDryRun`.
**MOTION_SYNTHETIC_E2E_READY** — statut MT-012 : contrats/transitions prouvés en fake ; runtime Production toujours `UNAVAILABLE` ; benchmark payant non autorisé.
**MV-001** — premier benchmark Motion Transfer réel (coaching opaque) ; 8s ; submit=1 ; coût 135¢ ; HR APPROVE → `PASS_WITH_HUMAN_APPROVAL` (`97_`) ; output privé `active=false` ; n’établit pas SUPPORTED global ni beta.
**PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY** — verdict MT-014 : adapter+pipeline prouvés sur un sample ; Registry/Production non activés (`99_`).
**resumeInput** — `MotionTransferInput` redacté durable (MT-013P) pour cold-start poll/drain/QC ; jamais suffisant pour un second submit.
**MV-002** — second benchmark designé (MT-015A) : même mouvement 8s, **nouvelle identité virtuelle** ; Privacy/Media/Budget **PENDING** ; pas de réutilisation auto des assets ni du Privacy Pack MV-001 (`100_`).
**MV002_DESIGN_READY** — design/readiness documentaire complète ; exécution non autorisée.
**READY_FOR_HUMAN_GOVERNANCE_DECISIONS** — verdict MT-013A : pack privacy + gates A–J prêts pour décisions humaines ; aucun provider call.
**RESTORE_DRILL** — preuve de restauration vers cible isolée ≠ Production ; verdicts `PASS` \| `BLOCKED_TARGET_REQUIRED` \| `BLOCKED_CREDENTIALS_REQUIRED` \| `BLOCKED_BACKUP_UNAVAILABLE` \| `FAIL` (`74_`).
**PRIVACY_DUE_DILIGENCE** — revue officielle des 5 décisions Motion ; verdicts `READY_FOR_HUMAN_DECISION` \| `MORE_INFORMATION_REQUIRED` \| `BLOCKED` \| `ACCEPTED_LIMITED_MV001` (`74_` / `81_`).
**Motion Director** — Directeur éventuel **post-V1** ; traduit des contraintes, n’invente pas le mouvement, n’appelle pas de provider.

## Termes proscrits

`Quality Director` comme module V2, `Video Director` comme Directeur métier séparé, appels directs entre Directeurs, provider par défaut caché, personnages codés en dur, retry infini, et **fallback silencieux I2V/T2V** pour un besoin `video.motion_transfer`.

