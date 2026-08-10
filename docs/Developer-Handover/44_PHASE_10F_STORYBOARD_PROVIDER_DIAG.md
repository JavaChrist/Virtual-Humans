# 44 — Phase 10F-PROVIDER-DIAG — Storyboard `request_failed`

**Date :** 10 août 2026  
**Entrée :** run `f5b75018-…` (`43_PHASE_10F_STORYBOARD_AUTH_B_RESUME.md`)  
**Provider calls pendant DIAG :** **0**

---

## Verdict

```text
READY_FOR_RETRY_PREP
```

Cause racine **démontrée** et corrigée localement. Aucun nouvel execute payant dans cette phase. Une **nouvelle autorisation humaine** + **nouveau salt** restent obligatoires.

---

## Incident (immuable)

| Champ | Valeur |
|---|---|
| run | `f5b75018-5aa1-4a16-97e1-7e515f94f106` |
| status / error | `failed` / `request_failed` |
| attempt / retry_of | 1 / null |
| wall clock | **~1.31 s** (`created_at` → `completed_at`) |
| usage / actual | null / null |
| ledger | reserve 13 / release 13 |
| storyboard | absent |

---

## Cause racine

```text
Catégorie : structured output / schéma rejeté (paramètre non supporté OpenAI strict)
```

1. `SceneSpokenContentSchema` = `z.discriminatedUnion("kind", …)` → JSON Schema **`oneOf`**.
2. `toOpenAIStrictJsonSchema` **préservait** `oneOf`.
3. OpenAI Structured Outputs strict **interdit `oneOf`** (seul `anyOf` est supporté pour les unions).
4. Différence Art validé : schéma Art **sans** `oneOf` ; Storyboard **avec** `oneOf` sur `scenes.items.spokenContent`.
5. Échec rapide (~1.3 s) + `usage=null` + HTTP client **502** `request_failed` = rejet requête **avant** génération (typiquement HTTP 400 `invalid_json_schema` / `invalid_request_error`), mappé VHS en `request_failed`.

Preuve locale offline (fixture) avant fix : `schemaIssueCount=1` path `root.scenes.items.spokenContent` `has_oneOf`.  
Après fix : `schemaIssueCount=0`.

### Observabilité manquante (déficit)

| Élément | Statut |
|---|---|
| HTTP/code/request-id provider persistés sur `director_runs` | **absent** |
| Logs Vercel MCP pour corr Auth B | **403** (inaccessible ici) |
| Adapter failed log (avant fix) | sans `httpStatus` / `providerError*` |

→ Le code provider exact de Production n’est **pas** récupérable a posteriori ; la cause est établie par **analyse de schéma + docs OpenAI + comparaison Art + reproduction fake**.

---

## Correction

| Fichier | Changement |
|---|---|
| `structured-output.ts` | Convertir nested `oneOf` → `anyOf` ; refuser union à la racine |
| `errors.ts` | 400 `invalid_json_schema`/`oneOf` → `structured_output_unsupported` ; 400 générique → `invalid_request` (plus `unknown`) |
| `map-to-analyzer-failure.ts` | Préserver `internalCode` provider pour schema/invalid_request |
| `storyboard/adapter.ts` | Log failed redacted : httpStatus, openaiCode, providerError*, requestId |

Aucun changement de modèle, budget, prompt métier, ou validations Zod domaine.

---

## Reproduction fake (sans réseau)

- Fake transport simule 400 `invalid_json_schema` → VHS `request_failed`, **1** tentative.
- Métadonnées capturées : model / input bytes / schema bytes / reasoning / maxOutput / timeout.
- Tests : `structured-output-oneof.test.ts`, schema-parity no-oneOf, error-taxonomy 400, adapter fake.

---

## Futur nouvel execute (non lancé)

| Champ | Contrat |
|---|---|
| Run `f5b75018` | **immuable** |
| Salt | **`10f-auth-b-retry2-20260810`** (préparé dans `45_…`) |
| Clé | empreinte `0b7e8fb44e0acd4d` ≠ `abaa…` / `3f39…` |
| attempt / retry_of | 1 / null |
| estimate / réservation | recalcul dry-run (attendu **13¢** si knobs inchangés) |
| Autorisation | **nouvelle** obligatoire |
| Deploy | salt-ready + schéma post-fix |
| Observabilité | HTTP/code/request-id/stage/attempts redacted — **ready** (`45_…`) |

---

## Validations DIAG

| Check | Résultat |
|---|---|
| Unitaires | **1074/1074** |
| Typecheck | PASS |
| Lint | 0 erreur |
| Build | PASS |
| Offline diag schema | 0 oneOf |
| Runtime OFF | PASS |
| New runs/ledger | **0** |
| Provider calls | **0** |
| Push | non |
