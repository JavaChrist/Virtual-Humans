# 53 — Phase 10F-ALL-CONTINUITY-DIAG — contrat continuité générique

**Date :** 11 août 2026  
**Entrée :** run `60a1d9c6-…` (`52_PHASE_10F_STORYBOARD_V3_EXECUTE.md`)  
**Provider calls pendant DIAG :** **0**

---

## Verdict

```text
READY_FOR_V4_PREP
```

Cause racine démontrée : le prompt **v3** ne projetait que les clés `location:*` alors que le validateur `projectContinuity` exige **tous** les tokens projetés (dont `lighting:studio|cool`). Correction locale générique : prompt **`storyboard-analyzer-v4`** + map mandatory (finalisé en `MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` dans `54_…`). Validateur métier **inchangé** (fail-closed). Aucun nouvel execute.

---

## Incident (immuable)

| Champ | Valeur |
|---|---|
| run | `60a1d9c6-17a7-4c31-a838-495bf07b4289` |
| prompt | `storyboard-analyzer-v3` |
| status / error | `failed` / `invalid_candidate` |
| message | `Clé de continuité manquante: lighting:studio\|cool` |
| Structured Output | **PASS** |
| Zod | **PASS** |
| métier continuité | **FAIL** |
| provider calls | 1 (consommé avant DIAG) |
| actual / ledger | 6¢ · reserve 13 / commit 6 / release 7 |
| artifact | absent |
| runtime après | OFF |

Budget après incident : hard **115** / committed **107** / reserved **0** / available **8**.

---

## Inventaire VisualDirection Production (redacted)

Artifact : `49481462-…` rev.1 · 5 segments · fingerprint tokens `9d34b42ddc3bb85c`.

| rule id | scope | severity | segments |
|---|---|---|---|
| `continuity-location-01` | location | **required** | 5 |
| `continuity-palette-01` | palette | **required** | 5 |
| `continuity-product-01` | product | **required** | 4 (pas segment-1) |
| `continuity-lighting-01` | lighting | preferred | 5 |
| `continuity-direction-01` | screen_direction | **required** | 3 |

| Métrique | Valeur |
|---|---:|
| total rules | 5 |
| required rules | 4 |
| preferred rules | 1 |
| scopes projetés (validateur) | 5 (`lighting`, `location`, `palette`, `product`, `screen_direction`) |
| slots tokens projetés | **24** |
| tokens uniques | 9 |
| coverage attendue | complete (5/5 segments) |

Tokens par segment (comptes) : segment-1 **4** ; segments 2–5 **5** chacun.

Exemple opaque segment-1 : `lighting:studio|cool` (pipe canonique).  
Segments 2–5 : `lighting:studio|neutral` + `product:secondary` (+ location/palette/screen_direction selon projection).

**Important :** même si la règle `lighting` est `preferred`, le validateur projette toujours `lighting:<source>|<temperature>` depuis le segment — l’omission reste un rejet métier.

---

## Token opaque `lighting:studio|cool`

| Question | Réponse |
|---|---|
| `|` fait partie du token ? | **Oui** — concaténation canonique `lighting:${source}\|${temperature}` |
| Construction | domaine `keysFromVisualSegment` — pas d’escaping |
| Normalisation ? | **Non** — comparaison stricte `includes` |
| Prompt peut reformuler ? | v3 ne listait pas le token → modèle libre ; v4 copie exacte obligatoire |
| Schéma Zod/OpenAI | accepte string opaque telle quelle |
| Convention `|` | **conservée** (pas de défaut de domaine) |

Contrat opaque : copy exactly · do not translate · do not normalize · do not split · do not summarize.

---

## Pipeline fautif

```text
VisualDirection.segments[].{location,lighting,palette,product,screen_direction,…}
  → keysFromVisualSegment / projectContinuity (TOUS les tokens)
mapping v3 → REQUIRED_LOCATION_… seulement
prompt v3 → modèle omet lighting / palette / product / screen_direction
Zod PASS → métier FAIL sur premier token manquant (ici lighting:studio|cool)
```

Pourquoi v3 ne mappait que `location` : fix ciblé de `48_…` après rejet `location:espace-numerique-principal`.  
Autres rejets évités par le fix générique : `palette:global`, `product:secondary`, `screen_direction:…`, autres `lighting:…`.

---

## Correction générique

| Élément | Changement |
|---|---|
| Domaine | `requiredContinuityKeysByVisualSegmentId`, `inventoryRequiredContinuity` (+ fingerprint/compteurs) |
| Prompt | **`storyboard-analyzer-v4`** — matrice complète, opaque, required vs advisory, self-check |
| Mapping | bloc `REQUIRED_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` ; VD enrichi (`temperature`, `lookDirection`, environment) ; gate pré-provider token-by-token |
| Dry-run | `requiredContinuityRuleCount` / `TokenCount` / `ScopeCount` / `Coverage` / `TokensFingerprint` |
| Validateur métier | **inchangé** |
| Schémas | `1.0.0` ; oneOf=0 ; anyOf-compatible ; metadata capture ready |

---

## Reproduction locale

Fixture 5 segments + règles required/preferred. Preuves :

- Structured Output / Zod PASS ;
- métier FAIL si location / lighting / palette / product / screen_direction absents ;
- métier PASS si tous les tokens projetés présents ;
- preferred lighting n’autorise pas l’omission du token projeté ;
- `|`, `:` copiés exactement ; clé inventée / mauvais segment → rejet.

---

## Budget (aucun write)

| Champ | Valeur |
|---|---:|
| approxInputTokens (fixture locale) | ~3000 |
| maxOutputTokens (prod canon) | 4096 |
| estimate / reservation futurs | **13¢** (politique inchangée) |
| available | **8¢** |
| shortfall | **5¢** |
| hard limit strict minimum | **120** (115+5) |
| hard limit recommandé | **122** (+7) |
| available après hausse reco | **15¢** |

Ne pas réduire les règles pour « faire rentrer » le run.

---

## Future idempotence (conceptuel — non exécuté)

- prompt `storyboard-analyzer-v4` ;
- **nouveau salt** (≠ `10f-storyboard-v3-20260810` et salts brûlés antérieurs) ;
- nouvelle clé / attempt 1 / `retry_of` null ;
- 1 appel max ;
- Auth budget (hausse hard limit) + Auth push/deploy/provider.

---

## Validations

| Check | Résultat |
|---|---|
| Unitaires | **1104/1104** |
| Typecheck | PASS |
| Lint | 0 erreur (warnings préexistants UI) |
| Build | PASS |
| Provider / runs / ledger / budget writes | **0** |
| Runtime | OFF |
| Push | non |

---

## Suite

Préparation v4 finalisée : `54_PHASE_10F_STORYBOARD_V4_RETRY_PREP.md` (`READY_FOR_BUDGET_AND_PUSH_AUTH`).

**Aucune relance Storyboard** dans cette phase.
