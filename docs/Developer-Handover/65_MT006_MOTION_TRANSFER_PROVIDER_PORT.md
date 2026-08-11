# 65 — MT-006 Motion Transfer Provider Port & Fake Adapter

**Date :** 11 août 2026
**Gate :** MT-4 Provider Port
**Verdict :** **PASS**

```text
MT-006 = IMPLEMENTED
provider port = PASS
fake adapter = TEST_ONLY
real provider adapters = 0
MT-007A = IMPLEMENTED (spike — voir `66_`)
MT-007B = NOT STARTED (real adapter)
runtime = unavailable
network calls = 0
```

## Port canonique

```text
studio/src/domain/motion/provider-port.ts
interface MotionTransferProviderPort
  estimate / submit / poll / cancel?
```

Compatible en esprit avec `ProviderAdapter` (VHS-109) — typé domaine Motion, sans SDK provider.

## Fichiers

| Fichier | Rôle |
|---|---|
| `domain/motion/provider-port.ts` | Interface, context, evidence, status mapping |
| `domain/motion/types.ts` | Estimate mode, job statuses (+`timed_out`), output descriptors, cancel statuses |
| `domain/motion/errors.ts` | Codes provider étendus MT-006 |
| `infrastructure/providers/motion-transfer/fake-adapter.ts` | Fake synthétique configurable |
| `infrastructure/providers/motion-transfer/assert-fake-allowed.ts` | Garde Vercel/Production |
| `infrastructure/providers/motion-transfer/contract-suite.ts` | Suite contractuelle (gate MT-007) |

## Mapping statuts

| Provider brut | Domaine |
|---|---|
| running | processing |
| succeeded | completed |
| timed_out / timeout | timed_out |
| unknown | **fail-closed** `provider_status_unknown` |

## Fake

- Aucun réseau (`counters.network = 0`)
- Scénarios : sync/async, fail, rate limit, quota, timeout, cancel, late_after_cancel, unknown status
- Submit idempotent par `idempotencyKey`
- Poll sans resubmit
- Interdit si `VERCEL=1` ou Production sans harness

## Contract suite (MT-007 gate)

```ts
runMotionTransferProviderContractSuite({ createHappyPathPort: ... })
```

Tout futur adapter réel **doit** passer cette suite.

## Intégration

Engine MT-004 / Router / Registry : **inchangés** (pas de resolver, pas de wiring d’exécution).

## Interdits respectés

```text
NO REAL PROVIDER ADAPTER / SDK / NETWORK
NO RUN/JOB / LEDGER / STORAGE / API / MIGRATION / DEPLOY
```

## Suite

**MT-007A** — Provider spike **PASS** (`66_`) → selected `fal-ai/kling-video/v3/pro/motion-control`.
**MT-007B** — fal Kling adapter **IMPLEMENTED** disabled-by-default (`67_`) · Gate MT-5 **PASS** · **0** provider calls.
**MT-008** — Worker / polling — **NOT STARTED**.
