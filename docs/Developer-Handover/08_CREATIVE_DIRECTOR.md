# 08 — Creative Director

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Smoke réel | **PASS** Phase 10C (`29_PHASE_10C_FIRST_REAL_CREATIVE_SMOKE.md`) |
| Prompt canon | `creative-analyzer-v5` |
| Modèle smoke | `gpt-5.6` |
| Artifact Production | `creative_concept` rev.1 |
| Runtime après smoke | OFF |

## Mission

Transformer un `MarketingPlan` en concept narratif. Il répond à « quelle idée créative rend ce message mémorable ? » sans écrire les répliques, la direction de caméra ni les prompts.

## Contrat

```ts
type CreativeConcept = ArtifactMeta & {
  title: string;
  logline: string;
  bigIdea: string;
  narrativeApproach: 'problem_solution'|'demonstration'|'testimonial'|'transformation'|'slice_of_life'|'tutorial'|'brand_story';
  emotionalArc: EmotionalBeat[];
  openingDevice: string;
  proofDevice?: string;
  endingDevice: string;
  rhythm: 'calm'|'balanced'|'dynamic';
  referenceKeywords: string[];
  constraints: string[];
};
```

## Règles

- le concept réalise l'objectif du `MarketingPlan` sans le réinterpréter ;
- une grande idée, formulable en une phrase ;
- structure compatible avec la durée et la plateforme ;
- références décrites par attributs, sans imiter un artiste vivant ;
- aucune phrase de dialogue définitive, aucun choix de scène technique ou de modèle.

## Validation

Le concept doit conserver cible, bénéfice, ton, CTA et métrique. Chaque beat émotionnel a une fonction et une position relative. Les contradictions avec la marque sont bloquantes.

## Tests

Concept distinct pour un même plan sous plusieurs tons ; conservation du CTA ; durée courte ; marque premium ; sujet sensible ; absence de preuve ; concept trop complexe réduit à une idée.

