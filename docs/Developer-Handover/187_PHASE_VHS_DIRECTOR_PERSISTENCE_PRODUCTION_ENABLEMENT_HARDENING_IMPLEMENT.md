# 187 — VHS Director persistence Production enablement hardening

**Date :** 2026-08-28  
**Auth :** `AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_IMPLEMENT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER`  
**Nature :** hardening local · code + tests + documents · **0** flag write · **0** deploy · **0** push · **0** mutation Production  
**HEAD au départ :** `4713d33` · origin/main `baa92c4` · ahead/behind **1/0**  
**SHA servi Production :** `baa92c4` · alias `dpl_8Bq6MJ72…`  
**RideCloud apply :** **suspendue, non consommée**

```text
VERDICT = VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENED_READY_FOR_PREFLIGHT_RECHECK
SOURCE_HEAD=4713d33
ORIGIN_MAIN=baa92c4
AHEAD_BEHIND_AT_START=1/0
FUNCTIONAL_COMMIT=a785949
DOCUMENTATION_COMMIT=pending
PERSISTENCE_POLICY_MODULES_CREATED=2
DIRECTOR_ROUTES_CLASSIFIED=25
UNCLASSIFIED_DIRECTOR_ROUTES=0
CAPABILITY_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0
PROMPT_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0
ROUTING_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0
PRODUCTION_STARTS_ALLOWED_WITH_PERSISTENCE_ONLY=0
MERGE_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0
EXPORT_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0
QUALITY_EXECUTIONS_ALLOWED_WITH_PERSISTENCE_ONLY=0
HUMAN_REVIEWS_ALLOWED_WITH_PERSISTENCE_ONLY=0
MOTION_REVIEWS_ALLOWED_WITH_PERSISTENCE_ONLY=0
DOWNLOADS_ALLOWED_WITH_PERSISTENCE_ONLY=0
BUDGET_RESERVATIONS_DURING_REFUSAL_TESTS=0
JOBS_CREATED_DURING_REFUSAL_TESTS=0
STORAGE_READS_DURING_REFUSAL_TESTS=0
STORAGE_WRITES_DURING_REFUSAL_TESTS=0
SIGNED_URLS_CREATED=0
FILES_CREATED=0
ASSETS_ACTIVATED=0
ASSETS_PUBLISHED=0
MERGE_EXPORT_AUTHORIZED=0
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

`AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENING_IMPLEMENT_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER` — Christian, chat courant.

Porte strictement locale. Aucune écriture Vercel. Aucun déploiement. Aucun push. Aucune mutation Supabase/Storage Production. Aucun projet Production créé. AICCOS non touché, non stagé, non committé. RideCloud apply non consommée.

`157_`–`186_` restent des snapshots immuables. `186_` n’est pas réécrit.

### Distinguer les SHA

| Pointeur | SHA | Rôle |
|---|---|---|
| origin/main / SHA servi | `baa92c4` | docs `185_` actuellement servie |
| Preflight local `186_` | `4713d33` | tests + docs preflight · **non poussé** · **préservé** |
| SHA fonctionnel hardening | `a785949` | politique + guards + tests · **non poussé** · **non déployé** |
| SHA documentaire `187_` | ce commit docs | **non poussé** · **non déployé** |
| Tree hardening UI/E2E | `d376a7c` | dans le tree servi `baa92c4` |

Ce n’est **pas** une ouverture persistence, ni une validation provider. Le flag `DIRECTOR_V2_PERSISTENCE_ENABLED` reste **OFF** en Production.

---

## 2. Préconditions

| # | Contrôle | Résultat |
|---|---|---|
| 1 | Racine `C:\Users\JavaChrist\Desktop\virtual-humans` | PASS |
| 2 | Fetch lecture seule `origin/main` | PASS |
| 3 | Branche `main` | PASS |
| 4 | HEAD = `4713d33` | PASS |
| 5 | origin/main = `baa92c4` | PASS |
| 6 | ahead/behind `1/0` | PASS |
| 7 | `4713d33` unique commit local | PASS |
| 8 | Index vide | PASS |
| 9 | Dirty = 2 AICCOS seulement (au départ) | PASS |
| 10 | Director UI-only ON | PASS documentaire `185_` |
| 11 | Persistence OFF | PASS |
| 12 | AI / paid / worker / harness / 11A–11E / Motion OFF | PASS |
| 13 | `FORBIDDEN_ON=none` | PASS documentaire `185_` |
| 14 | `mergeExportAuthorized=false` | PASS |
| 15 | Aucun provider actif | PASS |
| 16 | Aucun moteur réel | PASS |
| 17 | RideCloud apply suspendu | PASS |
| 18 | Ledger 437 / 391 / 0 / 46 | PASS · 0 mutation |
| 19 | Schéma Director · pas de nouvelle migration | PASS |
| 20 | Changements entièrement locaux | PASS |

Working tree protégé : `studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx`. Aucun reset, restore, stash, rebase, amend.

---

## 3. Politique centrale

Deux modules :

1. `studio/src/application/director/director-action-policy.ts`
2. `studio/src/application/director/director-project-quota.ts`

Règle fondamentale : **`persistenceEnabled !== executionAuthorized`**.

| Couche | Flags requis | Autorise |
|---|---|---|
| UI | `DIRECTOR_V2_ENABLED` | layout `/director`, wizard local |
| Persistence de base | UI + `DIRECTOR_V2_PERSISTENCE_ENABLED` | create / list / get / revise / compare / stale / lectures |
| Exécution | flags AI / capability / paid / worker / provider / downstream **propres à l’action** | execute, retry, start, review, download |

Aucune route d’exécution n’infère une autorisation depuis : persistence ON · readiness · artifact existant · projet existant · `completed` · `approved` · `merge_ready` · credentials · Storage configuré · `NODE_ENV=test`.

Une action inconnue est refusée fail-closed (`503` · `director_route_unclassified`).

Les exécutions synthétiques locales restent possibles **uniquement** via `isDirectorE2eFakeMode` (harness E2E explicite). Persistence seule ne les ouvre pas. Motion Review exige `MOTION_TRANSFER_FAKE_HARNESS` **et** `canUseProcessLocalFakeAssetContent` (bloque Vercel / prod / remote Supabase). Le bypass `NODE_ENV=test` a été **supprimé**.

`canUseDurableAssetContent` n’est plus vrai avec persistence + credentials seules : il exige `DIRECTOR_V2_E2E_ASSET_STORAGE` + gate locale. Persistence ON ne rend plus Storage accessible.

---

## 4. Classification des 25 routes

Catalogue unique `DIRECTOR_ROUTE_CATALOG`. `DIRECTOR_ROUTES_CLASSIFIED=25`. `UNCLASSIFIED_DIRECTOR_ROUTES=0`.

| # | Route | GET / lecture | POST execute / retry / review | Catégorie execute |
|---|---|---|---|---|
| 1 | `/api/director/projects` | PERSISTENCE_BASE_READ | PERSISTENCE_BASE_WRITE (create) | — |
| 2 | `/projects/[projectId]` | PERSISTENCE_BASE_READ | — | — |
| 3 | `…/brief/revisions` | PERSISTENCE_BASE_READ | PERSISTENCE_BASE_WRITE | — |
| 4 | `…/brief/compare` | PERSISTENCE_BASE_READ | — | — |
| 5 | `…/stale` | PERSISTENCE_BASE_READ | — | — |
| 6 | `…/text-runs` | PERSISTENCE_BASE_READ | — | — |
| 7 | `…/marketing` (+ retry) | GET / dry-run READ | CAPABILITY_EXECUTION | execute/retry |
| 8 | `…/creative` | GET / dry-run READ | CAPABILITY_EXECUTION | execute |
| 9 | `…/script` | GET / dry-run READ | CAPABILITY_EXECUTION | execute |
| 10 | `…/art` (+ retry) | GET / dry-run READ | CAPABILITY_EXECUTION | execute/retry |
| 11 | `…/storyboard` | GET / dry-run READ | CAPABILITY_EXECUTION | execute |
| 12 | `…/prompts` | GET / dry-run READ | CAPABILITY_EXECUTION | execute |
| 13 | `…/routing` | GET / dry-run READ | CAPABILITY_EXECUTION | execute |
| 14 | `…/production` | GET / dry-run READ | CAPABILITY_EXECUTION | start/execute |
| 15 | `…/production/cancel` | — | PERSISTENCE_BASE_WRITE | cancel sans nouvel effet |
| 16 | `…/merge` | GET / dry-run READ | CAPABILITY_EXECUTION | prepare/execute |
| 17 | `…/export` | GET / dry-run READ | CAPABILITY_EXECUTION | execute |
| 18 | `…/export/manifest` | PERSISTENCE_BASE_READ | — | JSON redacted |
| 19 | `…/export/download` | MEDIA_DELIVERY | — | 404 avant Storage |
| 20 | `…/quality` | GET / dry-run READ | CAPABILITY_EXECUTION | execute |
| 21 | `…/quality/review` | — | CAPABILITY_EXECUTION | Human Review |
| 22 | `…/approvals` | — | BASE_WRITE (texte) · CAPABILITY_EXECUTION (`generation_plan`) | — |
| 23 | `…/motion/review` | GET READ | CAPABILITY_EXECUTION | Motion Review |
| 24–25 | marketing/art retry files | — | CAPABILITY_EXECUTION | retry |

Les 25 fichiers route sont tous dans le catalogue. Une combinaison route/méthode/mode inconnue échoue fail-closed.

---

## 5. Comportement HTTP

| Cas | Statut | Code | Message utilisateur |
|---|---|---|---|
| Capability OFF | **503** | `director_capability_disabled` | « Cette action de génération n’est pas disponible. » |
| Route non classée | **503** | `director_route_unclassified` | même message public (aucun détail interne) |
| Média / download OFF | **404** | `director_capability_disabled` | « Cette ressource n’est pas disponible. » |
| Persistence OFF | **404** | `persistence_disabled` | « Persistance Director désactivée. » |
| Quota atteint | **409** | `director_project_quota_exceeded` | « La limite de projets de cet espace est atteinte. » |
| Non-auth | inchangé | proxy actuel | 401 avant le guard métier |

Aucun nom de flag ni de provider dans les messages. Le guard s’exécute **avant** lecture sensible, réserve budget, création run/job/attempt, enqueue, Storage, URL, mutation artifact, audit d’exécution, appel provider.

Download : aucun `Content-Disposition`, aucun `Content-Type` média, aucun octet, aucun audit de téléchargement réussi.

---

## 6. Guards ajoutés

| Surface | Guard | Effet persistence-only |
|---|---|---|
| Prompt execute | `authorizeDirectorAction` avant artifact | 503 · 0 artifact |
| Routing execute / approve plan | idem | 503 · 0 downstream Production |
| Production start | avant estimate engageante / ledger / run / job / attempt / enqueue | 503 · compteurs inchangés |
| Merge / export execute | e2e only | 503 · 0 Storage · 0 moteur · `mergeExportAuthorized=false` |
| Download | 404 avant `assetContent.get` | 0 octet · 0 header download |
| Quality execute / Human Review | e2e only | 503 · 0 lifecycle · 0 activation |
| Motion Review POST | harness local explicite | 503 · plus de bypass `NODE_ENV=test` |
| Create projet | quota avant RPC | 409 si plafond · replay idempotent OK |
| Rate limit create | `RATE_LIMITS.directorCreate` = 20/min sur POST exact | GET inchangé |
| Storage durable | `canUseDurableAssetContent` exige E2E Storage + gate locale | persistence + creds **insuffisant** |
| UI home | copies honnêtes · cartes historiques consultables | génération indisponible · pas de « Directeurs actifs » |

Directors texte : GET / dry-run restent possibles si persistence ON ; execute/retry exigent les flags AI correspondants **et** `DIRECTOR_V2_PAID_AI_ENABLED`. Persistence n’est jamais une autorisation.

---

## 7. Listing des projets existants

Décision retenue (aucun marqueur persistant, aucune migration) :

- projets du même workspace listables ;
- audience = session studio single-tenant actuelle ;
- liste capée et triée selon le comportement existant ;
- métadonnées et résumés seulement · aucun contenu média · aucun prompt complet ;
- un projet historique peut être ouvert en lecture / reprise wizard ;
- **aucun grandfathering d’exécution** : toutes les actions pipeline passent par les nouveaux guards ;
- l’UI signale « Consultable · génération indisponible ».

---

## 8. Quota

| Champ | Valeur |
|---|---|
| Constante | `DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE=50` |
| Scope | `workspace_id` |
| Archivés | exclus (`archived_at IS NOT NULL`) |
| Replay même ID | autorisé même au quota |
| Double-clic | ne consomme pas un nouveau slot |
| Refus | **avant** RPC create · HTTP **409** · `director_project_quota_exceeded` |
| Atomicité | **non** — check-then-act applicatif |
| Course | deux creates distincts concurrents à 49 peuvent produire 51 |
| Bloque l’activation single-tenant ? | **non** (`blocksSingleTenantActivation=false`) |

Aucune migration dans cette porte. La limite n’est **pas** présentée comme une garantie atomique.

Rate limit : politique générale conservée ; create POST plus strict (20/min). Idempotence de create préservée. GET non impacté.

---

## 9. UI et blockers

Copies corrigées dans `director-home.tsx` :

- plus de « Directeurs actifs » / « totalement absents » ;
- projet / brief peuvent être sauvegardés ;
- capacités de génération indisponibles ;
- projets historiques consultables, exécution désactivée ;
- aucun nom de provider · aucun jargon de flags.

Blockers app-update préservés : create bloquant pendant l’écriture · autosave/draft · révision · cleanup succès / erreur / conflit / unmount. Un refus immédiat (503/409) n’arme pas de blocker zombie. AICCOS non câblé.

---

## 10. Tests

| Check | Résultat |
|---|---|
| Politique centrale (catalogue, inconnue, read/write/capability/media) | PASS |
| Prompt / Routing execute + approve downstream + projet historique | PASS · 0 artifact |
| Production start | PASS · 0 réserve · 0 run · 0 job · 0 attempt · 0 enqueue |
| Merge / export | PASS · 0 Storage · 0 moteur · 0 URL · `mergeExportAuthorized=false` |
| Download | PASS · 0 Storage · 0 octet · 0 header |
| Quality / Human Review | PASS · 0 lifecycle · 0 activation |
| Motion | PASS · aucun bypass `NODE_ENV=test` |
| Quota / replay / archived / workspace / rate limit | PASS |
| Sécurité (non-auth, CSRF, IDOR, cross-workspace, payload, mass assignment) | PASS (suites existantes + hardening) |
| UI Playwright persistence-only port 3113 | **4/4** · barrière réseau propre |
| Suite unitaire | **2058/2058** |
| Typecheck | PASS |
| Lint | 0 error · 35 warnings préexistants |
| `next build` Production local | PASS |
| Secret scan officiel (`findSecretHits`) | **0 hit** · AICCOS exclus |
| Fraîcheur living handover | PASS après ce commit docs |
| Provider | **0** |

---

## 11. Docker / intégration locale

Docker / Supabase local (`54321`) : **indisponible** (`ECONNREFUSED`). Le chemin durable create / replay / list / get / refresh / revise / CAS / cross-workspace / quota **n’a pas été relancé** dans cette porte.

Les guards sont prouvés in-memory. La preuve durable historique VHS-116 / `186_` (schéma READY, isolation workspace) est **conservée**. L’absence d’intégration locale **ne bloque pas** le verdict READY de cette porte.

---

## 12. Risques résiduels

| Risque | Gravité | Mitigation |
|---|---|---|
| Quota check-then-act non atomique | faible (single-tenant) | documenté · n’empêche pas l’activation |
| Intégration durable non relancée ici | moyenne | recheck preflight ; preuve `186_` conservée |
| Flag persistence toujours OFF en Production | attendu | prochaine porte = recheck, **pas** flag write |
| Course create concurrent | faible | replay idempotent ; plafond applicatif |
| Harness E2E / Motion mal configuré en prod | bloqué | `isDirectorE2eFakeMode` + barrière locale ; Motion exige process-local |

Le flag persistence **ne peut être autorisé** qu’après un verdict distinct `READY_FOR_FLAG_AND_WRITE_AUTH`. Cette porte ne le délivre pas.

---

## 13. Compteurs

Voir le bloc d’en-tête. Tous les compteurs d’exécution / Storage / Production / provider / flag / deploy / push / AICCOS sont à **0**. `DIRECTOR_PROJECT_QUOTA=50`. `PERSISTENCE_POLICY_MODULES_CREATED=2`. `DIRECTOR_ROUTES_CLASSIFIED=25`. `UNCLASSIFIED_DIRECTOR_ROUTES=0`. `PHASE_COST=0¢`. `RIDECLOUD_APPLY=SUSPENDED_NOT_CONSUMED`.

---

## 14. Git

| | |
|---|---|
| origin/main | `baa92c4` (inchangé) |
| Historique local attendu | `4713d33` + `a785949` + commit docs `187_` |
| ahead/behind attendu | **3/0** |
| AICCOS | dirty non stagés · 0 staged · 0 committed |
| Push | **0** |

---

## 15. Prochaine porte — non exécutée

```text
AUTH_VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_PREFLIGHT_RECHECK_NO_FLAG_WRITE_NO_DEPLOY_NO_PROVIDER
```

Recheck du preflight persistence **sur le code durci**. Toujours **sans** flag write, **sans** write Production, **sans** deploy, **sans** provider.

Le flag persistence ne pourra être autorisé qu’après un verdict distinct `READY_FOR_FLAG_AND_WRITE_AUTH`.

---

## 16. Verdict

```text
VHS_DIRECTOR_PERSISTENCE_PRODUCTION_ENABLEMENT_HARDENED_READY_FOR_PREFLIGHT_RECHECK
```
