# 188 — VHS Director persistence Production enablement preflight recheck

**Date :** 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER_NO_PRODUCTION_WRITE`  
**Nature :** recheck local lecture seule vis-à-vis de Production · harnais adversatif · **0** flag write · **0** deploy · **0** push · **0** correction métier  
**HEAD au départ :** `9dce256` · origin/main `baa92c4` · ahead/behind **3/0**  
**SHA servi Production :** `baa92c4` · alias `dpl_8Bq6MJ72…`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_BLOCKED_LOCAL_INTEGRATION_REQUIRED
SOURCE_HEAD=9dce256
ORIGIN_MAIN=baa92c4
AHEAD_BEHIND_AT_START=3/0
FUNCTIONAL_HARDENING=a785949
DOCUMENTATION_187=9dce256
DIRECTOR_ROUTES_CLASSIFIED=25
UNCLASSIFIED_DIRECTOR_ROUTES=0
ADVERSARIAL_EXECUTION_CASES_RUN=21
ADVERSARIAL_EXECUTION_CASES_PASSED=21
CAPABILITY_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0
BUDGET_RESERVATIONS_DURING_REFUSAL_TESTS=0
RUNS_CREATED_DURING_REFUSAL_TESTS=0
JOBS_CREATED_DURING_REFUSAL_TESTS=0
ATTEMPTS_CREATED_DURING_REFUSAL_TESTS=0
QUEUE_WRITES_DURING_REFUSAL_TESTS=0
STORAGE_READS_DURING_REFUSAL_TESTS=0
STORAGE_WRITES_DURING_REFUSAL_TESTS=0
SIGNED_URLS_CREATED=0
DOWNLOAD_BYTES_SERVED=0
HUMAN_REVIEWS_WRITTEN=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
LOCAL_DB_INTEGRATION_AVAILABLE=0
LOCAL_PROJECTS_CREATED=0
LOCAL_PROJECT_REPLAYS=0
LOCAL_REVISIONS_CREATED=0
LOCAL_CAS_CONFLICTS=0
LOCAL_CROSS_WORKSPACE_REFUSALS=0
DIRECTOR_PROJECT_QUOTA=50
DIRECTOR_PERSISTENCE_FLAG_WRITES=0
OTHER_FLAG_WRITES=0
DEPLOY_CALLS=0
GIT_PUSHES=0
PRODUCTION_PROJECTS_CREATED=0
PRODUCTION_BRIEFS_WRITTEN=0
PRODUCTION_ARTIFACTS_WRITTEN=0
PRODUCTION_SUPABASE_MUTATIONS=0
PRODUCTION_STORAGE_READS=0
PRODUCTION_STORAGE_WRITES=0
PRODUCTION_MIGRATIONS_APPLIED=0
PROVIDER_CALLS=0
REAL_GENERATIONS=0
REAL_LIPSYNC_SUBMITS=0
REAL_MERGES=0
REAL_EXPORTS=0
BUDGET_WRITES=0
PHASE_COST=0¢
AICCOS_FILES_STAGED=0
AICCOS_FILES_COMMITTED=0
RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED
```

---

## 1. Autorisation consommée

`AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER_NO_PRODUCTION_WRITE` — Christian, chat courant.

Aucun flag Vercel. Aucun déploiement. Aucun push. Aucune mutation Production. Aucune correction métier. AICCOS non touché. RideCloud apply non consommée.

`186_` et `187_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| origin/main / SHA servi | `baa92c4` | docs `185_` actuellement servie |
| Preflight `186_` | `4713d33` | local · non poussé |
| Hardening fonctionnel | `a785949` | **non poussé · non déployé** |
| Docs `187_` | `9dce256` | local · non poussé |
| Recheck `188_` | ce commit tests+docs | local · non poussé |

Ce n’est **pas** une ouverture persistence. Ce n’est **pas** une autorisation de sync/deploy du hardening.

---

## 2. Préconditions

| # | Contrôle | Résultat |
|---|---|---|
| 1–9 | Git : racine, fetch lecture, `main`, HEAD `9dce256`, origin `baa92c4`, ahead **3/0**, ordre `4713d33` → `a785949` → `9dce256`, index vide, dirty = 2 AICCOS | PASS |
| 10 | `a785949` unique commit fonctionnel hardening | PASS |
| 11 | Production sert `baa92c4` | PASS · `GET /api/version` `gitShaShort=baa92c4` · `buildId=dpl_8Bq6MJ72…` |
| 12 | Director UI-only ON | PASS · `GET /director` **307** → `/login?next=%2Fdirector` |
| 13 | Persistence Production OFF | PASS documentaire `185_` · SHA servi = tree pré-`a785949` · `/api/settings` **401** sans session (flags non relus) |
| 14–16 | AI/paid/worker/11A–11E/Motion OFF · `FORBIDDEN_ON=none` · `mergeExportAuthorized=false` | PASS documentaire `185_`/`187_` · 0 mutation |
| 17–20 | RideCloud suspendu · ledger 437/391/0/46 · aucune Auth provider · aucun média Production | PASS |

Docker CLI présent (`docker.exe`). **Daemon arrêté** (`npipe:////./pipe/dockerDesktopLinuxEngine` introuvable). Ports `54321`/`54322`/`54921` down. **Aucun** start Docker Desktop, **aucun** `supabase start`, **aucune** installation.

---

## 3. Politique centrale — revalidation code

Code réel `director-action-policy.ts` / `director-project-quota.ts` (tree `a785949`).

| Contrôle | Résultat |
|---|---|
| 25 routes classées | PASS · `DIRECTOR_ROUTES_CLASSIFIED=25` |
| 0 non classée | PASS |
| Action / route / mode inconnus | PASS · `classify` → `null` · 503 `director_route_unclassified` |
| Base read / write | PASS |
| Capability execution | PASS · 503 `director_capability_disabled` |
| Media delivery | PASS · 404 avant Storage |
| Guard avant effet | PASS sur Prompt / Routing / Production / Merge / Export / QC / HR / Download |

`NODE_ENV=test`, credentials, Storage configuré, `merge_ready` / artifacts amont **n’autorisent pas** l’exécution. Motion Review : `NODE_ENV=test` seul = OFF ; harness + `VERCEL=1` = OFF.

### Couverture HTTP vs services

Les 10 routes pipeline (prompts, routing, production, merge, export, download, quality, review, approvals, motion) appellent `authorizeDirectorAction` dans le fichier route.

Les 7 routes Directors texte n’appellent **pas** la politique centrale au niveau HTTP. Le refus est dans le service, **avant** `beginOrGet` / réserve, via `*_ai_disabled` / `canExecute*Ai`. Preuve sentinelle : 0 run, 0 budget, 0 provider. **Pas** un défaut d’exécution. Residual : centralisation HTTP incomplète — **contrat de correction distinct** si Léo l’exige ; **non réparé** ici.

---

## 4. Matrice adversariale

`ADVERSARIAL_EXECUTION_CASES_RUN=21` · `PASSED=21` · `CAPABILITY_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0`

| Cas | Statut attendu | Effet |
|---|---|---|
| Marketing / retry / Creative / Script / Art / retry / Storyboard execute | 503 service | 0 begin / 0 budget / 0 provider |
| Prompt execute (projet historique prêt) | 503 policy | 0 artifact |
| Routing execute + approve `generation_plan` | 503 | 0 approval |
| Mode / route inconnus | 503 unclassified | 0 |
| Production start | 503 | 0 réserve / run / job / enqueue |
| Merge prepare/execute · export execute | 503 | 0 Storage · `mergeExportAuthorized=false` |
| Download | 404 | 0 octet · 0 `assetContent.get` |
| Quality execute · HR APPROVE | 503 | 0 lifecycle · 0 activation |
| Motion `NODE_ENV=test` sans harness | 503 | 0 |

Toutes les sentinelles instrumentées sont restées à **0**.

---

## 5. Base locale durable — BLOQUANT READY

| Champ | Valeur |
|---|---|
| Moteur | Docker Desktop CLI présent · **daemon OFF** |
| Supabase local | **non démarré** · `ECONNREFUSED 127.0.0.1:54321` |
| `npx supabase status` | échec |
| `SUPABASE_LOCAL_INTEGRATION` | non activé |
| Migrations locales appliquées cette porte | **0** |
| Base temporaire isolée | **aucune** |

Scénario obligatoire create / replay / CAS / quota 49→50 / concurrence / isolation workspace / rollback persistence OFF **non exécuté**.

Playwright persistence-only **4/4** : UI, copies, logout, mobile, barrière réseau. Le test « création locale… » a **skippé** le chemin durable (`list !== 200`). **Ne pas présenter comme relancé.**

Preuve durable historique `186_` / VHS-116 **conservée**, **non relancée**.

`LOCAL_DB_INTEGRATION_AVAILABLE=0` ⇒ verdict READY **interdit** par l’Auth.

---

## 6. Production lecture seule

| Check | Résultat |
|---|---|
| `GET /api/version` | 200 · `gitShaShort=baa92c4` · `buildId=dpl_8Bq6MJ72…` · `environment=production` |
| `GET /director` sans session | **307** `/login?next=%2Fdirector` |
| `GET /api/director/projects` sans session | **401** |
| `GET /api/settings` sans session | **401** |
| 5xx nouveau | **aucun** observé |
| Write Production | **0** |

---

## 7. Validations exécutées

| Check | Résultat |
|---|---|
| Harnais adversatif `persistence-preflight-recheck.test.ts` | **6/6** |
| Suite unitaire | **2064/2064** |
| Typecheck | PASS |
| Lint | 0 error · 35 warnings préexistants |
| `next build` local | PASS |
| Playwright persistence-only 3113 | **4/4** · durable **skippé** · barrière propre |
| Intégration DB locale | **NON DISPONIBLE** |
| Fraîcheur living handover | PASS après ce commit docs |
| Secret scan (`findSecretHits` living + harnais) | 0 hit attendu |
| Provider | **0** |

Non relancés : pgTAP 378 · DB integration 33 · quota concurrent réel · CAS durable · rollback DB.

---

## 8. Risques / contrat

| Point | Gravité | Action |
|---|---|---|
| Intégration durable locale absente | **bloque READY** | Humain : démarrer Docker Desktop, `npx supabase start` depuis `studio/`, **re-autoriser ce recheck** |
| Quota check-then-act | faible | déjà documenté `187_` · non rejoué sur DB |
| Routes texte hors `authorizeDirectorAction` HTTP | residual | 0 effet · ne pas corriger sans Auth séparée |
| Flag persistence Production | OFF | ne pas écrire |

Aucun défaut d’exécution persistence-only n’a été trouvé dans les tests in-memory. **Cela ne suffit pas** pour `READY_FOR_HARDENING_SYNC_AND_DEPLOY_AUTH`.

---

## 9. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_AFTER_LOCAL_SUPABASE_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER
```

Préalable humain : Docker Desktop **running** + Supabase local isolé du projet. Puis rejouer **ce même recheck** (scénario durable obligatoire). Toujours **0** flag write, **0** write Production.

Après un futur READY seulement : sync+deploy du hardening `a785949` avec persistence **toujours OFF**. Le flag persistence exige ensuite `READY_FOR_FLAG_AND_WRITE_AUTH`.

---

## 10. Verdict

```text
VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_BLOCKED_LOCAL_INTEGRATION_REQUIRED
```
