# 67 — MT-007B fal Kling Motion Control Adapter (Disabled by Default)

**Date :** 11 août 2026  
**Gate :** MT-5 Adapter Code  
**Verdict :** **PASS**

```text
adapter code = implemented
contract suite = PASS (fake transport)
real transport factory = present, unresolved while flags OFF
Registry profile = UNVERIFIED / enabled=false
privacy gate = blocked (default)
Production candidates = 0
provider calls = 0
paid benchmark = NO
runtime execution = unavailable
FAL_KEY use during tests = 0
```

## 1. Mission

Implémenter `MotionTransferProviderPort` pour :

```text
providerId = fal
modelId = fal-ai/kling-video/v3/pro/motion-control
adapterVersion = mt007b-1.0.0
pricingVersion = fal-llms.txt-2026-08-11
contractVersion = 1.0.0
```

Sans aucun appel fal authentifié.

## 2. Architecture

```text
MotionTransferProviderPort
  → FalKlingMotionControlAdapter
    → FalMotionControlTransport (injectable)
      → FakeFalMotionControlTransport (tests)
      → createFalSdkMotionControlTransport (@fal-ai/client) — gated
```

### Fichiers

| Fichier | Rôle |
|---|---|
| `fal-kling-motion-control-adapter.ts` | Port impl |
| `fal-motion-control-transport.ts` | Transport interface + fake |
| `fal-sdk-motion-control-transport.ts` | Boundary `@fal-ai/client` (FAL_KEY at call time only) |
| `fal-kling-motion-control-resolver.ts` | Fail-closed resolver |
| `motion-transfer-flags.ts` | Flags strict `1\|true` |
| `privacy-gate.ts` | Contrat fail-closed |
| `fal-kling-motion-control-registry-profile.ts` | Profil Registry disabled |
| `fal-kling-motion-control-mapping.ts` | Mapping spike MT-007A (réutilisé) |

### Réutilisation VHS

- Patterns queue fal (`submit` / `status` / `result`) alignés sur `lib/providers/fal.ts` et `FalClientPort`
- Redaction / evidence via `createProviderErrorEvidence` (MT-006)
- `parseStrictEnabledFlag` (feature-flags)
- **Pas** d’extension de `createFalAdapter` (VHS-109) — port Motion séparé
- **Pas** de second client fal parallèle hors transport dédié

## 3. Mapping Input

| Domaine | fal field |
|---|---|
| `sourceVideo` / `mediaBoundary.sourceVideoRef` | `video_url` (required) |
| identité principale | `image_url` (required) |
| 2ᵉ identité + orientation=video | `elements[0].frontal_image_url` (optional, OpenAPI) |
| `preserveCamera===true` → orientation | `character_orientation=video` else `image` |
| `prompt` | `prompt` (optional, trunc 2500) |
| outfit dédié | **unsupported** — `outfitLock=required` bloque |
| aspect/resolution/fps | omis (non acceptés par le schéma) |

Durées officielles (OpenAPI 2026-08-11) : min **3s** ; max **10s** (image) / **30s** (video).

## 4. Estimate / pricing

```text
$0.168 / s → costMinor = ceil(duration * 168 / 10)
1s → 17¢ (formule) ; estimate() refuse < 3s
8s → 135¢ (firm)
10s → 168¢
30s → 504¢
```

Mode `firm` lorsque durée dans les bornes + prix documentaire connu. Aucune réservation budget.

## 5. Submit / Poll / Cancel

- Submit : `fal.queue.submit` via transport → `providerJobId = requestId`
- Idempotence native fal : **absente** — exactly-once = orchestration job DB (MT-008)
- Process-local replay : opt-in tests only (`enableProcessLocalSubmitReplay`) — **pas** garantie Production
- Poll : status puis result si `COMPLETED` ; jamais de resubmit ; `submitCount` observable
- Output : `providerOutputRef = fal-out:{requestId}` — **jamais** CDN URL publique
- Cancel : `cancel_unsupported` + `lateResultExpected=true` (pas d’appel cancel inventé)

## 6. Flags (OFF by default)

```text
MOTION_TRANSFER_ENABLED
MOTION_TRANSFER_PAID_ENABLED
MOTION_TRANSFER_FAL_ENABLED
MOTION_TRANSFER_WORKER_ENABLED  (MT-008, non requis pour construire l’adapter)
```

Resolver réel exige les **trois** premiers + privacy gate `accepted` + `FAL_KEY`.  
Fake interdit en Vercel/Production. Aucun fallback fake.

## 7. Privacy Gate

Décisions obligatoires (toutes `true`) :

- mediaRetentionAccepted
- cdnExposureStrategyAccepted
- biometricConsentConfirmed
- commercialRightsConfirmed
- geographicRestrictionsAccepted

Default : **blocked**. Bloque submit réel (`enforcePrivacyGateOnSubmit`).

## 8. Registry

Profil `FAL_KLING_V3_PRO_REGISTRY_PROFILE` :

```text
enabled = false
paidExecution = false
status = UNVERIFIED
```

**Non** inséré dans un snapshot Production. Router Production → 0 candidats.

## 9. Contract suite

`runMotionTransferProviderContractSuite` avec adapter + `FakeFalMotionControlTransport` — **PASS**.

## 10. Interdits respectés

```text
NO REAL PROVIDER CALL
NO AUTHENTICATED FAL REQUEST
NO GENERATION / UPLOAD / SUBMIT / POLL REAL
NO PROVIDER SECRET USE
NO VERCEL ENV WRITE / DEPLOY / DB / BUDGET / PRODUCTION ENABLE
```

## 11. Suite

**MT-008** — Worker / polling orchestration (toujours flags OFF).  
Benchmark payant **interdit** sans Auth gates + privacy accepted + Registry enable explicite.
