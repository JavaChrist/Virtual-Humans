# 48 — Phase 10F-CONTINUITY-DIAG — `location:espace-numerique-principal`

**Date :** 10 août 2026  
**Entrée :** run `4914c203-…` (`47_PHASE_10F_STORYBOARD_RETRY2_EXECUTE.md`)  
**Provider calls pendant DIAG :** **0**

---

## Verdict

```text
READY_FOR_RETRY_PREP
```

Cause racine **démontrée** et corrigée localement (prompt `storyboard-analyzer-v3` + mapping des clés requises). Validateur métier **inchangé** (fail-closed). Aucun nouvel execute.

---

## Incident (immuable)

| Champ | Valeur |
|---|---|
| run | `4914c203-3be0-4f62-8529-a9b3db25448e` |
| status / error | `failed` / `invalid_candidate` |
| message | `Clé de continuité manquante: location:espace-numerique-principal` |
| stage | post-parse **business** validation |
| usage / actual | présent / 8¢ |
| ledger | reserve 13 / commit 8 / release 5 |
| storyboard | absent |
| candidat brut persisté | **non** (`output_artifact_id` null) |

### Couches de validation (run `4914c203`)

| Couche | Résultat |
|---|---|
| OpenAI structured output | **PASS** (usage tokens, ~55 s) |
| Zod structurel (`StoryboardAnalysisCandidateSchema`) | **PASS** (sinon message Zod, pas continuité) |
| Validation métier Storyboard | **FAIL** |

---

## Cause racine

```text
prompt Storyboard v2 insuffisant + candidat Zod-valide incomplet sur continuityKeys
```

1. VisualDirection Production (`49481462-…`) : **5/5** segments ont `location.continuityKey = espace-numerique-principal`.
2. Règle amont `continuity-location-01` : `scope=location`, `severity=required`, applies aux 5 `segment-*`, description de stabilité du lieu.
3. Validateur `projectContinuity` (`continuity.ts`) exige sur chaque scène le token exact  
   `location:${visual.segments[i].location.continuityKey}`  
   → `location:espace-numerique-principal`.
4. Prompt **v2** disait seulement « Respect VisualDirection continuityKeys » — **sans** format `location:<key>`, sans interdiction de renommer/traduire, sans table segment→clé.
5. Le modèle a produit un JSON Zod-valide dont `scenes[].continuityKeys` omettait (ou remplaçait) ce token.
6. Rejet exact : `projectContinuity` → `continuity_violation` → director `invalid` → API `invalid_candidate` 422.  
   Fonction : `projectContinuity` ; champ : `scenes.<id>.continuityKeys`.

**Non-causes :** schéma OpenAI / Zod trop strict ; validateur incorrect ; normaliseur (n’atteint pas finalize) ; règle VD absente.

---

## Propagation attendue vs observée

```text
VisualDirection.location.continuityKey
  → "espace-numerique-principal"
mapping VISUAL_DIRECTION (+ REQUIRED_LOCATION_… map en v3)
  → prompt
  → scenes[].continuityKeys DOIT contenir "location:espace-numerique-principal"
  → projectContinuity / finalize
```

| Étape | Observé sur 4914c203 |
|---|---|
| VD source | clé présente sur 5 segments |
| Prompt v2 | vague — pas de contrat exact |
| Candidat | Zod OK ; clé canonique absente/renommée |
| Normaliseur | non atteint |
| Validateur | FAIL correct (fail-closed) |

Chaque **plan/scène** lié à un segment VD doit porter la clé (pas seulement une déclaration globale). Une description visuelle ≠ la clé canonique.

---

## Correction

| Fichier | Changement |
|---|---|
| `storyboard/prompt.ts` | **`storyboard-analyzer-v3`** — contrat clés exactes, anti-rename, self-check |
| `storyboard/mapping.ts` | bloc `REQUIRED_LOCATION_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` |
| tests | `phase-10f-continuity-diag.test.ts` — FAIL/PASS + variantes |
| smoke/prep scripts | expect prompt v3 |

Validateur `projectContinuity` **non affaibli**. Schémas domaine/OpenAI **1.0.0** inchangés.

### Pourquoi c’est sûr

- Même pattern que Art `art-analyzer-v3` (continuité lieu).
- Validateur fail-closed conserve le contrat métier.
- Nouvelle version de prompt ⇒ nouvelle identité d’idempotence (pas de reuse des runs failed).
- Pas de baisse de `required` → `advisory`.

---

## Coût / taille future

| Champ | Valeur |
|---|---|
| Max output | **4096** (inchangé) |
| Estimate futur attendu | **~13¢** (même knobs / price book Production) |
| Available actuel | **12¢** |
| Autorisation budget | **oui** si estimate ≥ 13 (Auth A séparée, +1¢ min) |

Pas de réduction qualité pour économiser 1¢.

---

## Futur execute (non lancé)

| Champ | Contrat |
|---|---|
| Runs failed | `b446a0ed` / `f5b75018` / `4914c203` **immuables** |
| Prompt | `storyboard-analyzer-v3` |
| Schemas | 1.0.0 / 1.0.0 |
| Salt | **nouveau** (≠ `10f-auth-b-retry2-20260810`) |
| Clé | distincte des 3 failed |
| attempt / retry_of | 1 / null |
| Appels max | 1 |
| Autorisations | budget (si besoin) + provider **nouvelles** |

Suite PREP : `49_PHASE_10F_STORYBOARD_V3_RETRY_PREP.md` — salt `10f-storyboard-v3-20260810`, empreinte `1bf9daeb68eb6432`, estimate 13¢, shortfall 1¢, verdict `READY_FOR_BUDGET_AND_PUSH_AUTH`.

---

## Validations DIAG

| Check | Résultat |
|---|---|
| Unitaires | **1091/1091** |
| Typecheck | PASS |
| Lint | 0 erreur |
| Build | PASS |
| Continuity fixtures | PASS |
| Runtime OFF | PASS (inchangé) |
| Provider / runs / ledger nouveaux | **0** |
| Push | non |
