# 101 — Phase 11A-RESUME — Real Media Pipeline Reassessment

**Date :** 2026-08-13  
**Nature :** audit / documentation — **0** provider · **0** dépense · **0** wiring substantiel  
**Décision humaine :** MV-002 **DEFERRED** · reprise chantier principal 11A  
**Ops 14 août 2026 :** overlay déterministe / provider no-text = WIRED_DISABLED (`111_`) — ce rapport historique n’est pas réécrit.

```text
VERDICT = BLOCKED_MEDIA_PRODUCTION_WIRING
MV002 = DEFERRED
MOTION_PRODUCTION = DISABLED
PHASE_11A = REASSESSED
REAL_MEDIA_CALLS_THIS_PHASE = 0
RUNTIME_PAID_MEDIA = OFF
REGISTRY_MOTION.enabled = false
REGISTRY_MOTION.paidExecution = false
```

---

## 1. Verdict

**`BLOCKED_MEDIA_PRODUCTION_WIRING`**

Le chemin Production `/director` reste **fakes-only** (VHS-124).  
Les adapters OpenAI image / fal / ElevenLabs existent en code mais **ne sont pas**  
branchés sur `processClaimedJob` média. Motion Transfer (MV-001) est un chemin  
**séparé** et ne débloque pas le média générique.

- **Pas** `READY_FOR_11A_HUMAN_AUTH` : Auth/flags seuls ne suffisent pas.  
- **Pas** `READY_FOR_11A_IMPLEMENTATION` tant que l’unité d’implémentation n’est  
  pas Auth-ée (exception VHS-124 bornée).  
- Sous-état politique : exception VHS-124 vs pause — mais le **blocage technique** est le wiring.

---

## 2. État 11A initial vs actuel

| Thème | 58_ (11 août) | 101_ (13 août) |
|---|---|---|
| Verdict | `DECISION_REQUIRED` | **`BLOCKED_MEDIA_PRODUCTION_WIRING`** |
| Budget | 122 / 112 / 0 / **10** ¢ | **274 / 247 / 0 / 27** ¢ |
| VHS-124 fakes-only | oui | **oui (inchangé)** |
| Adapters réels sur `/director` | non | **non** |
| Motion | non démarré | MV-001 **PASS_WITH_HUMAN_APPROVAL** · Registry disabled |
| MV-002 | — | DESIGN_READY puis **DEFERRED** |
| Backup P1 | UNPROVEN | **RESTORE_PROVEN** |
| Image shortfall | 0 (vs 10¢) | **0** (vs 27¢) |
| Vidéo Hailuo 30¢ | shortfall | shortfall **9¢** sur réserve 36 |

**Obsolète dans 58_ :** chiffres budget ; absence Motion ; shortfall image.  
**Non obsolète :** reco Option A ; shot scene-2 `text_motion` ; blocage VHS-124 ;  
interdiction de contourner via legacy pour un PASS Production.

---

## 3. Choix recommandé vs alternatives

### Recommandation produit (quand le wiring existera)

**Option A — 1 image OpenAI `gpt-image-1` 1024×1024 low**  
- estimate **1¢** ($0.011) · réservation reco **2¢** · shortfall **0**  
- sync · 1 call / 1 job / 1 asset · shot `scene-2` `text_motion`

### Comparatif actuel

| Opt | Valeur | Wired `/director` Production | Sync | Est. | Réserve | Avail 27 | Appels/jobs/assets | Dépendances | Risques | Couverture Production | QC/HR | Gaps bloquants |
|---|---|---|---|---:|---:|---|---|---|---|---|---|---|
| **A** OpenAI image | still utile | **NON** | sync | 1¢ | 2¢ | OK | 1/1/1 | exception VHS-124 + allowlist | bas | enqueue→worker→engine→asset | accepting QC only | **wiring** |
| B fal PuLID | identité | **NON** | sync | 5¢ | 6¢ | OK | 1/1/1 | refs identité | refs=0 scènes | idem | idem | wiring + refs |
| C fal vidéo courte | async queue | **NON** | async | 30¢ | 36¢ | **shortfall 9** | 1/1/1+poll | budget + orphan | élevé | partielle async | faible | wiring + budget |
| D ElevenLabs voice | audio | **NON** | sync | ~2¢ | 3¢ | OK | 1/1/1 | texte | faible preuve visuelle | partielle | idem | wiring |
| **E** aucun smoke | — | n/a | — | 0 | 0 | — | 0 | — | — | — | — | **état réel** |

**Choix de phase :** **E** (aucun smoke) jusqu’à Auth d’implémentation wiring.  
**Choix cible post-wiring :** **A**.

---

## 4. VHS-124 — état précis

| Question | Réponse |
|---|---|
| Adapters média branchés `/director` Production ? | **NON** — `createDirectorFakeProviderAdapters()` défaut |
| Exception OpenAI image 11A encore nécessaire ? | **OUI** — sinon impossible |
| Worker peut exécuter action image réelle ? | **NON** — fakes only ; kill switch paid∧worker |
| run/job/attempt/ledger/asset persistés pour média réel ? | chemin validé **fakes** seulement |
| Ingest sans URL persistée (type Motion drain) ? | **NON** sur média générique |
| QC / HR câblés média générique ? | QC **accepting** (permissif) ; Delivery HR existe mais non prouvé réel |
| Downstream chaining bloquable ? | oui (contrat smoke : OFF) |
| Legacy `/api/generate/image` preuve utile Production ? | **NON** pour PASS Production — interdit comme contournement |

Preuve : `studio/src/infrastructure/db/director-server.ts`  
(`assertDirectorProductionUsesFakes`, `createDirectorFakeProviderAdapters`).

---

## 5. Chemin Production réel vs manques

```text
Storyboard PASS
  → scene_package_set     ABSENT (à produire déterministe)
  → generation_plan       ABSENT (Router full-plan: no_eligible_strategy text_motion)
  → approvals             ABSENTS pour plan média
  → production_jobs       0 média générique
  → worker                fakes only pour image/video/voice
  → motion_transfer       BRANCHÉ (MV-001) — HORS scope 11A
```

### Raccordements manquants (unité de travail exacte suivante)

**Phase suivante proposée :** `11A-WIRE-OPENAI-IMAGE-ALLOWLIST` (Auth humaine requise)

1. Exception VHS-124 **bornée** : injecter `createOpenAIImageAdapter` uniquement pour  
   smoke allowlist (1 action `image`, model `gpt-image-1`, project+scene figés).  
2. Single-step plan (bypass `no_eligible_strategy` full-plan) OU stratégie Router minimale.  
3. Worker exécute 1 job sync · ledger reserve 2¢ / commit ≤1¢ / release.  
4. Output memory/data-URL → asset privé si Storage path prêt (sinon documenter limite).  
5. QC accepting + option HR Delivery ; downstream OFF ; flags OFF après.  
6. **Interdit :** legacy bypass · Motion · multi-call · retry/fallback.

---

## 6. Artifact source (lecture seule)

Projet texte smoke (script 11A) : `984507af-a89e-4644-8ea3-344797baa974`  
(**≠** projet Motion `390c25db-…`)

| Artifact | Statut (58_ / inchangé structurellement) |
|---|---|
| MarketingPlan | actif rev.1 |
| CreativeConcept | actif rev.1 |
| VideoScript | actif rev.1 |
| VisualDirection | actif rev.1 |
| StoryboardProject | actif rev.1 |
| ScenePackageSet | **absent** Production |
| GenerationPlan | **absent** Production |
| Approvals plan média | **absentes** |
| Shot candidat | scene-2 · order 2 · `text_motion` · `image.text_to_image` |
| Jobs/assets média | **0** |

Aucun Director texte régénéré.

---

## 7. Budget (USD cents — aucun write)

| Champ | ¢ | $ |
|---|---:|---:|
| hard | 274 | 2.74 |
| committed | 247 | 2.47 |
| reserved | 0 | 0.00 |
| available | 27 | 0.27 |
| A estimate | 1 | 0.011 |
| A reservation | 2 | 0.02 |
| A shortfall | **0** | 0 |
| C video estimate | 30 | 0.30 |
| C reservation | 36 | 0.36 |
| C shortfall | **9** | 0.09 |

---

## 8. Isolation Motion (guards)

Module : `studio/src/application/production/phase-11a-motion-isolation.ts`

- pas de projet MV-001 ;  
- pas de Privacy Pack MV-001 ;  
- pas d’endpoint `motion_transfer` / Kling MC ;  
- pas de réutilisation asset output MV-001 ;  
- MV-002 **DEFERRED** ;  
- Registry Motion `enabled=false` / `paidExecution=false`.

---

## 9. Contrat sécurité future (post-Auth wiring)

```text
max provider calls = 1
max jobs = 1
max outputs = 1
retry = 0 · fallback = 0
downstream chaining = OFF
worker borné run-once
URLs temporaires memory-only
Storage privé (si ingest)
ledger reserve/commit/release
QC puis HR selon capacité
flags OFF après
pas de merge/export/publication auto
```

---

## 10. Tests (non payants)

| Suite | Résultat |
|---|---|
| `phase-11a-media-prep-guards` | PASS |
| `phase-11a-resume-isolation` | PASS |
| VHS-124 forbid real | PASS |
| Registry Motion disabled | PASS |
| typecheck / build | PASS |

`REAL_MEDIA_CALLS_THIS_PHASE = 0` · `REMOTE_WRITES = 0`

---

## 11. P0 / P1

### P0
1. Ne pas lancer de smoke média tant que VHS-124 fakes-only.  
2. Ne pas contourner via `/api/generate/image`.  
3. Ne pas toucher Motion / MV-002.

### P1
1. Auth humaine **exception VHS-124 bornée** + implémentation allowlist OpenAI image.  
2. Produire `scene_package_set` + plan single-step pour scene-2.  
3. Ingest Storage privé pour output image (si exigé pour preuve asset).

---

## 12. Prochaine phase exacte

```text
NEXT = 11A-WIRE…STORAGE/PLAN — DONE through `106_` · READY_FOR_NEW_11A_LIVE_PREFLIGHT
FOLLOW-UP = 11A-LIVE-PREFLIGHT-NO-PROVIDER (nouveau SHA)
DO_NOT = provider call · legacy PASS · MV-002 · Motion flags · budget write
```

> **Update 2026-08-13 :** câblage allowlist livré (`102_`). Verdict historique
> `BLOCKED_MEDIA_PRODUCTION_WIRING` conservé pour l’audit 101_ ; état ops courant =
> `OPENAI_IMAGE_PRODUCTION_PATH_WIRED_DISABLED`.

---

## 13. Non-goals confirmés

- 0 provider / upload / download  
- 0 réservation / budget write / run / job / asset Production  
- 0 Vercel / deploy / flags  
- 0 migration  
- 0 reprise MV-002  
- 0 raccordement substantiel implémenté dans cette phase
