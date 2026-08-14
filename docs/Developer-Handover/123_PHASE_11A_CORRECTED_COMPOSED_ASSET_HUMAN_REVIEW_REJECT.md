# 123 — Phase 11A — Corrected Composed Asset Human Review REJECT

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_CORRECTED_COMPOSED_ASSET_HUMAN_REVIEW_REJECT_ONCE`  
**Nature :** une décision Human Review append-only `rejected` sur l’asset composé 1.1.0 · **0** OpenAI · **0** Storage write  
**Cible unique :** `4429654f…` · parent `7832765d…` **non rejeté**

```text
VERDICT = PASS_PROVIDER_AND_GLYPHS_TECHNICAL_COMPOSED_ASSET_HUMAN_REJECTED
PROVIDER_PIPELINE = PASS
GLYPH_PIPELINE = PASS
READABILITY = PASS
TYPOGRAPHIC_LAYOUT = FAIL
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

**`PASS_PROVIDER_AND_GLYPHS_TECHNICAL_COMPOSED_ASSET_HUMAN_REJECTED`**

La génération provider no-text reste **PASS** technique.  
L’atlas / composeur **1.1.0** a corrigé les glyphes : le texte est **lisible**.  
La qualité typographique et la mise en page restent **insuffisantes** pour la Production.  
L’asset `4429654f…` est **HUMAN_REJECTED**. Le parent provider reste privé, inactif, réutilisable pour une composition locale **sans** appel OpenAI.

## 2. Décision

| Champ | Valeur |
|---|---|
| Décision | `rejected` (une fois) |
| Cible | `4429654f…` |
| Motif | `human.overlay_typography_layout_not_production_ready` |
| Commentaire | Les glyphes sont maintenant lisibles et le correctif technique du composeur 1.1.0 est validé. L’asset reste toutefois inutilisable en Production : police trop pixelisée, espacement excessif, bandeaux noirs trop lourds et CTA déséquilibré avec “Studio” isolé. Asset composé rejeté. Le parent provider reste réutilisable pour une nouvelle composition locale sans appel OpenAI. |
| decisionId | `058faa7d…` |
| reviewRequestId | `11a-corrected-compose-hr-reject-…` |
| expectedRevision | **5** |
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
| composed 1.1.0 | `4429654f` · checksum `b284e877…` |
| parent | `7832765d` · checksum `1ac51f484420ef88…` |
| composed 1.0.0 | `6a2beca9` · décision `f1fcb832…` inchangée |
| smoke | `5d68ef64` · décision historique inchangée |

## 4. États finaux

| Asset | Lifecycle | active | HR |
|---|---|---|---|
| `4429654f…` composed 1.1.0 | `rejected` | false | REJECT `058faa7d…` |
| `7832765d…` parent | `pending_review` | false | aucune décision cette phase |
| `6a2beca9…` composed 1.0.0 | `rejected` | false | REJECT `f1fcb832…` inchangé |
| `5d68ef64…` smoke | `rejected` | false | REJECT historique inchangé |

Run `39329a01…` : `completed` · `waitingReason` Human Review **clos**.  
Job `edc6e84a…` : `completed` inchangé.  
Delivery du composé 1.1.0 : **`blocked`**.

Distinction : provider no-text **PASS** · glyphes 1.1.0 **PASS** · lisibilité **PASS** · typo/layout **FAIL Human Review** · composé 1.1.0 **HUMAN_REJECTED**.

## 5. Invariants

Storage writes **0** · provider calls **0** · ledger **274 / 249 / 0 / 25** ¢.  
Flags inchangés OFF. Aucun redeploy. Aucune URL signée.

## 6. Tests

Unitaires **1609/1609** · typecheck PASS · lint 0 error · build PASS · freshness PASS · secret scan PASS.

## 7. Prochaine autorisation

**`AUTH_11A_IMPROVE_OVERLAY_TYPOGRAPHY_LAYOUT_NO_PROVIDER_NO_PRODUCTION_MEDIA`**

Amélioration locale (fixtures synthétiques) : police/rendu, kerning, échelle, bandeaux, hiérarchie titre/CTA, wrap, marges, intégration graphique. **0** OpenAI · **0** lecture média Production · **0** écriture Production.
