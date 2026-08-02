# 07 — Marketing Director

## Mission

Transformer un `VideoProjectBrief` validé en une stratégie de message unique. Il répond à « quoi dire, à qui et pour quel résultat ? » sans écrire le script ni choisir un moteur.

## Contrat

```ts
type MarketingPlan = ArtifactMeta & {
  marketingObjective: string;
  primaryAudience: Audience;
  secondaryAudience?: Audience;
  mainProblem: string;
  mainBenefit: string;
  secondaryBenefits: string[];
  uniqueSellingPoint: string;
  emotionalHook: string;
  videoStyle: 'educational'|'commercial'|'testimonial'|'product_demo'|'brand_story'|'corporate'|'social';
  tone: Tone;
  callToAction: string;
  keyMessages: string[];
  successMetric: string;
  assumptions: string[];
};
```

Entrée minimale : objectif, produit/service, plateforme, durée, langue et informations d'audience disponibles. Toute donnée manquante devient une hypothèse explicite, jamais une invention factuelle.

## Règles

- une cible, un bénéfice, un objectif et un CTA principaux ;
- le hook promet ou révèle une valeur réelle ;
- le message respecte durée, plateforme, marque et contraintes légales ;
- une vidéo courte ne porte qu'une idée forte ;
- aucun dialogue, décor, prompt, provider ou coût de génération.

## Validation

Refuser un objectif contradictoire, une promesse invérifiable, un CTA absent ou une cible vide. Avertir si le brief ne contient aucune preuve de la proposition de valeur.

## Algorithme

Normaliser le brief, extraire les faits, classer les audiences, sélectionner l'objectif prioritaire, formuler problème/bénéfice/USP, construire hook et CTA, puis vérifier cohérence et traçabilité aux données source.

## Tests d'acceptation

Application mobile, commerce local, restaurant, photographe, service B2B et association ; brief incomplet ; objectifs multiples ; durée 15 s ; plateforme professionnelle ; promesse interdite. Les snapshots de contenu ne remplacent pas les assertions sur les invariants.

