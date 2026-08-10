# 35 — Phase 10E-DIAG — Art `invalid_candidate` (continuité lieu)

**Date :** 10 août 2026  
**Entrée :** `34_PHASE_10E_FIRST_REAL_ART_TEXT_SMOKE.md` (BLOCKED, commit `2edb964`)  
**Run immuable :** `53fb45c3-0d36-43d9-9882-6a96fde2a814`  
**Provider calls during DIAG :** **0**

---

## Verdict

```text
READY_FOR_RETRY_PREP
```

Correction locale du prompt Art livrée (`art-analyzer-v3`). Aucun retry payant. Runtime OFF.  
Suite : PREP `36_…` puis execute v3 **PASS** (`37_PHASE_10E_ART_V3_NEW_EXECUTE.md`).

---

## Cause racine

```text
Catégories : 1 (prompt insuffisant) + 4 (sortie Zod-valide mais incohérente métier)
(+ contribution 2 : lieux non structurés amont)
```

Le candidat OpenAI a passé `ArtAnalysisCandidateSchema`, puis a été rejeté par la validation métier :

```text
validateContinuityAgainstSegments
  scope = location
  severity = required
  description implies stability (stable|même|same|conserve)
  unique(location.continuityKey) > 1
→ "Continuité lieu required non respectée."
→ continuity_violation → invalid_candidate (HTTP 422)
```

Le validateur est **correct** (fail-closed). Le prompt `art-analyzer-v2` n’imposait pas le contrat `continuityKey` / `required` stable.

---

## Preuves run (redacted)

| Champ | Valeur |
|---|---|
| status / error_code | `failed` / `invalid_candidate` |
| attempt | 1 |
| model | `gpt-5.6` |
| prompt_version | `art-analyzer-v2` |
| schema_version | `1.1.0` |
| usage | in 3092 · out **3889** · reasoning 332 · total 6981 |
| maxOut knobs | 4096 |
| actual / ledger | 12¢ commit · 13¢ reserve · 1¢ release |
| output_artifact_id | null |
| candidat brut en DB | **absent** (aucune colonne candidate/raw sur `director_runs`) |

Troncature : **non** — Zod structurel a réussi ; `outputTokens=3889 < 4096`.

---

## Artifacts amont (redacted)

VideoScript `349e2792-…` rev.1 — **5** segments (`segment-1`…`segment-5`).  
Pas de champ lieu structuré côté Script (par design). Indices textuels « locationish » sur segments 3 et 5 uniquement. CreativeConcept contient aussi des indices de lieu. Suffisant pour Art, mais **ambigu** pour une stabilité de lieu required globale.

---

## Reproduction locale

`studio/src/domain/art/__tests__/phase-10e-diag-location-continuity.test.ts`

| Couche | Résultat |
|---|---|
| Zod `ArtAnalysisCandidateSchema` | PASS sur fixture divergente |
| `validateContinuityRules` | PASS (graphe de règles) |
| `validateContinuityAgainstSegments` | FAIL message exact Production |
| `validateCandidateAgainstSources` | propage le même issue |

---

## Correction

| Élément | Changement |
|---|---|
| Prompt | `art-analyzer-v2` → **`art-analyzer-v3`** |
| Contenu | contrat explicite `continuityKey` ; required+stable ⇒ clé identique ; ruptures via preferred / wording rupture + périmètre segments |
| Schéma JSON | inchangé `1.1.0` |
| Validateur | **inchangé** (conservé fail-closed) |
| Normaliseur | inchangé |
| Knobs Production | inchangés (pas d’écriture Vercel) |

Pourquoi c’est sûr : ne relâche pas la règle métier ; ne mute pas le run failed ; nouvelle identité d’idempotence via `promptVersion` ; schéma stable.

---

## Audit `/art/retry` (non utilisé)

| Check | Résultat |
|---|---|
| Route | `/api/director/projects/[projectId]/art/retry` |
| Allowlist humaine | `invalid_candidate` **exclu** (`retry_not_allowed`) |
| Config match | `prompt_version` doit = run précédent sinon `retry_config_mismatch` |
| Après v3 | retry du run `53fb45c3-…` (v2) **impossible** |

Donc le futur essai Art texte = **nouvel `execute`** (attempt 1, nouveau contrat v3), avec autorisation financière séparée — pas `/art/retry`.

---

## Knobs / estimate futurs (proposition)

```text
provider = OpenAI
model = gpt-5.6
reasoning = medium
maxOut = 4096
estimate attendu ≈ 13¢ (confirmer dry-run live après deploy du code v3)
plafond = 100¢
```

Légère hausse d’input tokens possible (prompt plus long) ; ne pas changer les knobs sans dry-run live.

---

## Validations DIAG

| Check | Résultat |
|---|---|
| Tests unitaires | **1042/1042** |
| Typecheck | PASS |
| Lint | 0 erreur (warnings préexistants) |
| Build | PASS |
| Runtime OFF | PASS |
| Provider / runs / artifacts / ledger nouveaux | **0** |
| Push | non |

---

## P1

```text
BACKUP_PRESENT_RESTORE_UNPROVEN (conservé)
ART_INVALID_CANDIDATE_CONTINUITE_LIEU → mitigé prompt-side ; validation smoke reste à refaire
```
