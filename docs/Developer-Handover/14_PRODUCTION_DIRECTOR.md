# 14 — Production Director

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Local fakes | Pipeline queue / QC / merge fake / export validés (Phases 4–9) |
| Production réelle | 1 run image `completed` (`108_`/`109_`/`110_`) · HR **rejected** · asset non actif |
| Média image | smoke 1× OpenAI soldé ledger · path runtime **OFF** · exception OFF |
| Motion Transfer | Worker MT-008 (`68_`) + fal disabled (`67_`) + QC (`69_`) + Review (`70_`) + Obs/Security (`71_`) ; flags OFF ; privacy blocked ; **0** job Production ; runtime unavailable |
| Adapters | fakes par défaut ; allowlist OpenAI image bornée (`VHS124_…`) ≠ `providerMode=real` |

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

Un output provider durable qui bascule en `needs_review` **règle le ledger avant** le handoff Human Review (`109_`). APPROVE/REJECT ne sont pas responsables du commit/release. REJECT 11A (`110_`) clôt la revue sans retry ni activation ; l’exécution reste `completed` (pas un échec provider).

Le texte marketing n’est plus peint par le modèle. Après ingest provider privé : gate OCR (fake / `unavailable_humanOnly`) → composition déterministe → QC typographique → Human Review comparative (`111_`). Overlay **WIRED_DISABLED**. Retry = intent-only. Execution (`118_`) a écrit le composed privé. Human Review (`119_`) : composé **REJECT**. Diagnostic (`120_`) + preflight (`121_`) : atlas `shapes-v1` · composeur **1.1.0** mémoire PASS · parent **inchangé**. QC auto typo PASS ≠ validation visuelle humaine.

## Concurrence et budget

Limiter parallélisme par projet/provider, respecter quotas, verrouiller transition et réservation de coût, arrêter avant le plafond dur. Chaque coût est rattaché à `stepId`, tentative et facture provider.

## Reprise

Recalculer les étapes prêtes depuis les résultats persistés. Ne jamais refaire une sortie valide. L'annulation stoppe les nouveaux jobs et marque les appels non annulables en attente de callback.

## Tests

Succès complet, fallback, crash/reprise, callback dupliqué, annulation, dépassement de budget, provider lent, étape dépendante, merge échoué, projet partiel et rapprochement de coûts.

