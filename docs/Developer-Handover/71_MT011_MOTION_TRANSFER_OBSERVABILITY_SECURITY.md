# 71 — MT-011 Motion Transfer Observability & Security

**Date :** 11 août 2026  
**Capability :** `video.motion_transfer`  
**Statut :** `IMPLEMENTED` · Gate MT-9 Observability/Security **PASS**

```text
MOTION_OBSERVABILITY_READY
SECURITY_GATES_FAIL_CLOSED
PRIVACY_DECISIONS_NOT_YET_AUTHORIZED
REAL_PROVIDER_CALLS = 0
RUNTIME_CAPABILITY = UNAVAILABLE
REMOTE_MIGRATION = NOT APPLIED
```

## 1. Mission

Chaque transition Motion est observable et corrélable **sans** exposer secret, prompt, média, URL signée, biométrie ou commentaire humain intégral.

**Hors scope :** appel fal, upload, deploy, écriture Production, migration distante, benchmark.

## 2. Architecture réutilisée (pas un second framework)

| Couche | Décision |
|---|---|
| Events worker/QC/review (MT-008…010) | **CONSOLIDATE** via façade `motion-observability.ts` + mapping legacy |
| `domain/motion/redact.ts` | **REUSE** pour view models |
| Sanitizer central | **NEW** `domain/motion/security/sanitize.ts` |
| Privacy gate MT-007B | **EXTEND** — contrat MT-011 + compat legacy booleans |
| Flags / worker gates | **REUSE** + `evaluateMotionSecurityGates` consolidé |
| Director `redact()` / `startObservedRoute` | **REUSE** patterns ; Motion events restent sinks mémoire (pas d’écriture Production) |

## 3. Catalogue événements

Version : `mt011-events-1.0.0`

Couvre : `motion.route.*`, `plan.*`, `job.*`, `submit.*`, `poll.*`, `output.*`, `qc.*`, `review.*`, `ledger.*`, `security.*`.

Émission : `emitMotionObservabilityEvent` — sanitize + assert fail-closed + deepFreeze.

## 4. Corrélation

Obligatoires : `correlationId`, `type`, `schemaVersion`.  
Optionnels par phase : workspace/project/run/job/attempt/directorRun, fingerprints provider/artifact/asset/review/idempotency, versions (registry/router/adapter/qc/privacy/sanitizer).

Interdits : média, signed URL, prompt, clé, payload provider brut, commentaire libre.

## 5. Classification

`PUBLIC_SAFE` · `INTERNAL_OPERATIONAL` · `PRIVATE_MEDIA_METADATA` · `SENSITIVE_BIOMETRIC` · `SECRET` · `FORBIDDEN_IN_LOGS`

## 6. Privacy Decision Contract

Version : `mt011-privacy-1.0.0`

```text
providerRetentionAccepted
providerCdnExposureAccepted
biometricProcessingConsentConfirmed
commercialUsageRightsConfirmed
geographicRestrictionsSatisfied
```

Chaque décision : valeur, auteur, date, policyVersion, provenance, expiration, scope.  
**Default = blocked.** Consent expiré → refus.

## 7. Security gates

`evaluateMotionSecurityGates` — flags, Registry VERIFIED, privacy, media, budget, migration distante absente (signalée, **pas** d’apply), fake Production, scope mismatch.

## 8. Provider safety

Clé fal absente du domaine ; sanitizer hostile sur erreurs imbriquées ; `networkAttempts` / HTTP status préservés ; pas de retry auto dans la façade obs.

## 9. Tests

29 ciblés MT-011 (secrets, URLs, data URL, base64, prompts, privacy, gates, fake Production, immutabilité).

## 10. Suite

**MT-012** — Dry-run / suite fake E2E complète — **IMPLEMENTED** (`72_`).  
**MT-013A** — MV-001 readiness — **DONE** (`73_`). Aucun benchmark exécuté.
