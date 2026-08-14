# 127 — Phase 11A — Professional Composed Asset Human Review APPROVE

**Date :** 2026-08-14  
**Auth :** `AUTH_11A_PROFESSIONAL_COMPOSED_ASSET_HUMAN_REVIEW_APPROVE_ONCE`  
**Nature :** une décision Human Review durable `approved` sur **uniquement** l’asset professionnel 1.2.0 · **aucune** activation · **0** OpenAI · **0** Storage write  
**Cible :** `49284892-d6ba-5249-b645-4f55084361cc`  
**Contexte historique :** `ACCEPT_PREFLIGHT_VISUAL` (≠ décision durable)

```text
VERDICT = PHASE_11A_PASS_WITH_HUMAN_APPROVED_PROFESSIONAL_IMAGE
DECISION = approved
DECISION_ID = fb2f886c…
REVIEW_REQUEST_ID = 11a-compose-hr-f0a6f9083af51fcd1f0274cd
ISSUE_CODE = human.professional_overlay_visual_approved
EXPECTED_REVISION = 7
PERSIST = created
REPLAY = existing
STALE_REVISION = conflict
COMPOSED = 49284892 / approved / active=false
CHECKSUM = 9ac484b7a1db3264330ee09ddcb197fa8d83e6735a3476c7af5ab1547ff317f0
PARENT = 7832765d / pending_review / active=false
REJECTED_1_1_0 = 4429654f / rejected / 058faa7d
REJECTED_1_0_0 = 6a2beca9 / rejected / f1fcb832
SMOKE = 5d68ef64 / rejected
RUN = 39329a01 / completed / waitingReason closed
JOB = edc6e84a / completed
DELIVERY = merge_ready (mergeExportAuthorized=false · outputActive=false)
STORAGE_WRITES = 0
PROVIDER_CALLS = 0
SIGNED_URLS = 0
LEDGER = 274/249/0/25
RUNTIME_PAID_MEDIA = OFF
```

---

## 1. Autorisation et décision

Christian a autorisé **une** ligne Human Review `APPROVE` sur l’asset 1.2.0 uniquement.

Décision persistée : `approved`.  
Classification : `human.professional_overlay_visual_approved`.  
Reviewer : `actor_type=shared_password` · `actor_id=phase-11a-human-operator`.  
Commentaire autorisé (sans URL, média, base64, prompt complet ni secret) :

> Rendu professionnel validé : titre et CTA exacts et lisibles, accents et apostrophe typographique corrects, hiérarchie satisfaisante, espacement équilibré, panneaux discrets, contraste et safe areas conformes, absence de clipping et d’artefacts bloquants.

`ACCEPT_PREFLIGHT_VISUAL` reste un **contexte historique** et n’est pas remplacé par cette décision.

## 2. Cible résolue avant écriture

Demande unique `11a-compose-hr-f0a6f908…` · asset `49284892…` · checksum `9ac484b7…` · `composed_overlay_image` · 1 338 305 octets · 1024×1024 · `image/png` · lifecycle `pending_review` · `active=false` · parent `7832765d…` · 0 décision préalable.

Invariants vérifiés : QC technique PASS · QC typo PASS · aucun required issue ouvert · asset non stale · provenance parent/enfant · bucket privé · attestation conforme · aucune contradiction avec les deux REJECT historiques.

## 3. Persist append-only

| Passage | Statut |
|---|---|
| Premier persist | `created` · décision `fb2f886c…` · `expectedRevision=7` |
| Replay identique | `existing` |
| Révision obsolète | `conflict` |
| Total final | **1** décision pour cette demande |

Idempotency key : `hr-decision:{reviewRequestId}`.

## 4. Effets métier

| Objet | Après |
|---|---|
| Asset `49284892…` | `approved` · `active=false` · Storage inchangé · checksum inchangé |
| Production result `0f2aa24e…` | append-only · `delivery=merge_ready` · `mergeExportAuthorized=false` · `outputActive=false` |
| Run `39329a01…` | `completed` · `waitingReason` clos |
| Job `edc6e84a…` | `completed` |

`merge_ready` est l’état de delivery déjà défini par le contrat pour « approuvé, en attente d’une étape aval distinctement autorisée ». Ce n’est **pas** une autorisation de merge, d’export ou d’activation.

Aucune activation, aucun merge, aucun export, aucun downstream, aucun nouveau job, aucune génération.

## 5. Assets immuables

| Asset | Statut | Actif | Décision |
|---|---|---|---|
| `7832765d…` parent | `pending_review` | false | aucune ajoutée |
| `4429654f…` 1.1.0 | `rejected` | false | `058faa7d…` inchangée |
| `6a2beca9…` 1.0.0 | `rejected` | false | `f1fcb832…` inchangée |
| `5d68ef64…` smoke | `rejected` | false | historique inchangée |
| `49284892…` 1.2.0 | `approved` | false | `fb2f886c…` |

## 6. Ledger / provider / runtime

Ledger inchangé : hard **274** / committed **249** / reserved **0** / available **25**.  
OpenAI **0** · fal **0** · Storage writes **0** · signed URLs **0**. Cumul OpenAI Image **2**.  
Flags inchangés : Paid Media **OFF** · OpenAI Image **UNAVAILABLE** · overlay execution **UNAVAILABLE** · Motion **UNAVAILABLE**.

## 7. Tests

Ciblés APPROVE / attestation / optimistic locking / append-only / replay / lifecycle / production result / waitingReason / no-auto-activation / no-downstream / guards : **PASS**.  
Suite unitaire **1628/1628**. Typecheck, lint, build, secret scan et fraîcheur : voir living handover.

## 8. Living handover

Mis à jour : Phase 11A OpenAI Image **PASS technique** · provider no-text **PASS** · composeur 1.2.0 **PASS** · asset `49284892…` **HUMAN_APPROVED** · toujours privé `active=false` · 2 appels OpenAI Image cumulés · ledger soldé · versions rejetées conservées · runtime Paid Media OFF.

---

**Prochaine porte :** `AUTH_11A_CLOSE_AND_NEXT_MEDIA_ROADMAP_AUDIT`  
Clôturer Phase 11A, vérifier le checkpoint Git/documentaire, proposer la prochaine capacité média réelle **sans** provider et **sans** activation automatique.
