# 36 — Phase 10E-RETRY-PREP — New Art Execute under `art-analyzer-v3`

**Date :** 10 août 2026  
**Entrée :** `35_PHASE_10E_ART_INVALID_CANDIDATE_DIAG.md` (`READY_FOR_RETRY_PREP`, commit `74324e3`)  
**Directeur :** Art texte uniquement — **nouvel execute** (pas `/art/retry`)  
**Provider calls :** **0**  
**Média / jobs / worker :** **0**

---

## Verdict

```text
READY_FOR_HUMAN_AUTH
```

Aucun appel Art réel durant PREP. Suite execute : **PASS** — `37_PHASE_10E_ART_V3_NEW_EXECUTE.md`.

---

## Audit nouvel execute vs run v2

| # | Preuve |
|---|---|
| 1 | Clé/fingerprint v3 ≠ v2 (`art-analyzer-v3:1.1.0` vs `art-analyzer-v2:1.1.0`) — préfixes hash distincts |
| 2 | `begin_or_get_art_director_run` indexe par `idempotency_key` ; failed v2 sous autre clé → **ignoré** ; même clé failed → `director_run_terminal_reuse` (non applicable ici) |
| 3 | Futur run : `attempt_number=1` |
| 4 | `retry_of_run_id=null` |
| 5 | Provenance : `prompt_version` / `schema_version` / correlation / run id distincts |
| 6 | Ledger v2 final : reserve 13 / commit **12** / release 1 — `cost_status=committed` |
| 7 | Nouvelle estimate/réservation indépendantes (dry-run local **13¢**) |
| 8 | Aucun chemin PREP ne mute `53fb45c3-…` |
| 9 | Path = `POST /art` ; `/art/retry` interdit (`invalid_candidate` hors allowlist + mismatch contrat) |
| 10 | Replay post-succès : `phase-10e-v3-replay-idempotence.mjs` → `POST /art` → `existing` (même clé v3) |

Run v2 immuable :

```text
id = 53fb45c3-0d36-43d9-9882-6a96fde2a814
prompt = art-analyzer-v2
status = failed
error = invalid_candidate
actual = 12¢
```

---

## Dry-run v3 (local, sans provider)

| Champ | Valeur |
|---|---|
| provider | OpenAI |
| model | `gpt-5.6` |
| reasoningEffort | `medium` |
| maxOutputTokens | 4096 |
| promptVersion | **`art-analyzer-v3`** |
| schemaVersion | **`1.1.0`** (candidat) |
| VisualDirection schema | `1.0.0` (artifact final) |
| idempotencyKeyVersion | `art-analyzer-v3:1.1.0` |
| previousFailedRunIgnoredForNewContract | **true** |
| providerCalled | false |
| executable | true |
| pricingConfigured | true |
| estimatedCostMinor | **13** |
| reservationPlanned | **13** |
| proposedCeilingMinor | **100** |
| retryCandidate | absent |
| characterId | null (snapshot N/A) |
| segments | 5 |
| visual_direction actif | absent |

API dry-run expose désormais aussi `provider`, `idempotencyKeyVersion`, `previousFailedRunIgnoredForNewContract`.

Confiance knobs Production : **à confirmer** sur dry-run live après deploy du code v3 + ouverture flags. Divergence → stop avant provider.

---

## Contrat prompt v3 (tests)

- `continuityKey` canonique exigée  
- même clé pour lieu stable required  
- variation visuelle (caméra/lumière) ≠ nouveau lieu  
- rupture de lieu via preferred / wording rupture  
- 5 segments amont  
- `characterId=null` → pas d’obligation snapshot / pas d’IDs inventés  
- compatible `ArtAnalysisCandidateSchema 1.1.0` → `VisualDirectionSchema 1.0.0`

---

## Scripts / confirmations futures

```text
PHASE_10E_V3_SMOKE_CONFIRM=ONE_NEW_ART_V3_CALL_MAX_100_CENTS
PHASE_10E_V3_ALLOW_EXECUTE=1
PHASE_10E_V3_DRY_ONLY=0
CONFIRM_PHASE_10E_VERCEL_FLAGS=1
```

| Script | Rôle |
|---|---|
| `phase-10e-v3-prep-art-dry-run.mjs` | PREP local (cette phase) |
| `smoke-phase-10e-v3-art-vercel.mjs` | dry-run live / futur execute |
| `phase-10e-v3-replay-idempotence.mjs` | replay post-succès |
| `phase-10e-set-art-flags.mjs` | on/off (bloqué si `CONFIRM_PHASE_10E_V3_PREP=1` + on) |
| `phase-10e-verify-flags-off.mjs` | preuve OFF |

Guards : max 1 nouvel appel Art ; `/art/retry` interdit ; Marketing/Creative/Script/Storyboard/média/worker OFF ; fermeture flags obligatoire même si rejet.

---

## Autorisation humaine exacte requise

```text
J’autorise la Phase 10E-V3 : un seul nouvel appel Art texte sous art-analyzer-v3,
modèle gpt-5.6, estimate/réservation 13¢ sous réserve de confirmation identique
au dry-run live, plafond absolu 100¢, écritures Production bornées
(visual_direction + provenance + ledger), run v2 failed immuable, sans /art/retry,
PAID_GENERATION et worker OFF, fermeture immédiate des flags.
```

Confirmations :

```text
PHASE_10E_V3_SMOKE_CONFIRM=ONE_NEW_ART_V3_CALL_MAX_100_CENTS
PHASE_10E_V3_ALLOW_EXECUTE=1
PHASE_10E_V3_DRY_ONLY=0
CONFIRM_PHASE_10E_VERCEL_FLAGS=1
```

---

## Validations PREP

| Check | Résultat |
|---|---|
| Unitaires | **1051/1051** |
| Typecheck | PASS |
| Lint | 0 erreur |
| Build | PASS |
| Syntax scripts | PASS |
| Runtime OFF | PASS |
| Provider / runs / artifacts / ledger nouveaux | **0** |
| Remote writes | **0** (lectures redacted seulement) |
| Push | non |
