# 54 — Phase 10F-V4-RETRY-PREP — Storyboard v4 après All-Continuity Fix

**Date :** 11 août 2026  
**Entrée :** `53_PHASE_10F_STORYBOARD_ALL_CONTINUITY_DIAG.md`  
**Provider calls pendant PREP :** **0**  
**Budget write / deploy / push :** **non**

---

## Verdict

```text
READY_FOR_BUDGET_AND_PUSH_AUTH
```

Préparation locale complète pour un futur execute Storyboard **v4**.  
`available (8¢) < estimate (13¢)` → Auth budget (D) **séparée** avant Auth push/provider.

---

## Runs précédents immuables

| Run | Statut | Empreinte clé |
|---|---|---|
| `b446a0ed-…` | failed / budget_exceeded | `abaa9c2886ef3d59` (v2, no salt) |
| `f5b75018-…` | failed / request_failed | `3f39f808e266649c` (v2, salt Auth-B) |
| `4914c203-…` | failed / invalid_candidate / location | `0b7e8fb44e0acd4d` (v2, salt RETRY2) |
| `60a1d9c6-…` | failed / invalid_candidate / lighting | `1bf9daeb68eb6432` (v3) |

Aucun de ces runs n’est rejoué. Salts brûlés : `10f-auth-b-20260810`, `10f-auth-b-retry2-20260810`, `10f-storyboard-v3-20260810`.

---

## Sémantique required / preferred

Artifact VisualDirection `49481462-…` rev.1 — 5 règles :

| rule id | scope | severity | Obligation `projectContinuity` |
|---|---|---|---|
| `continuity-location-01` | location | **required** | tokens segmentaires projetés |
| `continuity-palette-01` | palette | **required** | tokens segmentaires projetés |
| `continuity-product-01` | product | **required** | tokens segmentaires projetés (si visibility ≠ none) |
| `continuity-lighting-01` | lighting | **preferred** | **tokens lighting quand même obligatoires** |
| `continuity-direction-01` | screen_direction | **required** | tokens segmentaires projetés |

Réponses explicites :

1. Quatre règles `severity=required` : location, palette, product, screen_direction.  
2. Une règle non-required : **lighting** (`preferred`).  
3. Ses tokens restent obligatoires car `keysFromVisualSegment` projette `lighting:<source>|<temperature>` **indépendamment** de la severity.  
4. Oui — projection indépendante de severity.  
5. Le validateur exige **tous les tokens segmentaires projetés**, pas seulement les rules required.  
6. Le nom `REQUIRED_CONTINUITY_KEYS_…` était trompeur → renommé **`MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID`**.

Advisory token slots : **0** (aucune omission autorisée pour un token projeté).

---

## Matrice canonique Production

Fingerprint tokens : **`9d34b42ddc3bb85c`** (algo `segId|token,token;…`).

| segment | mandatory count | advisory | mandatory tokens (opaques) |
|---|---:|---|---|
| segment-1 | 4 | ∅ | `location:espace-numerique-principal`, `lighting:studio\|cool`, `palette:global`, `screen_direction:product` |
| segment-2 | 5 | ∅ | … + `product:secondary`, `screen_direction:right`, lighting neutral |
| segment-3 | 5 | ∅ | … + `product:hero`, `screen_direction:right` |
| segment-4 | 5 | ∅ | … + `product:hero`, `screen_direction:product` |
| segment-5 | 5 | ∅ | … + `product:hero`, `screen_direction:camera` |

| Métrique | Valeur |
|---|---:|
| total slots | **24** |
| unique mandatory tokens | **9** |
| scopes | **5** |

Opaque proof : `lighting:studio|cool` — `|` canonique, copie exacte.

---

## Contrat prompt / schéma

| Champ | Valeur |
|---|---|
| Prompt | **`storyboard-analyzer-v4`** |
| Schemas | **1.0.0 / 1.0.0** |
| Map | `MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID` |
| Validateur métier | **inchangé** (`projectContinuity`) fail-closed |
| oneOf | **0** |
| anyOf-compatible | **true** |
| additionalProperties | **false** |
| spokenContent variants | preserved |
| Parité Zod/OpenAI | **PASS** |
| Exemple synthétique + self-check coverage | **oui** |
| Union multi-segment | **exigée** |

Ordre réel des validations métier (fixture PASS) :

```text
Structured Schema → Zod → coverage → continuity → references → conservation(spoken) → timing
```

---

## Nouvelle idempotence

| Champ | Valeur |
|---|---|
| Salt proposé | **`10f-storyboard-v4-20260811`** |
| Empreinte clé | **`801c34a1080bbcf0`** |
| Distincte des 4 failed | **oui** |
| attempt_number | **1** |
| retry_of_run_id | **null** |
| Stabilité execute/replay | même salt → même clé |

---

## Estimation exacte (Production, locale)

| Champ | Valeur |
|---|---|
| Provider / modèle | OpenAI / `gpt-5.6` |
| Reasoning / max out | `medium` / `4096` |
| Price book | 500 / 3000 ¢/MTok |
| approxInputTokens | **3285** |
| estimate | **13¢** |
| reservation | **13¢** (= estimate) |
| hard limit | **115¢** |
| committed | **107¢** |
| reserved | **0** |
| available | **8¢** |
| shortfall | **5¢** |

### Autorisation Budget D proposée (non exécutée)

| Option | Hard limit | Delta | Available après |
|---|---|---|---|
| Strict minimum | **120¢** | +5 | **13¢** |
| **Recommandé** | **122¢** | **+7** | **15¢** |

Aucune écriture budget dans cette phase.

---

## Guards futurs

| Guard | Statut |
|---|---|
| promptVersion = v4 | exigé |
| continuitySemantics = mandatory-projected-tokens | exigé |
| mandatory slots / unique / scopes / fingerprint | 24 / 9 / 5 / `9d34b42ddc3bb85c` |
| oneOf=0 / anyOf / metadata ready | exigé |
| refuse salts/prompt v2/v3 | exigé |
| Max provider calls | **1** |
| Automatic retry / fallback | forbidden |
| Upstream replay / media / worker | forbidden |
| Closure always → runtime OFF | exigé |

---

## Validations PREP

| Check | Résultat |
|---|---|
| Unitaires | **1116/1116** |
| Typecheck / lint / build | PASS / 0 erreur / PASS |
| Provider / runs / ledger / budget writes | **0** |
| Runtime | OFF |
| Push | non |

---

## Autorisations exactes demandées (futures)

```text
AUTH_BUDGET_D = RAISE_HARD_LIMIT_115_TO_122 (+7¢)
AUTH_PUSH = PUSH_MAIN_V4_PREP_COMMIT
AUTH_PROVIDER = ONE_STORYBOARD_CALL_MAX_13_CENTS_PROMPT_V4_SALT_10f-storyboard-v4-20260811
```

**Aucune relance Storyboard** dans cette phase.
