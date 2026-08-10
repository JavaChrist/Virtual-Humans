# 26 — Phase 10A-D — Local DB Validation + Safe Vercel Redeploy

**Date :** 10 août 2026  
**Entrée :** 10A / 10A-B / 10A-C (`VERCEL_SAFE`, `CURRENT_DEPLOYMENT_STATE_UNCHANGED`)  
**Périmètre :** validation Docker locale + redeploy Vercel sans mutation d’env / sans provider

---

## Executive Summary

### Verdict

```text
GO_FOR_10B
```

Signification stricte :

> autorisé à **préparer** le premier smoke test provider texte contrôlé (autorisation humaine séparée).

Ne signifie **pas** : production complète validée, providers validés, migrations distantes, ou restore prouvé.

| Gate | Résultat |
|---|---|
| Docker | **PASS** (daemon 29.6.2 — démarré pour la session) |
| `.env.local` local-only | **PASS** (`127.0.0.1:54321`, flags paid/AI/worker=0, `VH_ALLOW_REMOTE_SUPABASE=0`) |
| `db reset` | **PASS** (29 migrations, incl. `vhs_133`/`vhs_134`) |
| Migration history | **PASS** (`HISTORY_ALIGNED=YES` 29/29) |
| pgTAP | **PASS** (`378` tests, `Result: PASS`) |
| DB integration | **PASS** (`33/33`) |
| Guard / migrations static (unit) | **PASS** (suite 1016 verts) |
| Preuve 10A-C kill switches | **PASS** (`LAST_EXPLICIT_WRITE=0` ×20 — doc 25) |
| Redeploy Production | **PASS** (Ready ~6m, alias `virtual-humans.vercel.app`) |
| Smoke non payant | **PASS** |
| Providers / jobs média | **0** constatés |
| Remote write volontaire | **NO** |

```text
LOCAL_DB_RESET = PASS
MIGRATION_HISTORY = PASS
PGTAP = PASS
DB_INTEGRATION = PASS
REMOTE_WRITE = NO
CURRENT_VERCEL_RUNTIME_KILL_SWITCHES_APPLIED = YES
```

---

## Étape A — Docker / migrations

### Ports locaux (ajustement 10A-D)

Les ports `54921–54923` sont entrés dans une plage d’exclusion Hyper-V (`54852–55557`).  
`supabase/config.toml` + `.env.local` basculés vers **54321 / 54322 / 54323** (libres). Local uniquement.

### db reset

Toutes les migrations appliquées jusqu’à :

```text
20260807213624_vhs_133_art_human_retry_input_artifact.sql
20260807213803_vhs_134_legacy_art_timeout_retry.sql
```

`Finished supabase db reset` — exit 0.

### Preuve fonctionnelle vhs_133 / vhs_134

Au-delà de l’alignement nominal 29/29 :

- apply local sans erreur des deux migrations renommées ;
- pgTAP vert sur la suite retry (VHS-128…132) dépendante du même mécanisme ;
- intégration `VHS-128` / `VHS-129` (retry humain) **PASS**.

### Compteurs tests

| Suite | Résultat |
|---|---|
| `npx supabase test db` | 20 fichiers / **378** tests / PASS |
| `npm run test:integration:db` | **33/33** PASS |
| Unitaires (incl. migrations-static + guard) | **1016/1016** PASS |

---

## Étape B — Safe Redeploy

### Préconditions

- Étape A verte.
- Doc 25 : 10 flags × Production+Preview = 20× `LAST_EXPLICIT_WRITE=0`.
- **Aucune** réécriture d’env en 10A-D.

### Redeploy

```text
source: https://virtual-humans-blatj55uc-javachrist-projects.vercel.app
command: vercel redeploy … --target production
new:    https://virtual-humans-3kek6e2r5-javachrist-projects.vercel.app
alias:  https://virtual-humans.vercel.app
status: Ready (~6m)
```

```text
VERCEL_ENV_SAFE_FOR_NEXT_DEPLOYMENT → applied by this redeploy
CURRENT_VERCEL_RUNTIME_KILL_SWITCHES_APPLIED = YES
```

(Les deployments antérieurs conservent leurs anciennes env ; le runtime alias Production pointe désormais sur le nouveau deployment.)

---

## Smoke non payant (post-deploy)

Base : `https://virtual-humans.vercel.app`

| Check | Résultat |
|---|---|
| `GET /login`, `/offline` | 200 |
| `GET /`, `/characters`, `/image`, `/voice`, `/video`, `/storyboard`, `/director`, `/director/new` | 307 → `/login?next=…` (auth fail-closed) |
| `GET /api/director/projects` | 401 |
| `GET …/director-worker/run-once` | 405 |
| `POST …/director-worker/run-once` (sans secret) | 401 `providerCalled:false` |

Aucune navigation n’a déclenché de production / worker / provider.

### Supabase Production (lecture seule, avant → après)

| Table | Avant | Après |
|---|---:|---:|
| director_runs | 13 | 13 |
| cost_ledger | 33 | 33 |
| budget_reservations | 13 | 13 |
| production_jobs | 0 | 0 |
| production_runs | 0 | 0 |
| assets | 0 | 0 |

```text
provider calls = 0 (cette phase)
paid generations = 0
worker execution = 0
media jobs = 0
remote migration apply = 0
intentional Production DB mutation = 0
```

---

## Backup / Restore

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```

| Question | Décision 10A-D |
|---|---|
| Bloque 10B smoke texte contrôlé (1 appel, flags bornés) ? | **Non** (P1 accepté avec kill switches + plafond) |
| Bloque mutation distante invasive (migrations, bulk, restore) ? | **Oui** — preuve restore requise avant |

---

## Risques restants

| ID | Sévérité | Statut |
|---|---|---|
| R-10AB-01 Vercel flags | P0 | **CLOSED** (10A-C + redeploy 10A-D) |
| R-10AB-03 Docker/db reset post-133/134 | P1 | **CLOSED** (cette phase) |
| R-10AB-02 / R-10A-04 Backup restore | P1 | **OUVERT** — bloque ops invasives, pas le smoke texte 10B |
| VHS-005 / VHS-006 | P1 | Partiels — protocole min 10B documenté en 24 |

**Aucun P0 ouvert.**

---

## Operations NOT performed

```text
Vercel env mutation: NO
provider call: NO
paid execution: NO
worker trigger: NO
Production DB write: NO
Storage write: NO
remote migration / db push: NO
cron: NO
commit: NO
push: NO
```

---

## STOP

Phase 10A-D terminée.  
**Suite :** Phase 10B exécutée — voir `27_PHASE_10B_FIRST_REAL_TEXT_SMOKE.md` (`PASS`).
