# 90 — MT-013K-WIRE Production Motion Worker Orchestrator

**Date :** 12 août 2026  
**Auth :** Phase MT-013K-WIRE — PRODUCTION MOTION WORKER ORCHESTRATOR  
**Source runtime précédent :** `db1d64c` · HEAD documentaire avant wire : `aa5317b`

```text
PRODUCTION_MOTION_ORCHESTRATOR_WIRED = YES
REAL_PROVIDER_CALLS                  = 0
PAID_EXECUTION                       = NOT_STARTED
FLAGS                                = OFF
RUNTIME_MOTION                       = UNAVAILABLE
MV001_REQUIRES_NEW_DEPLOY_PREFLIGHT  = YES
```

---

## 1. Mission

Brancher l’orchestrateur existant `createMotionTransferWorkerOrchestrator` dans le chemin Production canonique uniquement :

```text
createWorker
  → createProductionWorkerFromDeps
    → claimed-job-processor
      → motionTransfer.processClaimedJob
```

Interdit : second worker · route parallèle · exécution hors queue · appel fal · réservation · flags ON · mutation Vercel.

---

## 2. Chemin Production corrigé

| Fichier | Rôle |
|---|---|
| `infrastructure/worker/dependencies.ts` | `motionTransfer?: MotionTransferWorkerProcessor` |
| `infrastructure/worker/factory.ts` | Forward `motionTransfer` |
| `infrastructure/worker/production-motion-transfer.ts` | Composition Production (lazy fal, lifecycle, MV-001 scope) |
| `infrastructure/db/director-server.ts` → `createWorker` | Injecte la composition |
| `application/motion/motion-transfer-lifecycle-gates.ts` | Admission / submit / poll séparés |
| `application/motion/motion-transfer-worker-orchestrator.ts` | Lifecycle latch + `allowedProjectIds` |
| `application/motion/mv001/mv001-privacy-decisions.ts` | Pack privacy MV-001 (env latch) |

---

## 3. Dépendances injectées

| Dépendance | Résolution |
|---|---|
| Provider fal | `createLazyFalMotionTransferProvider` — **jamais** à l’import module ; resolve au premier estimate/submit/poll |
| Registry | Profile global **disabled** ; exception MV-001 si `MV001_REGISTRY_EXCEPTION_ACTIVE=1` |
| Budget / ledger | `productionPorts.budget` (Supabase) |
| Attempts | Store process-scoped (+ `job.payload.externalJobId` durable) |
| Privacy | `resolveMv001PrivacyDecisions` / override composition |
| Lifecycle | `createMotionTransferLifecycleController` |
| Events | Sink optionnel redacted (`assertMotionEventRedacted`) |
| QC / Human Review | Hors worker (post-`qc_pending`) — inchangé MT-009/010 |
| Fake | **Interdit** sous `VERCEL` / `NODE_ENV=production` |

Aucune clé fal dans un objet de domaine ou un log.

---

## 4. Gates

### Admission (nouveau benchmark / enqueue)
Ouverte au démarrage ; **fermée** dès `providerJobId` persisté (`onSubmitPersisted`).

### Submit
`evaluateMotionTransferSubmitPath` = lifecycle submit latch **et** `evaluateMotionTransferWorkerGates` (4 flags + privacy + registry + estimate/reservation/media/review/route).

### Poll (job déjà soumis)
`evaluatePoll` autorise le poll si `submitCount ≥ 1` et `providerJobId` présent — **même** si admission/submit/flags OFF.  
`resubmitAllowed = false` toujours.

Fail-closed sans deps/gates : `motion_capability_unavailable` / `blocked_by_kill_switch` / `motion_scope_forbidden` — **aucun** fallback fake Production.

---

## 5. Exactly-once (pragmatique)

| Règle | État |
|---|---|
| Claim atomique | Réutilisé (queue existante) |
| Intent avant submit | `phase=submitting` + `submitIntentAt` |
| `providerJobId` dès acceptation | Persist attempt + payload reschedule |
| Submit max | 1 (latch + compteur) |
| Poll sans resubmit | Absolu |
| Crash avant persist | `submission_unknown` · **pas** de resubmit |
| Ledger | `ledgerSettled` gate — settle une fois |
| Late result | `late_quarantined` |
| fal native idempotency | **Non** — non prétendu |

---

## 6. QC honnête

- QC technique réel disponible (MT-009).
- Mesures Motion / identité / fidélité / mains-pieds : **unavailable** sans adapter réel → `needs_review`.
- Fake QC measurement **interdit** en Production (`assertMotionQcFakeMeasurementAllowed`).

---

## 7. Tests

`src/infrastructure/worker/__tests__/mt013k-production-motion-wire.test.ts` — 16 cas (composition, fail-closed, flags OFF, FAL_KEY, privacy, registry, exception MV-001, scope, submit=1, poll, admission, submission_unknown, settlement, late quarantine, redaction, fake Production, QC needs_review, zéro réseau).

---

## 8. Non-effets (cette phase)

| Domaine | Valeur |
|---|---|
| Appels fal | **0** |
| Réservations / runs / jobs / attempts Production | **0** |
| Flags Motion/Paid/Worker | **OFF** |
| Vercel env / deploy manuel | **non touchés** |
| Budget / migrations | **inchangés** |
| Paid Auth | **non reprise** |

---

## 9. Prochaine porte exacte

1. **Deploy auto** du commit wire (lecture seule) → nouvelle lignée runtime.  
2. Auth **deploy-preflight** MV-001 (équivalent MT-013J) sur cette lignée.  
3. Puis seulement reprise Auth paid `AUTH_MV001_ONE_FAL_SUBMIT_8S_MAX_RESERVE_162_CENTS`.

`MV001_REQUIRES_NEW_DEPLOY_PREFLIGHT = YES`
