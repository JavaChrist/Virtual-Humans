# 189 — VHS Director persistence Production enablement preflight recheck after local Supabase

**Date :** 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_AFTER_LOCAL_SUPABASE_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER`  
**Nature :** recheck durable sur Supabase **local isolé** · **0** flag write · **0** deploy · **0** push · **0** code métier · **0** moteur  
**HEAD au départ :** `732875c` · origin/main `baa92c4` · ahead/behind **4/0**  
**SHA servi Production :** `baa92c4` · alias `dpl_8Bq6MJ72…`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_AFTER_LOCAL_SUPABASE_READY_FOR_HARDENING_SYNC_AND_DEPLOY_AUTH
SOURCE_HEAD=732875c
ORIGIN_MAIN=baa92c4
AHEAD_BEHIND_AT_START=4/0
FUNCTIONAL_HARDENING=a785949
DOCUMENTATION_187=9dce256
DOCUMENTATION_188=732875c
LOCAL_DB_INTEGRATION_AVAILABLE=1
PERSISTENCE_DURABLE_E2E_SKIPPED=0
LOCAL_SUPABASE_STARTED=0
LOCAL_MIGRATIONS_VISIBLE=33
LOCAL_WORKSPACES_CREATED=3
LOCAL_PROJECTS_CREATED=103
LOCAL_PROJECT_REPLAYS=2
LOCAL_PROJECT_CONFLICTS=1
LOCAL_REVISIONS_CREATED=1
LOCAL_REVISION_REPLAYS=1
LOCAL_CAS_CONFLICTS=1
LOCAL_CROSS_WORKSPACE_REFUSALS=2
LOCAL_QUOTA_REFUSALS=1
LOCAL_RATE_LIMIT_REFUSALS=1
DIRECTOR_PROJECT_QUOTA=50
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
DOWNLOAD_BYTES_SERVED=0
HUMAN_REVIEWS_WRITTEN=0
SIGNED_URLS_CREATED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
PROVIDER_NETWORK_ATTEMPTS=0
PRODUCTION_SUPABASE_ATTEMPTS=0
PRODUCTION_STORAGE_ATTEMPTS=0
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
RIDECLOUD_MIGRATIONS_APPLIED_PRODUCTION=0
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

`AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_AFTER_LOCAL_SUPABASE_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER` — Christian, chat courant. Docker Desktop confirmé **running**.

Aucun flag Vercel. Aucun déploiement. Aucun push. Aucune mutation Supabase Production. Aucune correction métier. AICCOS non touché. RideCloud apply non consommée. `186_` / `187_` / `188_` restent des snapshots immuables.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| origin/main / SHA servi | `baa92c4` | docs `185_` actuellement servie |
| Preflight `186_` | `4713d33` | local · non poussé |
| Hardening fonctionnel | `a785949` | **non poussé · non déployé** |
| Docs `187_` | `9dce256` | local · non poussé |
| Recheck bloqué `188_` | `732875c` | local · non poussé |
| Recheck durable `189_` | ce commit tests+docs | local · non poussé |

Ce n’est **pas** une ouverture persistence. Ce n’est **pas** l’exécution de la porte sync/deploy.

---

## 2. Préconditions

| # | Contrôle | Résultat |
|---|---|---|
| 1–9 | Git : racine, fetch lecture, `main`, HEAD `732875c`, origin `baa92c4`, ahead **4/0**, ordre `4713d33` → `a785949` → `9dce256` → `732875c`, index vide, dirty = 2 AICCOS | PASS |
| 10–12 | Docker Client/Server `29.6.2` · daemon OK · contexte `desktop-linux` npipe local · Swarm inactive | PASS |
| 13–18 | Commande depuis `studio/` · `config.toml` `virtual-humans-studio-local` ports `54321`/`54322` · aucun `supabase.co` · aucune credential Production injectée | PASS |
| 19–20 | Production UI-only ON · persistence OFF · RideCloud suspendu · ledger 437/391/0/46 | PASS lecture seule |

Stack déjà saine : **aucun** `supabase start` inutile, **aucun** reset, **aucun** prune, **aucun** volume rm. `LOCAL_SUPABASE_STARTED=0`.

---

## 3. Identification de la stack locale

| Champ | Valeur (sans secret) |
|---|---|
| Docker | Client/Server `29.6.2` · Name `docker-desktop` · contexte `desktop-linux` |
| Supabase CLI | `2.116.0` |
| Projet local | `virtual-humans-studio-local` |
| API | `127.0.0.1:54321` |
| DB | `127.0.0.1:54322` |
| Studio | `127.0.0.1:54323` |
| Conteneurs | kong / db / auth / rest / realtime / storage / studio / pg_meta / inbucket — **healthy** |
| Lien distant | **aucun** · `REMOTE_SUPABASE_CO_IN_STATUS=no` |
| Migrations fichiers | **33** · dernière `20260827133000_vhs_ridecloud_bind_artifact_kinds.sql` |
| Apply RideCloud Production | **0** |

Service-role, anon, JWT, mot de passe et DSN **non imprimés**.

---

## 4. Schéma local

Tables Director, RPC `create_director_project_with_brief` et `revise_project_brief` présentes (sondes invalides → `workspace_not_found` / `invalid_*`, pas « function missing »). Contraintes / RLS / grants inchangés. Catalogue fichiers = 33.

`LOCAL_MIGRATIONS_VISIBLE=33`  
`PRODUCTION_MIGRATIONS_APPLIED=0`  
`RIDECLOUD_MIGRATIONS_APPLIED_PRODUCTION=0`

La migration RideCloud **locale** peut être appliquée par le start canonique. Ce n’est **pas** un apply Production.

---

## 5. Scénario durable (fixtures `vhs-persistence-recheck-189`)

Workspaces A / B / race — UUID aléatoires — texte synthétique — **0** média — **0** ID 11A/11B/11C/RideCloud.

| Étape | Résultat |
|---|---|
| Create projet + brief rev.1 atomique | PASS |
| Replay identique → `existing` · 0 doublon | PASS |
| Même projectId / brief différent → conflit | PASS |
| List résumé sans média ni prompt | PASS |
| Get + refresh/reprise | PASS |
| Révision CAS → rev.2 monotone | PASS |
| Replay révision → 0 3ᵉ brief | PASS · 2 artifacts brief |
| Révision stale → conflit | PASS |
| Active artifact revision = 2 | PASS |
| Lecture A depuis B → `not_found` | PASS |
| Mass assignment `workspace_id` / published / lifecycle | ignoré · projet reste dans A · draft |
| Fixture historique listable/consultable | PASS |
| Prompt / Routing / approve / Production / Merge / Export / QC / HR / Download | **tous failed avant effet** |
| Download | failed · `httpHint=404` · 0 Storage |
| Sentinelles workspace avant/après execute | identiques (0 run / job / attempt / budget) |
| Logout / accès refermé | PASS Playwright |

Cleanup : `cleanupWorkspace` sur les **3** workspace IDs de cette phase uniquement.

---

## 6. Quota 50 et concurrence

| Étape | Résultat |
|---|---|
| Remplir à 49 | PASS |
| 50ᵉ create | PASS |
| Replay ID existant au quota | `existing` |
| 51ᵉ | `director_project_quota_exceeded` · 0 création partielle |
| Archive via `saveStatus` ciblé | exclu du quota · create suivant OK |
| Workspace B indépendant | PASS |
| Course à 49 · 2 IDs distincts | **2 created / 0 refused** · count **51** |

La course a produit le **dépassement documenté attendu** (check-then-act). Aucune corruption, aucun doublon d’ID, aucun brief orphelin.  
`DIRECTOR_PROJECT_QUOTA.atomic=false`  
`blocksSingleTenantActivation=false` **reste acceptable**.

Ne pas présenter le quota comme atomique.

---

## 7. Rate limit create 20/min

Playwright persistence-only, IP isolée `203.0.113.189` :

- requêtes sous limite : 200/409 ou 400 de validation ;
- limite atteinte : **429** + `Retry-After` > 0 ;
- replay idempotent sous limite : OK ;
- GET inchangé : **200** après 429.

`LOCAL_RATE_LIMIT_REFUSALS=1`

---

## 8. Matrice adversariale

`ADVERSARIAL_EXECUTION_CASES_RUN=21` · `PASSED=21` · `CAPABILITY_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0`

Rejeu du harnais `188_` inchangé (UI+persistence ON, capabilities OFF, harness OFF). 21/21 refusés. 0 effet.

Residual inchangé : 7 routes Directors texte n’appellent pas `authorizeDirectorAction` au HTTP ; le service refuse avant `beginOrGet`. **Non réparé.**

---

## 9. Playwright persistence-only 3113

**5/5** · `PERSISTENCE_DURABLE_E2E_SKIPPED=0`

Le skip `list !== 200` a été **retiré** (fail-closed). Create / replay / liste / `/director/:id` / refresh / revise / conflit stale / actions disabled / 0 execute / 0 provider / 0 download / mobile / logout.

Barrière réseau propre. `spendSummary` local `vh_spend` 42501 = lecture budget legacy, **0** write.

Headroom quota e2e : archivage **ciblé** des IDs actifs du seul workspace `e2e-3319367a` (helper `e2e-prepare --ensure`).

---

## 10. Rollback logique

Serveur applicatif **ui-only** port **3114** (Supabase **non arrêté**) :

- `GET /api/director/projects` authentifié → **404**
- `GET` projet fixture → **404**
- wizard persistence OFF visible · 0 provider
- ligne `video_projects` **conservée**
- 0 delete

---

## 11. Production lecture seule

| Check | Résultat |
|---|---|
| `GET /api/version` | 200 · `gitShaShort=baa92c4` · `buildId=dpl_8Bq6MJ72…` · `environment=production` |
| `GET /director` | **307** `/login?next=%2Fdirector` |
| `GET /api/director/projects` | **401** |
| `GET /api/settings` | **401** |
| Write Production | **0** |

`FORBIDDEN_ON` non relu (settings 401 sans session). SHA servi = tree pré-`a785949` ⇒ persistence Production **OFF** documentaire.

---

## 12. Validations

| Check | Résultat |
|---|---|
| Intégration DB locale | **35/35** |
| migrations-static | PASS (unité) |
| RPC create/revise | PASS |
| Durable / idempotence / CAS / isolation / quota / course | PASS |
| Rate limit HTTP | PASS Playwright |
| Adversarial 21 | PASS |
| Motion `NODE_ENV=test` sans harness | PASS (unité) |
| Blockers app-update | PASS (unité existante) · 0 SKIP_WAITING automatique |
| Playwright 3113 | **5/5** · durable **non skippé** |
| Rollback logique | PASS |
| Barrière réseau | 0 tentative hors allowlist |
| Unitaires | **2065/2065** |
| Typecheck | PASS |
| Lint | 0 error · 35 warnings préexistants |
| `next build` local | PASS |
| Secret scan living | 0 hit attendu |

---

## 13. État final stack

| Champ | Valeur |
|---|---|
| Docker Desktop | **running** (non arrêté) |
| Supabase local | **running** · volumes conservés |
| Fixtures `189` dédiées | **nettoyées** (`cleanupWorkspace` IDs exacts + rollback) |
| Workspace e2e | **conservé** · excédents archivés (headroom) |

---

## 14. Risques / residual

| Point | Gravité | Action |
|---|---|---|
| Quota check-then-act (course → 51) | faible · documenté | acceptable single-tenant · ne pas vendre comme atomique |
| Routes texte hors policy HTTP | residual | 0 effet · contrat distinct |
| Flag persistence Production | OFF | ne pas écrire pendant le sync/deploy |

Aucun défaut d’exécution persistence-only. Hardening `a785949` **confirmé** sur base locale fraîche.

---

## 15. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_SYNC_AND_DEPLOY_NO_FLAG_WRITE_NO_PROVIDER
```

Pousser et déployer les commits locaux jusqu’à `189_` avec persistence Production **toujours OFF**. Vérifier le hardening sur le build Production en lecture seule. **Ensuite seulement** une Auth humaine distincte pour activer persistence avec un nombre borné d’écritures.

Aucun provider. Aucun runtime réel.

---

## 16. Verdict

```text
VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_AFTER_LOCAL_SUPABASE_READY_FOR_HARDENING_SYNC_AND_DEPLOY_AUTH
```
