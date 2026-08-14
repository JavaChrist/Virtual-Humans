# 110 — Phase 11A — Human Review REJECT (no regenerate)

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_HUMAN_REVIEW_REJECT_ONCE_NO_REGENERATE`  
**Nature :** une décision Human Review append-only `rejected` · **0** OpenAI · **0** retry · flags **OFF**  
**Ops :** overlay WIRED_DISABLED (`111_`) · copy overlay retiré du variant (`113_`) — REJECT inchangé ; asset conservé comme preuve.

```text
VERDICT = PASS_TECHNICAL_ASSET_HUMAN_REJECTED
PHASE_11A_TECHNICAL_PIPELINE = PASS
PHASE_11A_ASSET_DECISION = HUMAN_REJECTED
HUMAN_REVIEW_DECISION_COUNT = 1
ASSET_ACTIVE = false
SECOND_PROVIDER_CALL = 0
RETRY_CREATED = 0
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`PASS_TECHNICAL_ASSET_HUMAN_REJECTED`**

Le pipeline réel OpenAI Image (submit unique, ingest privé, QC technique, ledger 1¢) reste **PASS**.  
L’asset smoke `5d68ef64…` est **HUMAN_REJECTED** (faux texte illisible sur le bouton inférieur).  
Ce n’est **pas** un échec provider.

---

## 2. Décision humaine

| Champ | Valeur |
|---|---|
| Décision | `rejected` (une fois) |
| Motif | Titre/composition corrects ; faux texte illisible dans le bouton inférieur → image inutilisable |
| Commentaire persisté | Pipeline techniquement validé, asset rejeté |
| APPROVE / RETRY_* / REQUEST_NEW_REFERENCE | **non appliqués** |

---

## 3. Identités (préfixes only)

| Champ | Préfixe |
|---|---|
| projectId | `984507af` |
| runId | `f43377a6` |
| jobId | `c9aa68e9` |
| attemptId | `step:scene-2:image:gpt-image-1:a1` |
| assetId | `5d68ef64` |
| checksum | `c508e3e54f2ccac7…` |
| quality_report | `67cfed04` rev **1** |
| production_result scaffold | `4497d87c` rev **1** |
| production_result post-décision | `42e0c0a9` rev **2** |
| decisionId | `93f02155` |
| reviewRequestId | `11a-hr-reject-b9…` |
| expectedRevision | **1** |

---

## 4. Décisions existantes avant

**0**

---

## 5. Audit scaffold

| Artifact | Avant | Action |
|---|---|---|
| `quality_report` | absent | **créé** une fois |
| `production_result` | absent | **créé** rev 1 (quality_review) puis rev 2 (blocked) via RPC |
| Contexte contradictoire | non | — |

Aucun doublon. Pas d’URL, data URL, base64 ni prompt complet dans les artifacts.

---

## 6–8. Scaffold + contexte

Quality report minimal : QC technique PASS · PNG 1024×1024 · 1 035 500 B · checksum réel · `visualQuality=unavailable_humanOnly` · Human Review required · défaut humain `human.illegible_invented_button_text` (non mesuré automatiquement).

Production result : `status=completed` (exécution) · `delivery=blocked` après REJECT · coût provisional 1¢ déjà soldé · asset privé référencé sans URL · `phase11a.assetDecision=HUMAN_REJECTED` · merge/export **non** autorisés.

---

## 9–13. Persist + idempotence

| Check | Résultat |
|---|---|
| persist | `created` |
| replay même `reviewRequestId` | `existing` |
| révision obsolète | conflict · **0** 2e ligne |
| décisions totales | **1** `rejected` |
| 2e quality_report | **0** |
| 2e production_result scaffold | **0** (rev 2 = patch delivery canonique) |

---

## 14–16. États après

| Objet | État |
|---|---|
| Asset | `rejected` · privé · `active=false` · Storage **conservé** |
| Run | `completed` · `waitingReason` clos · `humanReview.decision=rejected` |
| Job | `completed` (historique conservé · pas d’échec provider) |
| ScenePackageSet / GenerationPlan | inchangés |
| Delivery | `blocked` · downstream **non** prêt |

Distinction : **technique PASS** / **asset HUMAN_REJECTED**.

---

## 17–21. Invariants

| Check | Résultat |
|---|---|
| Ledger | réserve 1¢ / commit 1¢ provisional / release 0¢ · réservations actives **0** |
| Storage writes | **0** |
| Provider calls | **0** |
| Retry / fallback / nouveau job | **0** |
| Flags / runtime | Paid Media **OFF** · OpenAI Image runtime **UNAVAILABLE** · Motion **OFF** |

---

## 22. Tests

| Check | Résultat |
|---|---|
| Unitaires | **1548/1548** PASS |
| typecheck | PASS |
| lint (fichiers touchés) | 0 error |
| build | PASS |
| migrations-static | 14 PASS |
| DB integration | si Docker local absent : N/A |
| secret scan (diff) | 0 secret / média / URL signée / base64 |

Couverture ajoutée : scaffold absent/reuse/contradictoire · REJECT unique · replay existing · stale revision · asset inactif · 0 retry/job/ledger/Storage/provider · pas d’URL/base64 · technique PASS ≠ rejet humain · downstream bloqué · delivery `rejected` → `blocked`.

---

## 23. Documentation

Ce rapport + `00_README` · `108_` · `109_` · BACKLOG · CHANGELOG · CHECKLIST · `14_PRODUCTION_DIRECTOR` · GLOSSARY.

---

## 24. Git

Commit/push normal `main` → `origin/main`. Pas de force push. Pas de deploy. Pas d’ouverture de flags.

---

## 25. P0 / P1

| Priorité | Item |
|---|---|
| P0 | **ne pas** re-soumettre OpenAI — Auth smoke consommée |
| P0 | **ne pas** activer un asset rejeté |
| P1 fermé | Human Review REJECT 11A · ledger 1¢ · smoke once |
| P1 ouvert | prochaine génération éventuelle = **nouvelle Auth** (contraintes texte bouton) |

---

## 26. Prochaine recommandation

```text
NEXT = Auth distincte si nouvelle génération image (contraintes anti-texte illisible)
        OU clôture Phase 11A (pas de 2e OpenAI par défaut)
DO_NOT = retry automatique · APPROVE de cet asset · activation · flags ON
         · fal · Motion · legacy · hard-limit change
```

L’asset rejeté reste la preuve durable du smoke. Il ne doit pas être recyclé comme sortie exploitable.
