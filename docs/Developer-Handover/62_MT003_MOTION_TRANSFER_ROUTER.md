# 62 — MT-003 Motion Transfer Router Strategy

**Date :** 11 août 2026
**Gate :** MT-2 (portion Router)
**Verdict :** **PASS**

```text
MT-003 = IMPLEMENTED
Gate MT-2 Router portion = PASS
MT-004 = NOT STARTED
Production candidates = 0
runtime execution = unavailable
PROVIDER_NOT_SELECTED_YET
NO PAID BENCHMARK_YET
```

## Router canonique étendu

```text
studio/src/domain/routing/router/
```

Pas de second Router. Stratégie `motion_transfer` ajoutée à la library VHS-108 ; décision pure via `routeMotionTransfer`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `strategies.ts` | ID `motion_transfer` |
| `strategy-library.ts` | Template 1-step `video.motion_transfer`, intents `[]`, `no_fallback` |
| `motion-transfer-routing.ts` | Request / Candidate / Decision / Failure + `routeMotionTransfer` |
| `errors.ts` | Code `motion_capability_unavailable` |
| `domain/motion/errors.ts` | Taxonomie routing MT étendue |
| `__tests__/motion-transfer-routing.test.ts` | Tests SYNTHETIC MT-003 |

## Strategy

```text
motion_transfer
maximumFallbacksPerStep = 0
```

- Pas de fallback I2V / T2V / reference-images.
- Pas de réduction silencieuse de fidelity / identity / outfit.
- `supportedProductionIntents: []` — non sélectionnée via intents scène existants ; entrée = `routeMotionTransfer`.

## Contrats

- `MotionTransferRoutingRequest` — contraintes seules (pas d’URLs / prompts / binaires)
- `MotionTransferRoutingCandidate`
- `MotionTransferRoutingDecision` (`selected` | `failed`)
- `MotionTransferRoutingFailure` (`motion_capability_unavailable`, `pricing_unconfigured`, `estimate_unavailable`, `budget_limit_exceeded`, …)

Helper : `routingConstraintsFromMotionTransferInput` (projection redacted depuis MT-001).

## Hard constraints

Réutilise MT-002 :

```ts
supportsMotionTransfer
satisfiesMotionTransferHardConstraints
explainMotionTransferIneligibility
```

+ allowlist provider/model + status vérifié + sync/async + pricing firm + budget compare-only.

## Scoring

Uniquement sur hard-eligible. Dimensions Registry (`quality`, `identity`, `speed`, `reliability`, `cost`).  
`fidelity=critical` → poids qualité/identité/fiabilité dominent le coût. Tie-break policy stable ; ordre candidats invariant.

## Budget

Compare `budgetLimitMinor` à l’estimation — **aucune** réservation ledger.

## Production

```text
route motion_transfer in Production
→ motion_capability_unavailable
→ selected candidate = none
→ provider calls = 0
```

## Validations

| Check | Résultat |
|---|---|
| Tests MT-003 ciblés | **20/20** |
| Tests Router | **PASS** |
| Unitaires | **1199/1199** |
| Typecheck / Lint / Build | PASS / 0 err / PASS |
| Provider / remote / push | **0** |

## Suite

**MT-004** Generation Engine — input `sourceVideo`, validate/resolve/normalize, dry-run sans réseau.
