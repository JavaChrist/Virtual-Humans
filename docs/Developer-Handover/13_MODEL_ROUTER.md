# 13 — Model Router

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Implémentation | Pure fonction + persist `generation_plan` (VHS-123) |
| Production | **0** `generation_plan` actif |
| Dry-run 11A | plan complet → `no_eligible_strategy` (registre legacy partiel ; fallbacks=0) |
| Contrainte | `/director` fakes par défaut (VHS-124) ; exception image OFF (`102_`) ; exception I2V Kling OFF (`129_`) ; exception Voice ElevenLabs OFF (`140_`) — pas de wildcard `providerMode=real` |
| Motion Transfer | Registry MT-002 + Router **MT-003** (`routeMotionTransfer`, `maximumFallbacksPerStep=0`, **0** candidat Production → `motion_capability_unavailable`) ; adapter fal MT-007B **code-only / disabled / UNVERIFIED** (`67_`) ; `RUNTIME_NOT_IMPLEMENTED_YET` ; interdits fallback I2V/T2V silencieux |

## Mission

Construire la meilleure stratégie de production réalisable pour chaque `ScenePackage`, sous contraintes de qualité, identité, délai, budget et disponibilité. Il choisit et explique ; il n'exécute pas.

## Contrat

```ts
type GenerationPlan = ArtifactMeta & {
  projectId: string; scenePlans: SceneGenerationPlan[];
  estimatedCostCents: number; currency: string;
  estimatedDurationSeconds: number;
  policyVersion: string; registryVersion: string;
};
type SceneGenerationPlan = {
  sceneId: string; strategy: GenerationStrategy;
  steps: GenerationStep[]; rationale: RoutingRationale;
};
type GenerationStep = {
  id: string; order: number; action: MediaAction;
  providerId: string; modelId: string; inputRefs: string[];
  expectedOutput: OutputContract; timeoutSeconds: number;
  retryPolicy: RetryPolicy; fallbacks: FallbackStep[];
  estimatedCostCents: number;
};
```

## Sous-systèmes

Capability Registry, Eligibility Filter, Cost Analyzer, Quality/Identity/Speed scorers, Strategy Library, Fallback Builder, Budget Guard et Explanation Builder.

## Décision

1. Filtrer les modèles incompatibles avec media, ratio, durée, références, région et sécurité.
2. Générer les stratégies réalisables : direct video, image-to-video, talking head, voice-over, carousel, tutorial, multi-character.
3. Calculer coût et délai avec marges.
4. Scorer qualité, identité, vitesse, fiabilité et coût selon la politique projet.
5. Sélectionner le meilleur plan dans le budget et construire au plus deux fallbacks par étape.
6. Produire une explication structurée et reproductible.

## Invariants

- pas de modèle par défaut caché ;
- aucune modification du contenu créatif ;
- plan entièrement réalisable au moment de la décision ;
- budget dur jamais dépassé ;
- même registre/politique/entrée produit la même décision ;
- indisponibilité et prix possèdent une date de validité.

## Voice / TTS (`140_`)

Profil ElevenLabs `audio.voice` / `eleven_multilingual_v2` : **disabled**, `paidExecution=false`, allowlist workspace/projet/scène/voix/texte. Aucun fallback de voix. Fake universel interdit. Le plan 11C est une slice TTS single-step : il n’instancie pas l’étape T2V de la stratégie library `voice_over`. Catalogue `142_`–`148_` : dialogue Mei/Tom obligatoires ; voice-over = narratrice ou narrateur choisi explicitement. `ELEVENLABS_VOICE_ID` n’est plus un fallback. Tables catalog **appliquées vides**. Grants durcis. Seed/consent **préparé, non persisté** (`148_`).

## Tests

Table-driven tests couvrant chaque stratégie, budget bas/haut, modèle indisponible, référence absente, région interdite, identité prioritaire, égalité de scores, estimation incomplète et invariance. Les tests utilisent un registre figé, jamais des API réelles.

