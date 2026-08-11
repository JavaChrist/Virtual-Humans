# 60 — MT-001 Motion Transfer Domain Contracts

**Date :** 11 août 2026
**Gate :** MT-1
**Verdict :** **PASS**

```text
MT-001 = IMPLEMENTED
Gate MT-1 = PASS
MT-002 = IMPLEMENTED (voir 61_)
runtime capability = still OFF / unavailable
PROVIDER_NOT_SELECTED_YET
NO PAID BENCHMARK_YET
```

## Conventions réutilisées

| Convention existante | Réemploi |
|---|---|
| `AssetInputRef` / `AssetAccess` (`domain/generation/input.ts`) | Base de `MotionMediaReference` — pas de second système |
| `DomainIdSchema`, semver `1.0.0` (`domain/shared`) | IDs + versions |
| Zod + `safeParse` + DomainError classes | Validation / taxonomie |
| `BriefAspectRatio` / `AspectRatioValues` | Output aspect ratio normalisé |
| Fingerprint SHA-256 sans URLs (`generation/idempotency.ts`) | `buildMotionTransferInputFingerprint` |
| Redaction signed/data URL (`production-result` patterns) | `redactMotionTransferInput` |
| deepFreeze registry-style | Immutabilité des objets parsés |

## Emplacement

```text
studio/src/domain/motion/
  capability.ts
  errors.ts
  media-reference.ts
  types.ts
  schemas.ts
  parse.ts
  idempotency.ts
  redact.ts
  freeze.ts
  index.ts
  __tests__/
```

## Capability

```text
video.motion_transfer
```

Constante `MOTION_TRANSFER_CAPABILITY` — **distincte** de I2V/T2V.
Wiring `CapabilityProfileValues` / Registry = **MT-002 IMPLEMENTED** (`61_`).

## Versions

| Contrat | Version |
|---|---|
| MotionTransferInput | `1.0.0` |
| MotionReferenceSpec | `1.0.0` |
| MotionQcResult | `1.0.0` |
| MotionTransferResult | `1.0.0` |
| Action fingerprint | `motion-transfer-action-v1` |

## Frontière idempotence

- MT-001 : fingerprint **provider-independent** + material `video.motion_transfer:<ver>:<fp32>`.
- Couches futures (jobs/engine) : append `:providerId:modelId:attempt`.

## Validations exécutées

| Check | Résultat |
|---|---|
| Tests MT-001 ciblés | **27/27** |
| Unitaires complets | **1149/1149** |
| Typecheck | PASS |
| Lint | 0 erreur (warnings historiques) |
| Build | PASS |
| Provider / remote / push | **0** |

## Interdits respectés

NO adapter · NO router/engine wiring · NO API/UI · NO migration · NO storage · NO flags · NO deploy · NO push
