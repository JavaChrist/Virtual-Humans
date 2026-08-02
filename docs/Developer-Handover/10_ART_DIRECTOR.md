# 10 — Art Director

## Mission

Transformer le script en mise en scène cohérente. Il décide ce que le spectateur voit : univers, palette, lieux, vêtements, expressions, poses, caméra, lumière, composition et continuité.

## Contrat

```ts
type VisualDirection = ArtifactMeta & {
  globalStyle: VisualStyle;
  palette: ColorToken[];
  continuityRules: string[];
  scenes: SceneVisualDirection[];
};
type SceneVisualDirection = {
  sceneId: string;
  location: LocationDirection;
  camera: CameraDirection;
  lighting: LightingDirection;
  character: CharacterDirection;
  environment: EnvironmentDirection;
  composition: CompositionDirection;
  transitionIntent: string;
};
```

## Sources autorisées

`VideoScript`, `CreativeConcept`, ressources de marque, `Character` et produit. Les poses, expressions et tenues doivent exister dans le Runtime SDK ou être signalées comme besoins, pas inventées comme assets disponibles.

## Règles

- style global stable, variations motivées ;
- chaque décision visuelle sert la fonction de la scène ;
- zones de texte, contraste, safe areas et format plateforme anticipés ;
- continuité d'identité, tenue, accessoires, lumière et direction du regard ;
- aucun prompt final, modèle, paramètre API, dialogue ou estimation budgétaire.

## Validation

Toutes les scènes du script sont couvertes par `sceneId`; assets référencés disponibles ; palette accessible ; cadrages compatibles avec le ratio ; continuité non contradictoire.

## Tests

Produit tenu en main, capture sur téléphone, talking head, duo, extérieur changeant, format vertical, marque avec charte stricte, asset SDK manquant et scène sans personnage.

