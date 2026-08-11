# 84 — MT-013F MV-001 Controlled Benchmark Execution Prep

**Date :** 11 août 2026  
**Scope :** `studio/` — préparation technique uniquement  
**Auth :** préparation bornée (pas d’Auth media / deploy / paid)

```text
MV001_EXECUTION_PREP = READY_FOR_MEDIA_AND_DEPLOY_AUTH
MEDIA_VALIDATED      = NO
MEDIA_UPLOADED       = NO
DEPLOYED             = NO
PROVIDER_CALLS       = 0
RESERVATION          = 0
RUNTIME              = UNAVAILABLE
```

---

## 1. Verdict

```text
READY_FOR_MEDIA_AND_DEPLOY_AUTH
```

Aucun déploiement, aucun upload, aucune lecture média réelle, aucune lecture de la valeur `FAL_KEY`, aucune réservation, aucun run/job/asset, aucun appel fal.

---

## 2. Profil benchmark-only

| Champ | Valeur |
|---|---|
| benchmarkId | `MV-001` |
| provider | `fal` |
| model / endpoint | `fal-ai/kling-video/v3/pro/motion-control` |
| duration | **3s** |
| fidelity | `critical` |
| maxCalls / maxJobs / maxOutputs | **1 / 1 / 1** |
| estimate | **51¢** |
| reservation | **62¢** |
| absoluteCap | **100¢** |
| fallbacks / autoRetry | **0 / 0** |
| humanReview | **required** |
| merge/export | **disabled** |

Profil Production général (`FAL_KLING_V3_PRO_REGISTRY_PROFILE`) : **enabled=false**, **paidExecution=false**.  
Éligibilité = exception Registry **scopée MV-001**, expirante (`2026-09-10`), jamais un passage global à `SUPPORTED`.

Code : `studio/src/application/motion/mv001/`.

---

## 3. Gates

Toute gate manquante ⇒ `executable=false`.

Gates structurelles (prep READY) + gates en attente Auth média/deploy (`source` / `identity` / checksums / refs / `FAL_KEY` présence / 4 flags Motion).

Fermeture OFF préparée et testée localement (sans Vercel).

---

## 4. MediaManifest

Contrat `Mv001MediaManifest` — métadonnées uniquement (rôles `motion_source_video`, `motion_identity_reference`).  
Interdits dans Git/docs/logs : bytes média, base64, URL signée, chemins utilisateur sensibles, biométrie brute.

`.gitignore` : `/.tmp/`, `/.private-media/`, `/private-media/`, `**/mv001-media/**`.

Validateur offline : `mv001-media-validator.ts` + script `scripts/mt013f-mv001-media-validate-prep.mjs` (skeleton, **mediaRead=false**).

---

## 5. Upload futur (non exécuté)

Plan `buildMv001UploadPrepPlan` :

- max **2** uploads privés ;
- bucket `director-final-assets` ;
- paths `{ws}/{proj}/motion/{source|identity}/{assetId}.{ext}` ;
- pas d’ACL public ; pas de remplacement d’asset ;
- URLs signées TTL 60s **en mémoire uniquement** (jamais persistées) ;
- Auth humaine séparée requise.

---

## 6. Dry-run live futur

`evaluateMv001DryRunLivePrep` → verdict attendu après deploy Auth : **`READY_FOR_PAID_AUTH`**.  
Script scaffold : `scripts/mt013f-mv001-dry-run-live-prep.mjs`.

Contrôles : commit exact, profil, privacy 5/5, expiration, endpoint, durée, 51/62, budget 174/112/0/62, `providerCalled=false`, 0 réservation/run/job/asset, worker non exécuté.

---

## 7. Exécution future bornée

`createMv001ExecuteProtections` :

- correlationId unique · idempotency key MV-001 unique · attempt **1** · `retry_of=null` ;
- max enqueue **1** · max submit **1** ;
- polling sans resubmit · `submission_unknown` sans relance · cancel unsupported ;
- late output → quarantaine · QC + Human Review obligatoires · pas de merge/export auto.

---

## 8. Fermeture d’urgence (sans Vercel)

`runMv001EmergencyShutdown` — flags OFF dans `finally` :

| Action | Effet |
|---|---|
| Motion / paid / fal / worker → OFF | Runtime UNAVAILABLE ; nouvel enqueue/submit interdit |
| Exception benchmark OFF | Plus de nouvelle éligibilité |
| `retainAsyncJobForPolling=true` | Job déjà soumis **conservé** pour polling contrôlé |
| `abandonedBilledJob=false` | Ne pas abandonner silencieusement un job fal facturé |
| Late result | quarantaine |
| URLs | révocation in-memory only |
| Ledger | reconciliation requise |

**Clarification :** fermer les flags bloque les **nouveaux** submits ; le polling d’un attempt déjà `submitCount≥1` reste autorisé (`canPollAfterMv001Shutdown`).

---

## 9. Budget / privacy / migrations (observés, non mutés)

| Item | Valeur |
|---|---|
| Budget | hard **174** / committed **112** / reserved **0** / available **62** (`83_`) |
| Privacy | `ACCEPTED_LIMITED_MV001` · expire **2026-09-10** inclus (`81_`) |
| Migrations Production | **30/30** (`82_`) |
| Restore drill | **PASS** (`78_`) |

---

## 10. Validations (exécutées)

| Check | Résultat |
|---|---|
| Guards MT-013F | **22/22 PASS** |
| Motion MT-001…012 (+013F) | **244/244 PASS** |
| Suite unitaire | **1434 pass / 2 skipped / 0 fail** |
| typecheck | **PASS** |
| lint | **0 errors** (warnings préexistants) |
| build | **PASS** |
| secret scan (diff) | **0 hits** |
| migrations-static | **14/14 PASS** |
| test:integration:db | **33/33 PASS** |

---

## 11. Autorisations suivantes (exactes — ne pas fusionner)

1. **Auth media validate** — lecture locale privée + checksums (hors Git).  
2. **Auth private upload** — exactement 2 uploads, paths Motion canoniques.  
3. **Auth deploy / Motion flags** — benchmark-scoped, exception active, fermeture OFF prête.  
4. **Auth paid single call MV-001** — réserve ≤62¢, max 1 appel fal, après dry-run `READY_FOR_PAID_AUTH`.

Ne pas démarrer deploy, upload ou benchmark sous cette préparation.
