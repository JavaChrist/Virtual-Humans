# 25 — Phase 10A-C — Vercel Kill Switch Reset

**Date :** 10 août 2026 (UTC ≈ 23:53Z)  
**Projet Vercel :** `javachrist-projects/virtual-humans` (`prj_NTK8yqoLHiXvBmqMLl98plAxGKdP`)  
**Autorisation :** UPDATE Vercel env flags listés uniquement  
**Entrée :** `24_PHASE_10AB_ENVIRONMENT_SAFETY.md` — blocker `R-10AB-01`

---

## Verdict

```text
R-10AB-01 = CLOSED
VERCEL_SAFE = YES
```

Signification stricte :

> les 10 kill switches Director V2 ont été **explicitement écrits à `0`** en Production et Preview.

Ne signifie **pas** : `READY_FOR_PRODUCTION` / providers validés / deploy effectué.

---

## Opération

```text
OPERATION=SET_TO_0
METHOD=vercel env update <key> <env> --value 0 --sensitive --yes
SUCCESS_OPS=20
FAILED_OPS=0
EXPECTED_OPS=20
```

| Variable | Production | Preview |
|---|---|---|
| `DIRECTOR_V2_ENABLED` | OK — LAST_EXPLICIT_WRITE=0 | OK — LAST_EXPLICIT_WRITE=0 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | OK | OK |
| `DIRECTOR_V2_WORKER_ENABLED` | OK | OK |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | OK | OK |
| `DIRECTOR_V2_PAID_AI_ENABLED` | OK | OK |
| `DIRECTOR_V2_MARKETING_AI_ENABLED` | OK | OK |
| `DIRECTOR_V2_CREATIVE_AI_ENABLED` | OK | OK |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | OK | OK |
| `DIRECTOR_V2_ART_AI_ENABLED` | OK | OK |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | OK | OK |

Preuve recherchée :

```text
VALUE_NOT_READABLE_BY_DESIGN
BUT_LAST_EXPLICIT_WRITE=0
```

(Variables restent `sensitive` — volontaire ; pas de relecture de valeur.)

---

## Variables non modifiées (hors scope)

Aucune écriture sur notamment :

- `APP_PASSWORD`, `APP_SESSION_SECRET`
- `DIRECTOR_V2_WORKER_SECRET`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`, `FAL_KEY`, `ELEVENLABS_*`
- tout autre env

Aucun Cron créé. `vercel.json` toujours absent.

---

## Prise d’effet / redeploy

D’après la doc Vercel : les changements d’Environment Variables s’appliquent aux **nouveaux** deployments uniquement ; les deployments déjà live conservent leurs valeurs d’origine.

```text
VERCEL_ENV_SAFE_FOR_NEXT_DEPLOYMENT
CURRENT_DEPLOYMENT_STATE_UNCHANGED
```

**Aucun redeploy** effectué en 10A-C.

---

## Operations NOT performed

```text
real provider call = NO
paid execution = NO
worker trigger = NO
Supabase mutation = NO
Storage mutation = NO
deploy = NO
commit = NO
push = NO
```

---

## Script

`studio/scripts/reset-vercel-kill-switches.mjs` — outil local de rejeu documenté (10A-C).
