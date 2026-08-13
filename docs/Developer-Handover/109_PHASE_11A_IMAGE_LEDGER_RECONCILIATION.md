# 109 — Phase 11A — OpenAI Image Ledger Reconciliation (1¢)

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_RECONCILE_EXISTING_IMAGE_RESERVATION_1_CENT_NO_PROVIDER`  
**Nature :** règlement ledger existant · **0** appel OpenAI · **0** Human Review à ce stade · flags **OFF**  
**Ops :** Human Review REJECT ensuite (`110_`).

```text
VERDICT = PASS_LEDGER_RECONCILED_HUMAN_REVIEW_PENDING
IMAGE_LEDGER_RECONCILIATION = PASS
ACTIVE_RESERVATION = 0
SECOND_PROVIDER_CALL = 0
IMAGE_HUMAN_REVIEW = PENDING
ASSET_ACTIVE = false
RUNTIME_PAID_MEDIA = OFF
COST_KIND = provisional
```

---

## 1. Verdict

**`PASS_LEDGER_RECONCILED_HUMAN_REVIEW_PENDING`**

La réservation smoke 1¢ a été soldée par le contrat existant `settleAttemptBudget` :
commit **provisional 1¢** (= réserve), release **0¢**, hold fermé.
Aucune décision Human Review. Asset toujours `pending_review` / non actif.

---

## 2. Identités (préfixes only)

| Champ | Préfixe |
|---|---|
| reservationId | `5b680c05` |
| runId | `f43377a6` |
| jobId | `c9aa68e9` |
| attemptId | `step:scene-2:image:gpt-image-1:a1` |
| correlationId | `corr-11a-pai` |
| idempotency reserve | `reserve:5b680c05…` |
| idempotency commit | `commit:5b680c05…` |
| assetId | `5d68ef64` |
| checksum | `c508e3e54f2ccac7…` |

---

## 3. Preuve du submit unique

Inchangée depuis `108_` :

- asset `source_provider=openai` · PNG `image/png` · 1024×1024 · 1 035 500 B ;
- objet Storage privé `director-final-assets` · path `{ws}/{project}/media/image/{assetId}.png` ;
- 1 production_run · 1 production_job `completed` · 1 attempt dans `state` ;
- table `generation_attempts` = **0** (attempt seulement dans `production_runs.state`) ;
- **aucun** second submit.

---

## 4. Cause compteur HTTP 0

Dans `claimed-job-processor.ts` (runtime `7a67c77`) le booléen **retourné**
`providerCalled` omettait `outcome.status === "needs_review"` (seuls
`completed` / `reschedule` / `failed` étaient comptés).

Le worker HTTP a donc reporté `providerCalls=0` malgré un submit durable.
Preuve d’autorité : asset / Storage / réservation — pas le compteur HTTP.

Correctif : `needs_review` compte désormais comme appel provider ; un échec
**avant** engine (`invalid_input`, kill switch) ne compte pas.

---

## 5. Cause réservation non soldée

Dans `handleEngineResult` (`production-director.ts`), le chemin
`quality.status === "needs_review"` retournait **avant** `settleAttemptBudget`.
Le settlement n’existait que sur le chemin `accepted`.

Human Review n’a jamais été le closer financier — il n’a simplement jamais
été atteint, et le hold est resté `active`.

---

## 6. Coût exact prouvé ou non

| Source | Résultat |
|---|---|
| Usage provider OpenAI persisté | **non** (`actualCost` attempt = null) |
| Catalogue `estimateImage(1024x1024, low)` | $0.011 → **1¢** (half-up) |
| Réservation smoke | **1¢** |
| Contrat `settleAttemptBudget` | `actualCost` absent → **provisional = reserved** |

Le montant 1¢ n’est **pas** inventé : c’est la réserve déjà posée, soldée en
`cost_status=provisional`. Pas de facture provider distincte.

---

## 7. Ledger avant

hard **274** · committed **247** · reserved **1** · available **26**

1 réservation active smoke · 1 ligne `reservation` · 0 commit · 0 release.

---

## 8–10. Écriture de reconciliation

RPC `commit_budget_reservation` :

- amount **1¢** · `p_cost_status=provisional` · revision attendue **1** ;
- reservation status → `committed` ;
- 1 ligne ledger `commit` 1¢ `provisional` ;
- release **0** (commit = réserve).

Patch run borné : `committed_cost_minor=1`, `costKind=provisional` sur
l’attempt. **Pas** de changement `waitingReason`, reviewRequest, asset, HR.

---

## 11. Ledger après

hard **274** · committed **248** · reserved **0** · available **26**

Réservation active après = **0**. Hard limit inchangé.

---

## 12. Idempotence / replay

1. Replay interne du script (même process) : `wrote=false`.
2. Relance process complète : entrée déjà `committed` · Δ ledger = 0 ·
   committed reste 248 · reserved 0.

---

## 13. Correctif pipeline

`handleEngineResult` : succès provider + QC `needs_review` appelle
`settleAttemptBudget` **puis** pose `reviewRequest` / `waitingReason`.
Idempotence attempt complétée. Pas d’auto-APPROVE. Pas d’activation.

---

## 14. Tests `needs_review`

- Director : output valide → `needs_review` → commit provisional, replay sans double commit.
- Worker : `providerCalls=1` sur `needs_review` ; replay claim=0.
- Processor : `needs_review` ⇒ `providerCalled=true` ; `invalid_input` avant provider ⇒ `false`.
- `budget-coordinator` : provisional = reserved ; replay idempotent.

---

## 15–16. Asset / QC / HR

Inchangés : checksum `c508e3e5…` · `pending_review` · `active=false` ·
QC technique PASS · visual `humanOnly` · **0** décision HR.

---

## 17–18. Provider / flags / runtime

`SECOND_PROVIDER_CALL = 0` · pas de retry/fallback/fal/Motion.
Flags non rouverts · pas de deploy · probes HTTP fail-closed (401/403/405).
`RUNTIME_PAID_MEDIA = OFF`.

---

## 19. Tests

| Check | Résultat |
|---|---|
| Unitaires | **1536** pass / 0 fail |
| typecheck | PASS |
| lint | 0 error (warnings préexistants) |
| build | PASS |
| secret scan (diff) | 0 secret / média / URL signée / base64 |
| migrations-static | **14** pass |
| DB integration | **indisponible** (Docker local absent) |

Aucun test n’appelle OpenAI ni ne lit la clé.

---

## 20. Documentation

Ce rapport + `00_README` · `108_` postscript · BACKLOG · CHANGELOG ·
CHECKLIST · `14_PRODUCTION_DIRECTOR` · `102_` ligne ledger.

---

## 21. Git

Commit/push normal `main` → `origin/main` après audit du diff.
Pas de force push. `behind=0`.

---

## 22. P0 / P1

| Priorité | Item |
|---|---|
| P0 | **ne pas** re-soumettre OpenAI — Auth smoke consommée |
| P0 | **ne pas** activer l’asset rejeté |
| P1 fermé | Human Review REJECT (`110_`) · ledger 1¢ reconciled |

---

## 23. Prochaine autorisation exacte

```text
NEXT = Auth distincte si nouvelle génération image (contraintes anti-texte illisible)
        OU clôture Phase 11A
DO_NOT = retry automatique · APPROVE de 5d68ef64… · activation · second OpenAI
         · fal · Motion · legacy · deploy flags ON · hard-limit change
```

---

## Annexe — contrat fail-closed coût

Si `actualCost` provider est absent : commit **provisional = reserved**,
jamais un montant inventé, jamais un second hold.
`reconciliationRequired` du hold smoke = **false** (hold fermé).
Le `costKind=provisional` reste la vérité catalogue vs facture.
