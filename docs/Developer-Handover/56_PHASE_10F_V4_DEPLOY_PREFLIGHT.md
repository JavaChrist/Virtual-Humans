# 56 — Phase 10F-V4-DEPLOY-PREFLIGHT

**Date :** 11 août 2026  
**Entrée :** `55_PHASE_10F_V4_BUDGET_AND_PUSH.md` + runtime source `90fb6fb`  
**Provider calls :** **0**  
**Execute / réservation / ledger / artifact :** **0**

---

## Verdict

```text
READY_FOR_PROVIDER_REAUTH
```

Salt v4 posé ; code `90fb6fb` déployé ; dry-run live gates v4 verts (24/9/5 / fp `9d34b42ddc3bb85c`) ; runtime refermé OFF.

---

## Commit docs Budget/Push (local, non poussé)

| Champ | Valeur |
|---|---|
| Commit | `ad168f6` — `docs(studio): record phase 10F v4 budget and push` |
| Fichiers | `55_…`, BACKLOG, CHANGELOG, CHECKLIST |
| Source runtime | **`90fb6fb` uniquement** (docs local non déployé) |
| Working tree avant deploy | **clean** (après `ad168f6`) |

---

## Préconditions

| Check | Résultat |
|---|---|
| `origin/main` = `90fb6fb` | PASS |
| hard=122 / committed=107 / reserved=0 / available=15 | PASS |
| Runtime OFF avant fenêtre | PASS |
| Storyboard actif | **absent** |
| Runs failed immuables | `b446a0ed` / `f5b75018` / `4914c203` / `60a1d9c6` |

---

## Salt

```text
DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT = 10f-storyboard-v4-20260811
```

| Champ | Valeur |
|---|---|
| present (dry-run) | **true** |
| salt fingerprint (sha256[:16]) | `05be5ef9a08d005f` |
| distinct vs v3 salt fp | `9c9caf71f362b178` — **oui** |
| newKeyFingerprint | `801c34a1080bbcf0` |
| distinct vs 4 failed | `abaa…` / `3f39…` / `0b7e…` / `1bf9…` |

Valeur salt non affichée hors preuve fingerprint. Salt peut rester présent après fermeture.

---

## Déploiements

| Étape | URL courte | Notes |
|---|---|---|
| Source git-main `90fb6fb` | `huzb59prs` | build post-push |
| Redeploy ON (salt + flags) | **`osaz404ey`** | alias Production pendant dry-run |
| Redeploy OFF | **`eeczhjco7`** | alias Production final (`dpl_6G8tgzeZh…`) |
| Root Directory | **studio** | confirmé (Next.js / entrypoint `.`) |
| Stale interdit | builds hors `90fb6fb` | **non utilisés** |

Preuve code v4 live : dry-run expose `promptVersion=storyboard-analyzer-v4`, mapping mandatory (24 slots / 9 uniques / 5 scopes / coverage=complete / tokensFp=`9d34b42ddc3bb85c`), `structuredSchemaOneOfCount=0`, `structuredSchemaProjection=anyOf-compatible`, `providerErrorMetadataCapture=ready`.

---

## Matrice temporaire

| Flag | Pendant dry-run | Après fermeture |
|---|---|---|
| Marketing / Creative / Script / Art AI | 0 | 0 |
| Storyboard AI + Director + Persistence + Paid AI | 1 | 0 |
| PAID_GENERATION / Worker | 0 | 0 |

SUCCESS_OPS ON=10 ; SUCCESS_OPS OFF=10.

---

## Dry-run live

| Champ | Observé |
|---|---|
| correlationId | `corr-10f-v4-1786408067635-dry` |
| HTTP | 200 |
| providerCalled | **false** |
| executable / executionAvailable | **true** |
| prompt / schemas | `storyboard-analyzer-v4` / `1.0.0` / `1.0.0` |
| idempotencyKeyVersion | `storyboard-analyzer-v4:1.0.0` |
| continuitySemantics | `mandatory-projected-tokens` |
| provider / model / reasoning / maxTokens | openai / `gpt-5.6` / medium / 4096 |
| estimate / réservation prévue | **13¢** / **13¢** |
| budget | hard **122** / committed **107** / reserved **0** / available **15** |
| mandatory slots / unique / scopes | **24** / **9** / **5** |
| scopes (exact) | `lighting`, `location`, `palette`, `product`, `screen_direction` |
| coverage | **complete** |
| tokens fingerprint | `9d34b42ddc3bb85c` |
| oneOf / anyOf / metadata | 0 / anyOf-compatible / ready |
| salt present | true |
| newKeyFingerprint | `801c34a1080bbcf0` |
| existingStoryboard | false |

Script : `studio/scripts/phase-10f-v4-deploy-dry-proof.mjs`  
Evidence : `studio/.tmp/phase-10f-v4-deploy-dry.json`

### DB post dry-run

| Check | Résultat |
|---|---|
| Nouveaux director_runs (30 min) | **0** |
| Nouveaux ledger (30 min) | **0** |
| storyboard actif | **0** |
| Budget | 122 / 107 / 0 / 15 **inchangé** |
| Runs prior | 4× `failed` inchangés |

Script : `studio/scripts/phase-10f-v4-post-dry-db-check.mjs`

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags OFF script | SUCCESS_OPS=10 |
| Redeploy OFF | `eeczhjco7` |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** |
| Storyboard execution | unavailable (404 persistence) |
| PAID_GENERATION / Worker | 0 |
| Salt | reste présent (OK) |

---

## Suite

Autorisation provider Storyboard v4 encore requise :

```text
ONE_STORYBOARD_CALL_MAX_13_CENTS_PROMPT_V4_SALT_10f-storyboard-v4-20260811
```

- 1 appel max ;
- salt `10f-storyboard-v4-20260811` ;
- attempt 1 / retry_of null ;
- estimate/réservation 13¢ ;
- fermeture OFF systématique.

**Aucun execute dans cette phase.**
