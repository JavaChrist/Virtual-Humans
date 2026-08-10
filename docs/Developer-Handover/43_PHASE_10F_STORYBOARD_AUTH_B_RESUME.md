# 43 — Phase 10F-AUTH-B RESUME — Salt-Ready Storyboard Execute

**Date :** 10 août 2026  
**Entrée :** `42_PHASE_10F_STORYBOARD_AUTH_B.md` (BLOCKED stale deploy) · Auth A inchangée  
**Directeur :** Storyboard texte uniquement  
**Provider :** OpenAI (1 tentative échouée)  
**Plafond :** USD 1.00 (100¢) · **Appels max autorisés :** 1 · **Appels effectués :** **1** (`request_failed`)

---

## Verdict

```text
BLOCKED
```

Cause : runtime salt-ready prouvé ; execute unique → provider `request_failed` (HTTP 502) ; **0** storyboard ; ledger reserve 13 / release 13 / commit 0 ; **pas de relance**.

| Critère | Résultat |
|---|---|
| Déploiement lignée `d2mth5hp7` (pas `ra6ulinwn`) | **PASS** |
| Root Directory Vercel = `studio` | **PASS** |
| Salt support code + env Production | **PASS** |
| Dry-run `idempotencySaltPresent=true` | **PASS** |
| Empreintes clé 3f39… ≠ abaa… | **PASS** (run DB confirme) |
| 1 appel provider max, 0 relance | **PASS** |
| Storyboard persisté | **NON** |
| Runtime OFF après fermeture | **PASS** |

---

## Autorisation

Réutilisation de l’autorisation 10F-AUTH-B (tentatives antérieures à 0 provider).  
**Cette reprise a consommé l’appel provider autorisé.**

Salt (inchangé, non secret) : `10f-auth-b-20260810`

---

## Déploiement source

| Champ | Valeur |
|---|---|
| Promoted OFF avant reprise | `d2mth5hp7` (`dpl_DX8XMYnp3XRVAgaTF22uKjRy6TR4`) |
| Source push salt-ready | `ln0zu25ql` ← git `28be6b6` (inclut `82a6424` salt code) |
| Commit local doc `9394f3b` | **non déployé** (docs only) |
| Root Directory | **studio** |
| Redeploy ON | `im5dy49ry` (redeploy de `d2mth5hp7`, flags ON) |
| Stale interdit | `ra6ulinwn` **non utilisé** |
| Redeploy OFF | `ox4qwh5wf` (flags 0) |

Salt Production : **présent** (Encrypted, valeur non affichée).

---

## Preuve dry-run live (avant provider)

| Champ | Observé |
|---|---|
| providerCalled | false |
| executable / executionAvailable | true |
| **idempotencySaltPresent** | **true** |
| prompt / schema | `storyboard-analyzer-v2` / `1.0.0` |
| model / reasoning / maxTokens | `gpt-5.6` / medium / 4096 |
| estimate / réservation | 13¢ / 13¢ |
| available | 20¢ |
| newKeyFp / oldKeyFp | `3f39f808e266649c` / `abaa9c2886ef3d59` |

Script : `studio/scripts/phase-10f-authb-resume-dry-proof.mjs`  
Evidence : `studio/.tmp/phase-10f-authb-resume-dry.json`

---

## Execute unique

| Champ | Valeur |
|---|---|
| correlationId | `corr-10f-1786377255417-exec` |
| HTTP | **502** |
| code | `request_failed` |
| runId | `f5b75018-5aa1-4a16-97e1-7e515f94f106` |
| attempt / retry_of | **1** / **null** |
| estimated / actual | 13¢ / **null** |
| idempotency key fp | `3f39f808e266649c` (≠ budget_exceeded) |
| storyboard_project | **absent** |

### Ledger Auth B resume

| entry_type | amount |
|---|---:|
| reservation | 13 |
| release | 13 |
| commit | **0** |

Réservation status : **released**. Exposure commits workspace **inchangée (93¢)**.

### Run `b446a0ed` (immuable)

`failed` / `budget_exceeded` / actual null — inchangé.

---

## Validations / idempotence

Non exécutées (échec provider avant candidat). Idempotence N/A. **Aucune** seconde tentative.

---

## Fermeture

| Check | Résultat |
|---|---|
| Flags OFF script | SUCCESS_OPS=10 |
| Redeploy OFF | `ox4qwh5wf` |
| `CURRENT_RUNTIME_REAL_AI` | **OFF** |
| PAID_GENERATION / Worker | 0 |
| Amont hashes | inchangés ; storyboard absent |

---

## Suite

L’autorisation provider **est consommée**. Le salt `10f-auth-b-20260810` est lié au run terminal `f5b75018` (`request_failed`).

Diagnostic : `44_PHASE_10F_STORYBOARD_PROVIDER_DIAG.md` — cause = schéma Storyboard `oneOf` (`spokenContent`) rejeté par OpenAI strict ; fix local `oneOf→anyOf`. Future reauth = **nouvelle autorisation** + **nouveau salt** + deploy incluant le fix.
