# 11 — Storyboard Director

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Smoke réel | **PASS** Phase 10F-V4 (`57_PHASE_10F_STORYBOARD_V4_EXECUTE.md`) |
| Prompt canon | `storyboard-analyzer-v4` (après BLOCKED v2/v3) |
| Modèle smoke | `gpt-5.6` |
| Artifact Production | `storyboard_project` rev.1 |
| Continuité | matrice mandatory 24/9/5 |
| Runtime après smoke | OFF |

## Mission

Transformer script et direction visuelle en plan de tournage composé de scènes indépendantes. Le storyboard devient le contrat de production et ne sera pas modifié par les couches suivantes.

## Contrat

```ts
type StoryboardProject = ArtifactMeta & {
  title: string; durationSeconds: number; aspectRatio: AspectRatio;
  scenes: StoryboardScene[];
};
type StoryboardScene = {
  id: string; order: number; title: string;
  purpose: ScenePurpose; durationSeconds: number;
  scriptSceneId: string; visualDirectionId: string;
  dialogue?: string; voiceOver?: string; screenText?: string;
  productionIntent: 'talking_head'|'image_to_video'|'b_roll'|'product_demo'|'carousel'|'tutorial'|'transition';
  references: SceneReference[]; transition: Transition;
};
```

`productionIntent` décrit le besoin ; il ne cite jamais Veo, Kling ou un provider.

## Règles de découpage

- une scène = un objectif principal ;
- 15 s : généralement 2–3 scènes, 20 s : 3–4, 30 s : 4–6, 60 s : 6–10 ;
- le timing du script, les transitions et le total doivent coïncider ;
- une scène peut être réordonnée ou régénérée seule ;
- les références sont explicites et leur rôle est typé.

## Validation

Ordres contigus, identifiants uniques, total exact, couverture de chaque scène du script, direction visuelle correspondante, transitions compatibles, aucune référence introuvable.

## Critères d'approbation utilisateur

Narration compréhensible, rythme adapté, coût encore estimable, identité et produit présents aux bons moments, CTA visible et durée respectée. L'approbation fige une révision.

## Tests

Formats et durées supportés, carrousel, duo, captures produit, scène supprimée/réordonnée, reprise après interruption, rounding des durées et référence manquante.

