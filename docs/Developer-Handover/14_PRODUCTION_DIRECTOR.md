# 14 — Production Director

## Mission

Orchestrer l'exécution d'un `GenerationPlan` approuvé. Il gère jobs, dépendances, budget, états, fallbacks, contrôle qualité, merge et export. Il n'invente ni contenu ni stratégie.

## Contrat

```ts
type ProductionResult = ArtifactMeta & {
  status: 'completed'|'partial'|'failed'|'cancelled';
  scenes: SceneProductionResult[];
  finalAsset?: AssetRef; manifest: ProductionManifest;
  estimatedCostCents: number; actualCostCents: number; currency: string;
  startedAt: string; completedAt?: string;
};
```

## Machine d'état

Valider approbation et budget → réserver budget → mettre en file les étapes prêtes → exécuter via Generation Engine → valider sortie → déclencher retry/fallback autorisé → terminer scène → merge → validation finale → export → rapprocher les coûts.

## Politique d'échec

Une tentative primaire et les fallbacks prévus seulement. Un timeout ou incident transitoire peut être rejoué selon `RetryPolicy`; une erreur de contenu ou sécurité ne l'est pas. Après épuisement : scène `failed`, projet `partial` ou `failed`, action utilisateur explicite.

## Qualité

Contrôles automatiques : fichier lisible, durée/ratio, piste audio, silence, cadrage, présence d'asset, cohérence d'identité mesurable et règles de sécurité. Un score ne modifie pas le storyboard ; il accepte, rejette ou demande revue.

## Concurrence et budget

Limiter parallélisme par projet/provider, respecter quotas, verrouiller transition et réservation de coût, arrêter avant le plafond dur. Chaque coût est rattaché à `stepId`, tentative et facture provider.

## Reprise

Recalculer les étapes prêtes depuis les résultats persistés. Ne jamais refaire une sortie valide. L'annulation stoppe les nouveaux jobs et marque les appels non annulables en attente de callback.

## Tests

Succès complet, fallback, crash/reprise, callback dupliqué, annulation, dépassement de budget, provider lent, étape dépendante, merge échoué, projet partiel et rapprochement de coûts.

