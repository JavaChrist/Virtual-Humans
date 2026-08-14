# 119 — Phase 11A — Composed Asset Human Review REJECT

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_COMPOSED_ASSET_HUMAN_REVIEW_REJECT_ONCE`  
**Nature :** une décision Human Review append-only `rejected` sur l’asset composé · **0** OpenAI · **0** Storage write  
**Cible unique :** `6a2beca9…` · parent `7832765d…` **non rejeté**

```text
VERDICT = PASS_PROVIDER_ASSET_COMPOSED_ASSET_HUMAN_REJECTED
PROVIDER_PIPELINE = PASS
COMPOSITOR_VISUAL = FAIL
COMPOSED_ASSET_DECISION = HUMAN_REJECTED
PARENT_ASSET = UNCHANGED_PENDING_REVIEW
COMPOSED_DECISIONS = 1
ASSET_ACTIVE = false
STORAGE_WRITES = 0
PROVIDER_CALLS = 0
LEDGER = 274/249/0/25
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Verdict

**`PASS_PROVIDER_ASSET_COMPOSED_ASSET_HUMAN_REJECTED`**

La génération provider no-text reste **PASS** technique.  
Le composeur bitmap a produit des glyphes corrompus : titre et CTA illisibles.  
L’asset composé est **HUMAN_REJECTED**. Le parent provider reste privé, inactif, réutilisable après correction locale.

## 2. Décision

| Champ | Valeur |
|---|---|
| Décision | `rejected` (une fois) |
| Cible | `6a2beca9…` |
| Motif | `human.corrupted_overlay_glyphs` |
| Commentaire | Fond visuel exploitable, mais titre et CTA illisibles en raison de glyphes corrompus produits par le composeur bitmap. Asset composé rejeté. Le parent provider reste réutilisable après correction du composeur. |
| decisionId | `f1fcb832…` |
| reviewRequestId | `11a-compose-hr-reject-…` |
| expectedRevision | **3** |
| persist | `created` |
| replay | `existing` |
| conflit révision obsolète | fail-closed |
| APPROVE / RETRY_* / REQUEST_NEW_REFERENCE | **non appliqués** |

Aucune URL, média, base64 ou prompt complet dans la décision.

## 3. Identités (préfixes)

| Champ | Préfixe |
|---|---|
| projectId | `984507af` |
| runId | `39329a01` |
| jobId | `edc6e84a` |
| composed | `6a2beca9` · checksum `d056b85aa4f9452d…` |
| parent | `7832765d` · checksum `1ac51f484420ef88…` |
| legacy rejected | `5d68ef64` · inchangé |
| quality_report | `05b64a29` rev **2** (réutilisé) |
| production_result pré-décision | `6dc0ec6f` rev **3** |
| production_result post-décision | `98336d53` rev **4** · `delivery=blocked` |
| décision historique smoke | `93f02155` · **inchangée** |

## 4. États finaux

| Asset | Lifecycle | active | HR |
|---|---|---|---|
| `6a2beca9…` composed | `rejected` | false | REJECT `f1fcb832…` |
| `7832765d…` parent | `pending_review` | false | aucune décision cette phase |
| `5d68ef64…` smoke | `rejected` | false | REJECT historique inchangé |

Run `39329a01…` : `completed` · `waitingReason` Human Review **clos**.  
Job `edc6e84a…` : `completed` inchangé.

Distinction : génération provider **PASS** · composition bitmap **FAIL visuel** · composé **HUMAN_REJECTED**.

## 5. Invariants

Storage writes **0** · provider calls **0** · ledger **274 / 249 / 0 / 25** ¢.  
Flags inchangés OFF. Aucun redeploy.

## 6. Tests

Unitaires **1599/1599** · typecheck PASS · lint 0 error · build PASS · freshness PASS · secret scan PASS.

## 7. Prochaine autorisation

**`AUTH_11A_DIAGNOSE_BITMAP_GLYPH_RENDERING_NO_PROVIDER_NO_PRODUCTION_MEDIA`**

Diagnostic local des glyphes / police · correction du composeur · preuve du rendu français exact · préparation d’une recomposition du parent existant.  
**0** OpenAI · **0** lecture/écriture média Production.
