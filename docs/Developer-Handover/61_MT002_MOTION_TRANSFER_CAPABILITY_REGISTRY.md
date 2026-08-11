# 61 — MT-002 Motion Transfer Capability Registry

**Date :** 11 août 2026
**Gate :** MT-2 (portion Registry)
**Verdict :** **PASS**

```text
MT-002 = IMPLEMENTED
Gate MT-2 Registry portion = PASS
MT-003 Router = IMPLEMENTED (voir 62_)
provider entries enabled = 0
eligible Production motion-transfer models = 0
runtime capability = unavailable
PROVIDER_NOT_SELECTED_YET
NO PAID BENCHMARK_YET
```

## Registry canonique étendu

```text
studio/src/domain/routing/capabilities/
```

Pas de second Registry parallèle. Extension du catalogue VHS-107 existant.

## Fichiers

| Fichier | Rôle |
|---|---|
| `capability-profiles.ts` | Profil `video.motion_transfer` |
| `prompt/rendering.ts` | Blocks prompt pour le profil |
| `capabilities/model.ts` | `source_video` media input + `motionTransfer?` |
| `capabilities/motion-transfer.ts` | Contrat, Zod, support levels, helpers purs |
| `capabilities/schemas.ts` | Wiring Zod + invariants anti-contradiction |
| `capabilities/index.ts` | Exports publics |
| `__tests__/motion-transfer*.ts` | Fixtures SYNTHETIC + tests MT-002 |

## Capability

```text
video.motion_transfer
```

Discriminant Registry : bloc `ModelCapabilities.motionTransfer` avec `motionTransfer: true` **et** profil déclaré.  
`video.image_to_video` / `video.text_to_video` / reference-images **ne suffisent jamais**.

## Schema / version

```text
MotionTransferModelCapabilities.schemaVersion = 1.0.0
```

Parsing Zod `.strict()` ; versions inconnues refusées ; listes non vides ; async ⇒ `pollingRequired=true`.

## Support levels

| Niveau | Effet hard / paid |
|---|---|
| `SUPPORTED` | Peut satisfaire une hard constraint |
| `PARTIAL` | Ne satisfait **pas** une hard constraint |
| `UNVERIFIED` | **Jamais** éligible pour un run payant |
| `NOT_SUPPORTED` | Inéligible |

## Eligibility helpers (purs)

```ts
supportsMotionTransfer(model)
satisfiesMotionTransferHardConstraints(model, input)
explainMotionTransferIneligibility(model, input)
```

Raisons stables redacted (ex. `motion_transfer_not_supported`, `critical_fidelity_unverified`, `duration_exceeded`, …).  
Aucun routing, aucun effet externe.

## Production

- **0** entrée provider motion-transfer activée.
- Fixtures clairement marquées **SYNTHETIC** (tests only).
- Coûts : conventions `PricingDefinition` existantes + `estimateStrategy` ; **aucun** prix réel non vérifié ajouté.

## Validations exécutées

| Check | Résultat |
|---|---|
| Tests MT-002 ciblés | **30/30** |
| Tests Registry existants | **PASS** |
| Unitaires complets | **1179/1179** |
| Typecheck | PASS |
| Lint | 0 errors / 19 warnings (historiques) |
| Build | PASS |
| Provider / remote / push | **0** |

## Interdits respectés

```text
NO PROVIDER SELECTION
NO REAL PROVIDER ENTRY ENABLED
NO ROUTER STRATEGY WIRING
NO ENGINE WIRING
NO PROVIDER ADAPTER
NO API/UI
NO MIGRATION
NO REMOTE WRITE
NO FEATURE FLAG WRITE
NO DEPLOY
NO PROVIDER CALL
NO PUSH
```

## Suite

**MT-003** Router strategy `motion_transfer` — **IMPLEMENTED** (`62_`).
**MT-004** Generation Engine — NOT STARTED.
