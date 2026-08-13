# 108 — Phase 11A — First Real OpenAI Image Production Smoke

**Date :** 2026-08-13  
**Auth :** `AUTH_11A_PAID_OPENAI_IMAGE_SMOKE_ONCE`  
**Nature :** smoke payant unique · pipeline Production Director · **1** image privée  
**Ops :** ledger smoke soldé (`109_`) · HR REJECT (`110_`) — ce rapport reste la preuve du smoke.

```text
VERDICT = RECONCILIATION_REQUIRED
PROVIDER_AUTH_CONSUMED = YES
SOURCE_COMMIT = 7a67c77
COMPOSITION_FINGERPRINT = c532c400334f5b22
PROMPT_HASH_PREFIX = 9ad3ad28
PLAN_FINGERPRINT_PREFIX = a9cef69b  (variance package UUID — acceptée)
RUNTIME_PAID_MEDIA = OFF
OPENAI_IMAGE_REAL_EXECUTION = UNAVAILABLE
MOTION_RUNTIME = UNAVAILABLE
HUMAN_REVIEW_DECISION = NONE
LEDGER_FOLLOW_UP = 109_ PASS_LEDGER_RECONCILED_HUMAN_REVIEW_PENDING
```

---

## 1. Verdict

**`RECONCILIATION_REQUIRED`**

Le chemin canonique a produit **exactement une** image PNG privée `1024×1024`
(`sourceProvider=openai`, bucket `director-final-assets`, `active=false`,
`pending_review`), avec Human Review **requis** et **aucune** décision humaine.

Cependant le ledger n’a **pas** soldé la réservation smoke :

| Élément | Observé |
|---|---|
| Réservation smoke | **1¢ active** (projet cible) |
| Commit coût réel smoke | **absent** |
| Release reliquat smoke | **absent** |
| Budget après | hard **274** · committed **247** · reserved **1** · available **26** |

L’autorisation provider est **consommée** (preuve durable openai + objet Storage +
asset). **Aucun second appel** n’est autorisé.

---

## 2. Autorisation consommée

| Champ | Valeur |
|---|---|
| Auth | `AUTH_11A_PAID_OPENAI_IMAGE_SMOKE_ONCE` |
| Consumed | **YES** |
| Worker HTTP `providerCalls` | **0** (bug compteur `needs_review` — voir §14) |
| Preuve submit réel | asset `sourceProvider=openai` · PNG ~1.0 MB · Storage write=1 |

---

## 3. Source runtime / composition

| Champ | Valeur |
|---|---|
| Commit applicatif | **`7a67c77`** |
| HEAD documentaire au départ | `1a5066c` |
| Composition fingerprint | **`c532c400334f5b22`** |
| Root | `studio` |
| Script | `studio/scripts/phase-11a-paid-openai-image-smoke-once.mjs` |

---

## 4. Déploiements ON / OFF

| Étape | Host | Commit |
|---|---|---|
| Redeploy ON | `virtual-humans-42utv4sin-…` | **7a67c77** |
| Redeploy OFF | `virtual-humans-5j5mwz1xw-…` | **7a67c77** |

Source de redeploy forcée : déploiement Ready `7a67c77` (pas le HEAD docs).

---

## 5. Dry-run final

| Check | Résultat |
|---|---|
| Local allowlist | executable · `providerCalled=false` · estimate **1¢** · réserve **2¢** |
| HTTP prompts dry | 200 · `providerCalled=false` |
| HTTP routing dry | 200 · single-step openai/gpt-image-1/low/1024 · FP composition OK |
| HTTP production dry | 200 · executable · estimate **1¢** |
| Artifacts/writes dry | **0** run/job/attempt/provider |

---

## 6. Fingerprints / idempotency

| Champ | Préfixe |
|---|---|
| Composition | `c532c400334f5b22` |
| promptHash | `9ad3ad284ec236f9…` (**inchangé**) |
| Plan preflight attendu | `1c5011b7…` |
| Plan exécution observé | `a9cef69be6158d59…` |

**Variance acceptée** : UUID `ScenePackage` assigné à la persistance prompts
(`randomUUID`) — contenu prompt/fonctionnel inchangé (`promptHash` identique).

Idempotency key : préfixe redacted only (attempt in run state) · replay worker →
`claimed=0` · `providerCalls=0`.

---

## 7–8. ScenePackageSet / GenerationPlan

| Artifact | Statut |
|---|---|
| ScenePackageSet | actif r1 · limité `scene-2` · déterministe |
| GenerationPlan | actif r1 · single-step · fallbacks 0 · downstream false |
| Approvals | brief + storyboard + plan **approved** |

---

## 9–11. Budget / estimate / réservation

| Phase | hard | committed | reserved | available |
|---|---:|---:|---:|---:|
| Avant | 274 | 247 | 0 | 27 |
| Après | 274 | 247 | **1** | **26** |

Estimate **1¢** · réservation smoke **1¢** (≤2¢) · hard limit **inchangé**.

---

## 12–15. Run / job / attempt / provider

| Compteur | Valeur |
|---|---|
| production_run | **1** (`waitingReason=needs_review`) |
| production_job | **1** (`completed`) |
| attempts (table) | **0** |
| attempts (run.state) | **1** · `attempt=1` · step `validating`→HR |
| provider / model / quality / size | openai / gpt-image-1 / low / 1024×1024 |
| submit réseau (preuve durable) | **1** |
| Worker HTTP providerCalls | 0 (sous-compte `needs_review`) |

---

## 16–17. Usage / ledger

| Champ | Valeur |
|---|---|
| Usage provider fiable | **non** (pas de commit smoke) |
| Coût réel démontré | **inconnu** → reconciliation |
| Ledger smoke | reservation **+1¢** only |
| Settlement | **incomplet** |

---

## 18–22. Output / Storage / asset / payloads

| Champ | Valeur |
|---|---|
| outputs | **1** |
| MIME / dims / taille | `image/png` · **1024×1024** · **1035500** B |
| checksum prefix | `c508e3e54f2ccac7…` |
| bucket | `director-final-assets` |
| path | `{workspaceId}/{projectId}/media/image/{assetId}.png` |
| assetId prefix | `5d68ef64` |
| lifecycle | `pending_review` · `active=false` · non publié |
| base64/URL persistés | **non** (`persistedMediaPayloadPossible=false`) |

---

## 23–26. QC / HR / retry

| Champ | Valeur |
|---|---|
| QC technique | PNG · dims · taille · checksum OK |
| QC visuel | `unavailable_humanOnly` |
| Human Review | **needs_review** · contexte présent · **0** décision |
| quality_report actif | **0** (non matérialisé comme artifact actif) |
| retry / fallback / downstream | **0 / 0 / OFF** |

---

## 27–28. Idempotence / compteurs

| Compteur | Valeur |
|---|---:|
| providerSubmit (preuve) | 1 |
| storage objects | 1 |
| asset inserts | 1 |
| ledger settlement | **0** (échec partial) |
| worker replay submit | 0 |
| HR decisions | 0 |

---

## 29–30. Flags / runtime final

Tous gates Director/Paid/Worker/VHS-124/Motion **OFF**.  
Probe prompts post-fermeture **404**.  
`RUNTIME_PAID_MEDIA=OFF` · `OPENAI_IMAGE_REAL_EXECUTION=UNAVAILABLE` · `MOTION_RUNTIME=UNAVAILABLE`.

---

## 31–32. Budget après / écritures

Écritures autorisées observées :

- ScenePackageSet · GenerationPlan · 3 approvals  
- 1 production_run · 1 production_job · 1 attempt (state)  
- 1 réservation 1¢ **encore active**  
- 1 objet Storage · 1 asset non actif  

Non observé : commit/release ledger smoke · quality_report actif · HR decision.

---

## 33. Documentation / Git

Ce rapport + script smoke + index canon. Commit/push documentaires **après** fermeture.  
**Pas** de redéploiement du commit documentaire comme preuve runtime.

---

## 34. P0 / P1

| Priorité | Item |
|---|---|
| P0 | **ne pas** re-soumettre OpenAI — Auth consommée |
| P0 | réservation 1¢ active → Auth **ledger reconciliation only** |
| P1 | Human Review décision (approve/reject) — Auth distincte |
| P1 | bug worker : `needs_review` ne remonte pas `providerCalled` |

**Suivi Human Review (2026-08-14) :** `110_PHASE_11A_HUMAN_REVIEW_REJECT.md` —
`PASS_TECHNICAL_ASSET_HUMAN_REJECTED` · décision `rejected` ×1 · asset non actif.

---

## 35. Prochaine décision humaine

```text
NEXT = Auth distincte si nouvelle génération (contraintes anti-texte) OU clôture 11A
DO_NOT = second OpenAI call · retry auto · APPROVE de cet asset · fal · Motion · legacy · auto-activate
```

**Suivi Human Review (2026-08-14) :** `110_PHASE_11A_HUMAN_REVIEW_REJECT.md` —
`PASS_TECHNICAL_ASSET_HUMAN_REJECTED` · asset `5d68ef64…` rejected · 0 regenerate.

---

## Annexe — bug compteur worker (7a67c77)

Dans `claimed-job-processor.ts`, le booléen final `providerCalled` omet
`outcome.status === "needs_review"` alors que le chemin a bien soumis le provider.
Le HTTP worker a donc reporté `providerCalls=0` malgré asset openai + Storage.
Preuve d’autorité : métadonnées asset / Storage / réservation — pas le compteur HTTP.
