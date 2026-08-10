# 45 — Phase 10F-RETRY2-PREP — Storyboard après fix structured output

**Date :** 10 août 2026  
**Entrée :** `44_PHASE_10F_STORYBOARD_PROVIDER_DIAG.md` (`READY_FOR_RETRY_PREP`, commit `48a671d`)  
**Provider calls pendant PREP :** **0**  
**Runs / artifacts / ledger nouveaux :** **0**

---

## Verdict

```text
READY_FOR_PUSH_AND_REAUTH
```

Préparation locale complète après correction `oneOf→anyOf`. Aucun appel provider, aucune réservation, aucun push. Le prochain execute exige **push + deploy du fix**, **nouveau salt**, et **nouvelle autorisation humaine**.

---

## Runs précédents (immuables)

| Run | Statut | Notes |
|---|---|---|
| `b446a0ed-0005-40ed-b134-b7ab769bd819` | `failed` / `budget_exceeded` | 0 provider ; ledger 0 |
| `f5b75018-5aa1-4a16-97e1-7e515f94f106` | `failed` / `request_failed` | 1 provider ; ledger reserve 13 / release 13 |

Salt brûlé Auth B : `10f-auth-b-20260810` (empreinte `3f39f808e266649c`).

---

## Preuves schéma (local)

| Check | Résultat |
|---|---|
| `structuredSchemaOneOfCount` | **0** |
| Projection | **`anyOf-compatible`** |
| `spokenContent` variants | `dialogue` / `voice_over` / `none` |
| Root strict | `additionalProperties: false` |
| Parité Zod ↔ OpenAI (validateur local) | PASS |
| Hybrides rejetés par projection (même si Zod strip) | PASS |
| Fake transport 400 schema | metadata capturée |

Script offline : `studio/scripts/phase-10f-retry2-prep-local.mjs` → `.tmp/phase-10f-retry2-prep-done.json`.

---

## Observabilité fermée (avant futur appel)

Capturables redacted sur failure (adapter + API failed + evidence helper) :

- HTTP status provider
- type / code provider
- request ID provider
- catégorie VHS
- étape `request_build` | `provider_request` | `provider_response` | `candidate_parse`
- durée
- nombre de tentatives réseau
- usage présent / absent

Jamais persistés : clé API, prompt, input, schéma complet, corps réponse, contenu artifact.

Dry-run expose désormais :

```text
structuredSchemaOneOfCount = 0
structuredSchemaProjection = anyOf-compatible
providerErrorMetadataCapture = ready
idempotencySaltPresent = <env>
```

Divergence de projection → `executable=false` (blocage avant provider).

---

## Salt / clés proposés

| Identité | Salt | Empreinte clé (sha256[:16]) |
|---|---|---|
| Run budget_exceeded | *(aucun)* | `abaa9c2886ef3d59` |
| Run request_failed | `10f-auth-b-20260810` | `3f39f808e266649c` |
| **Futur RETRY2** | **`10f-auth-b-retry2-20260810`** | **`0b7e8fb44e0acd4d`** |

Trois empreintes distinctes prouvées localement. Salt fourni **uniquement après autorisation** ; stable execute ↔ replay.

Futur run attendu :

```text
attempt_number = 1
retry_of_run_id = null
prompt = storyboard-analyzer-v2
schemas = 1.0.0 / 1.0.0
```

Pas de bump de prompt pour contourner l’idempotence.

---

## Dry-run / budget (contrat futur live)

```text
OpenAI / gpt-5.6 / medium / 4096
estimate = 13¢ = reservation
hard limit = 113¢
available = 20¢
maximum future calls = 1
retry / fallback / upstream / média / worker = bloqués
```

---

## Matrice d’ouverture / fermeture (future fenêtre)

| Flag | Pendant fenêtre | Après fermeture |
|---|---|---|
| Marketing / Creative / Script / Art AI | OFF | OFF |
| Storyboard AI | ON | OFF |
| PAID_GENERATION | OFF | OFF |
| Worker | OFF | OFF |

Fermeture obligatoire → runtime OFF prouvé.

---

## Livrables code

- `schema-projection.ts`, `local-json-schema.ts`, `provider-failure-evidence.ts`
- dry-run + analyze dry fields + route failed `providerMetadata`
- adapter : stage / attempts / duration / usagePresent
- tests parité / redaction / guards RETRY2
- script `phase-10f-retry2-prep-local.mjs`

---

## Non-faits (contraintes)

```text
NO PROVIDER CALL · NO PAID CALL · NO NEW STORYBOARD RUN
NO RESERVATION · NO LEDGER WRITE · NO ARTIFACT WRITE
NO VERCEL ENV WRITE · NO DEPLOY · NO BUDGET CHANGE
NO UPSTREAM REPLAY · NO MEDIA · NO WORKER · NO PUSH
```

---

## Suite autorisée

1. Autorisation de **push** (commits locaux dont PREP).
2. Deploy lignée post-fix (pas stale `ra6ulinwn` / `45tyuovgx`).
3. Pose salt `10f-auth-b-retry2-20260810` en Production.
4. Dry-run live gates (`oneOf=0`, `anyOf-compatible`, `metadata=ready`, salt present, estimate 13).
5. **Nouvelle** autorisation provider exacte (1 appel max) avant execute.
