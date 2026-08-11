# Glossaire normatif

**AI Video Director** — nom de l'expérience `/director` et du workflow applicatif ; ce n'est pas un neuvième Directeur métier.
**Artifact** — sortie immuable, versionnée et persistable d'une étape.
**Art Director** — produit la mise en scène et `VisualDirection`.
**Capability Registry** — catalogue versionné des possibilités, limites, prix et disponibilité des modèles.
**Character** — personnage abstrait fourni par le Runtime SDK ; Tom et Mei ne sont que des instances.
**Creative Concept** — grande idée, approche narrative et arc émotionnel.
**Creative Director** — transforme le plan marketing en `CreativeConcept`.
**Director** — décideur métier pur ; il ne produit aucun média et n'appelle pas un autre Director.
**Dry-run** — validation complète sans appel externe payant.
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
**Motion / Performance Transfer** — capability `video.motion_transfer` : transfert de mouvement depuis une vidéo source vers un personnage (identité/tenue), distinct de I2V/T2V ; architecture `59_` ; MT-001…005 (`60_`…`64_`) ; runtime non branché ; provider non sélectionné.
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
**MV-001** — premier benchmark Motion Transfer réel (coaching/Tai-Chi opaque) ; durée min fal 3 s ; 1 call max ; hors Git pour médias ; exécution = MT-013B après Auth.
**READY_FOR_HUMAN_GOVERNANCE_DECISIONS** — verdict MT-013A : pack privacy + gates A–J prêts pour décisions humaines ; aucun provider call.
**RESTORE_DRILL** — preuve de restauration vers cible isolée ≠ Production ; verdicts `PASS` \| `BLOCKED_TARGET_REQUIRED` \| `BLOCKED_CREDENTIALS_REQUIRED` \| `BLOCKED_BACKUP_UNAVAILABLE` \| `FAIL` (`74_`).
**PRIVACY_DUE_DILIGENCE** — revue officielle des 5 décisions Motion ; verdicts `READY_FOR_HUMAN_DECISION` \| `MORE_INFORMATION_REQUIRED` \| `BLOCKED` \| `ACCEPTED_LIMITED_MV001` (`74_` / `81_`).
**Motion Director** — Directeur éventuel **post-V1** ; traduit des contraintes, n’invente pas le mouvement, n’appelle pas de provider.

## Termes proscrits

`Quality Director` comme module V2, `Video Director` comme Directeur métier séparé, appels directs entre Directeurs, provider par défaut caché, personnages codés en dur, retry infini, et **fallback silencieux I2V/T2V** pour un besoin `video.motion_transfer`.

