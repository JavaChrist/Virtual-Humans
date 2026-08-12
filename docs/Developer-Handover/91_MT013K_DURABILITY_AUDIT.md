# MT-013K-DURABILITY-AUDIT — état durable Motion / fresh process

**Date :** 2026-08-12  
**Auth :** prouver reprise polling entre deux invocations Vercel distinctes — **sans** fal, **sans** flags ON, **sans** écriture Production.  
**Gate :** `POLLING_RECOVERY_ACROSS_FRESH_PROCESS = PASS`

---

## Verdict

**`DURABILITY_PASS_READY_FOR_NEW_DEPLOY_PREFLIGHT`**

Le store process-scoped n’est plus source d’autorité après submit intent / `providerJobId`.  
Authority = `production_jobs.payload` (+ colonne `external_job_id` synchronisée sous lease).

**Suite :** `POST_QC_CONSUMER` câblé dans **MT-013K-QC-CONSUMER** (`92_`) — drain durable download/ingest/QC/review.

---

## 1. Process-scoped inventory (cache only)

| Donnée | Process Map | Reconstructible |
|--------|-------------|-----------------|
| Attempt record (phase, pollCount, …) | cache | oui via `payload.motion` |
| Lifecycle admission latch | process | non critique — poll autorisé si `submitCount≥1` + `providerJobId` |
| Signed media URLs | jamais durable | hydratation poll-only = `durable:omitted` |
| Fake transport counters | test only | — |

## 2. Durable DB inventory (`production_jobs`)

| Donnée | Où |
|--------|-----|
| `productionRunId` / `productionJobId` / `generationAttemptId` | colonnes job + `attempt_id` |
| submit intent / `submitCount` | `payload.motion.submitCount` (persist **avant** fal submit) |
| `providerJobId` fal | `payload.externalJobId` + `external_job_id` |
| phase / pollCount / deadline / terminal / ledgerSettled / reconciliation / late | `payload.motion.*` |
| ledger `reservationId` | `payload.motion.reservationId` |
| output descriptor ref | `payload.motion.outputRef` (après completed) |
| QC handoff | terminal `phase=qc_pending` + queue `needs_review` — **pas** de consumer Durable QC |

**Pas de nouvelle table / migration.** `generation_attempts` non requis pour cette reprise.

## 3–6. Fresh-process / providerJobId / risks

| Question | Réponse |
|----------|---------|
| Reprise polling sans mémoire ? | **Oui** — hydrate + `mode=poll` + même `externalJobId` |
| `providerJobId` avant fin d’invocation ? | **Oui** — `persistLeasedPayload` sous lease **avant** reschedule |
| Cold start → perte polling / second submit / double settle / claimed éternel / non-ingest ? | Mitigé : intent durable ⇒ `submission_unknown` (pas de resubmit) ; après persist ⇒ poll ; settle gardé par `ledgerSettled` ; lease reclaim via queue ; ingest QC **non câblé** (blocage séparé) |
| Process store = autorité ? | **Non** — cache reconstructible uniquement |

## 7. Corrections

- `persistLeasedPayload` sur `JobQueuePort` / Supabase / memory fake  
- `parsePayload` conserve `motion`  
- serialize/hydrate attempt authority (`motion-transfer-attempt-durability.ts`)  
- Orchestrateur : intent durable avant submit ; `providerJobId` durable avant reschedule ; hydrate sur cold start  
- Fix bug `lease` (`_lease` → `lease`) bloquant toute persistance  
- Composition Production (`director-server`) injecte le sink durable  

## 8. Migration

**Non requise** (`LOCAL_ONLY` N/A — aucune migration créée).

## 9. Tests

- `mt013k-motion-durability.test.ts` — A→B→C, crash avant/après, lease reclaim, DB down, concurrence  
- MT-008 / MT-013K-WIRE mis à jour  

## 10. Prochaine porte

1. **New deploy-preflight** sur lignée wire+durability (flags OFF, 0 fal).  
2. Puis Auth payante contrôlée (si preflight vert).  
3. Consumer post-`qc_pending` : voir `92_MT013K_PRODUCTION_MOTION_QC_CONSUMER.md`.
