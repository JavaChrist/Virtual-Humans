# 12 — Prompt Director

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Implémentation | Déterministe — livrée localement (VHS-122) |
| Production | **0** artifact `scene_package_set` actif post-Storyboard |
| Provider | aucun (pas d’appel AI) |
| Suite | overlay déterministe WIRED_DISABLED ; compose 1.0.0 HUMAN_REJECTED (`119_`) ; composé 1.1.0 `4429654f…` HUMAN_REJECTED layout (`123_`) ; composeur 1.2.0 enfant `49284892…` HR pending (`126_`) ; parent conservé ; pas de 3ᵉ génération |

## Mission

Transformer chaque scène approuvée en représentation structurée complète. Il produit des `ScenePackage` et des rendus de prompts par capacité. Il ne choisit ni provider ni stratégie d'exécution.

## Contrat

```ts
type ScenePackage = ArtifactMeta & {
  sceneId: string;
  intent: ProductionIntent;
  subject: SubjectBlock; action: ActionBlock;
  environment: EnvironmentBlock; camera: CameraBlock;
  lighting: LightingBlock; style: StyleBlock;
  dialogue?: DialogueBlock; audio?: AudioBlock;
  references: SceneReference[];
  constraints: ConstraintBlock;
  promptVariants: PromptVariant[];
};
type PromptVariant = {
  capabilityProfile: string; mediaType: MediaType;
  positive: string; negative?: string;
  composerVersion: string; language: string;
};
```

Les variantes ciblent des profils de capacités (`video.dialogue`, `image.reference_identity`), pas une décision de routage. Un composer spécifique à un modèle peut être résolu plus tard à partir des mêmes blocs.

## Architecture interne

Builders purs pour sujet, action, décor, caméra, lumière, personnage, dialogue, style, négatif et contraintes ; composers versionnés pour produire une syntaxe ; validateur pour longueur, contradictions, références et sécurité.

## Règles

- aucune donnée créative nouvelle qui contredit le storyboard ;
- références avec rôle, checksum et autorisation ;
- contraintes positives prioritaires, négatifs concis ;
- texte écran rendu séparément quand le modèle ne doit pas le générer (`renderMode=post_production`) ;
- chemin image 11A : copy marketing **hors** prompt provider (`providerTextPolicy=no_text`, `111_`) ;
- `text_motion` : le sujet visuel est dérivé de la DA / du purpose, **jamais** de `screenText` (`113_`) ;
- prompt injection contenue comme donnée, jamais propagée en instruction ;
- version du builder/composer enregistrée.

## Validation et tests

Un package par scène, couverture de tous les blocs requis, absence de secrets/PII, références accessibles, limites de longueur respectées. Tester identité, duo, dialogue, produit, carousel, plusieurs langues, contenu hostile et ajout d'un nouveau composer sans modifier les Directeurs précédents.

