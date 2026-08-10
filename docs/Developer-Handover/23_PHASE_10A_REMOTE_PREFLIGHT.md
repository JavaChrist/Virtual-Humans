# 23 — Phase 10A — Remote Preflight

**Date :** 10 août 2026  
**Périmètre :** lecture seule / aucun appel payant / aucune écriture distante  
**Projet Supabase :** `ejdbksxaswhdtsudnmvi` (eu-west-3, PostgreSQL 17, `ACTIVE_HEALTHY`)  
**App :** `studio/` — Virtual Humans Studio V2  
**Audit de référence Phase 9 :** `20_FINAL_AUDIT.md`  
**Incident migrations :** `21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`  
**Note numérotation :** `22_DIRECTOR_HUMAN_RETRY.md` existe déjà → ce rapport est `23_*`.

---

## Executive Summary

### Verdict

```text
GO_WITH_BLOCKERS
```

**Signification :** le schéma distant V2 (jusqu’à VHS-134), le Storage `director-final-assets`, le ledger et les RPC Director sont **présents** et utilisables en principe. Ce n’est **pas** « production distante validée », ni un feu vert pour lancer un provider réel.

`GO_FOR_10B` est **retenu** uniquement après levée des blockers listés ci-dessous.

### Synthèse

| Question de sortie | Réponse 10A |
|---|---|
| Distant aligné ? | **Partiel** — 29/29 noms présents ; **VERSION_MISMATCH** sur `vhs_133` / `vhs_134` |
| Migrations sûres pour un futur apply ? | **Non sans réconciliation** (même classe de risque que VHS-125) |
| Auth / RLS compatibles ? | **Oui pour V2** (service_role only + RLS sans policy = deny client) |
| Secrets nécessaires existent ? | Local : provider keys **PRESENT** ; worker secret **MISSING**. Vercel : **UNKNOWN** |
| Flags empêchent activation accidentelle ? | **Code : oui** (parse strict, double flags). **Vercel : UNKNOWN**. Local : `DIRECTOR_V2_ENABLED=1` + Supabase **REMOTE** |
| Ledger peut protéger le budget ? | **Structures distantes présentes** ; pas de nouvelle réservation créée en 10A |
| Storage prêt ? | Bucket privé `director-final-assets` **présent** (0 objet) |
| Worker contrôlable ? | Navigation `/director` → **SAFE**. Deploy/cron Vercel → **UNKNOWN** |
| Observabilité manquante ? | Logs + correlation + redact OK ; métriques/traces (VHS-005) **manquantes** |
| Blockers réels de 10B ? | Voir table Risks — surtout drift 133/134, local→remote, flags Vercel UNKNOWN |

### Constat majeur (hors baseline Phase 9)

L’audit Phase 9 parlait de **22/22** versions et « aucune production distante ». **L’état distant actuel a évolué** :

- **29** migrations appliquées (legacy + V2 + remainders + VHS-128…134) ;
- données V2 réelles : workspace, projet, artifacts, **13** `director_runs`, **33** `cost_ledger`, **13** `budget_reservations` ;
- runs Marketing / Creative / Script **completed** ; Art **failed** (retries) ; **0** `production_jobs` / médias Generation Engine.

Des appels text AI distants ont donc **déjà eu lieu** hors de cette Phase 10A (non rejoués ici).

---

## Environment Matrix

| Environnement | Détecté | Accessible lecture | État |
|---|---|---|---|
| App locale (`studio/`) | oui | oui | Code + `.env.local` inspectés (présence secrets, pas de valeurs) |
| Supabase Docker local | documenté | **non vérifié** en 10A (stack non démarrée ici) | Absent de la session d’audit |
| Supabase Production `ejdbksxaswhdtsudnmvi` | oui | oui (MCP read-only) | `ACTIVE_HEALTHY` |
| Storage distant | oui | oui (métadonnées buckets) | 2 buckets privés |
| Vercel projet `virtual-humans` (`prj_NTK8yqoLHiXvBmqMLl98plAxGKdP`) | oui (`.vercel/project.json`) | **limité** | `list_deployments` → **403** ; `get_project` → **404** |
| Preview Vercel | ambigu | non | **UNKNOWN** |
| Worker distant / cron | non détecté | n/a | Endpoint code présent ; déclenchement distant **UNKNOWN** |
| Providers configurables | oui | secrets présence locale only | Voir Providers |

### Cible Supabase de `.env.local` (sans secret)

```text
SUPABASE_TARGET=REMOTE_SUPABASE
SUPABASE_URL_HOST=ejdbksxaswhdtsudnmvi.supabase.co
```

**Risque :** le poste local parle déjà à la base Production. Les studios historiques (image/voix/vidéo) et toute activation de flags Director AI peuvent écrire distant / coûter.

---

## Migration State

### Référence Phase 9 / Porte 3 (historique)

```text
22 / 22 versions locales alignées Production
2 legacy + 17 V2 + 3 remainder markers
```

### État observé 10A

| Source | Count |
|---|---:|
| Fichiers locaux `studio/supabase/migrations/*.sql` | **29** |
| `supabase_migrations.schema_migrations` distant | **29** |

### Comparaison exacte (par nom)

| Statut | Migrations |
|---|---|
| **MATCH** (version + nom) | 27 migrations (legacy → `vhs_132` inclus, remainders 125 inclus) |
| **VERSION_MISMATCH** | `vhs_133_art_human_retry_input_artifact` — local `20260807120000` / remote `20260807213624` |
| **VERSION_MISMATCH** | `vhs_134_legacy_art_timeout_retry` — local `20260807133000` / remote `20260807213803` |
| LOCAL_ONLY / REMOTE_ONLY | **aucune** |

```text
REMOTE MIGRATION DRIFT
```

| Champ | Valeur |
|---|---|
| Version locale | `20260807120000` / `20260807133000` |
| État distant | `20260807213624` / `20260807213803` (mêmes noms) |
| Différence | timestamps MCP ≠ préfixes fichiers locaux (classe VHS-125) |
| Risque | futur `db push` / apply / repair peut créer un double historique ou échouer |
| Action future (humaine) | réconciliation locale type Porte 3 : renommer fichiers aux versions Production ; documenter hashes ; **ne pas** ré-appliquer le SQL |

Les headers locaux 133/134 indiquent « Local additive only » — or le distant les a **déjà**. Traiter comme historique MCP à aligner, pas comme migrations « à appliquer ».

---

## Schema / RLS / Auth

### Structures V2 distantes (REQUIRED_V2)

Présentes (échantillon tables + RPC) :

| Classe | Objets observés | Classification |
|---|---|---|
| Projets / artifacts | `workspaces`, `video_projects`, `project_artifacts`, `active_artifact_revisions` | REQUIRED_V2 |
| Approvals / revue | `artifact_approvals`, `human_review_decisions` | REQUIRED_V2 |
| Production | `production_runs`, `production_jobs`, `generation_attempts`, `generation_plans`, `storyboard_scenes` | REQUIRED_V2 |
| Ledger / budget | `cost_ledger`, `budget_reservations`, `workspace_budget_policies`, `idempotency_records` | REQUIRED_V2 |
| Runs Director | `director_runs` | REQUIRED_V2 |
| Assets / events | `assets`, `domain_events`, `audit_log` | REQUIRED_V2 |
| Legacy studios | `vh_spend`, `vh_products`, `vh_scenes` | LEGACY |
| RPC Director | `begin_or_get_*`, `persist_*`, `revise_project_brief`, `reserve_budget`, `reserve_director_budget`, `claim_production_jobs`, `fail_director_run`, `reschedule_production_job` | REQUIRED_V2 |

### Données distantes (lecture seule, counts)

| Table | Rows |
|---|---:|
| workspaces | 1 |
| video_projects | 1 |
| project_artifacts | 4 |
| director_runs | 13 |
| cost_ledger | 33 |
| budget_reservations | 13 |
| production_jobs / production_runs / assets | 0 |

`director_runs` par type/statut : marketing completed×1 failed×3 ; creative completed×1 failed×4 ; script completed×1 ; art failed×3.

### RLS / grants

- Tables V2 : **RLS enabled**, **0 policy** (`pg_policies` vide sur `public`/`storage`) → deny pour rôles non-bypass.
- Grants V2 observés : **`service_role` uniquement** (pas `anon` / `authenticated` sur tables V2 critiques).
- RPC Director sensibles : **0** privilege `anon` sur routines matching director/reserve/claim/persist/revise.
- Advisors Supabase : nombreux `rls_enabled_no_policy` (INFO) — cohérent avec modèle service_role ; WARN `search_path` mutable sur 3 fonctions retry (`director_error_code_*`, legacy art timeout).
- Legacy `vh_*` : grants `anon` présents **et** RLS sans policy → accès client effectif nié par RLS ; surface legacy à surveiller.

### Auth applicative (code)

- Fail-closed `APP_PASSWORD` + `APP_SESSION_SECRET` (HMAC, TTL) — tests auth verts.
- Worker : secret header only ; cookie insuffisant (`assertDirectorWorkerSecret`).
- CSRF : exception bornée au seul `POST /api/internal/director-worker/run-once`.
- Rate-limit mémoire best-effort (non distribué).
- Local : `APP_PASSWORD` / `APP_SESSION_SECRET` = **PRESENT**.

---

## Feature Flags

Parse strict : seul `1` / `true` active. Défaut code = **off**.

| Flag | Local (`.env.local`) | Preview | Production Vercel | Risque |
|---|---|---|---|---|
| `DIRECTOR_V2_ENABLED` | `1` | UNKNOWN | UNKNOWN | UI Director ouverte localement |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | `0` | UNKNOWN | UNKNOWN | Persistence create/resume off en local |
| `DIRECTOR_V2_WORKER_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Kill switch média |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Kill switch média |
| `DIRECTOR_V2_MARKETING_AI_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Text AI |
| `DIRECTOR_V2_CREATIVE_AI_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Text AI |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Text AI |
| `DIRECTOR_V2_ART_AI_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Text AI |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Text AI |
| `DIRECTOR_V2_PAID_AI_ENABLED` | MISSING→off | UNKNOWN | UNKNOWN | Kill switch text AI (AND avec flag director) |
| `DIRECTOR_V2_E2E_FAKE_MODE` | MISSING→off | UNKNOWN | UNKNOWN | Doit rester off hors E2E local |
| `DIRECTOR_V2_E2E_ASSET_STORAGE` | MISSING→off | UNKNOWN | UNKNOWN | Idem |
| `DIRECTOR_V2_WORKER_SECRET` | MISSING | UNKNOWN | UNKNOWN | Worker fail-closed si absent |
| `DIRECTOR_V2_WORKSPACE_ID` | MISSING | UNKNOWN | UNKNOWN | Requis pour persistence projet |

**Impossible de lire les env Vercel en 10A** (API 403/404) → ne pas inventer.

---

## Providers

| Provider / adapter | Fonction | Env requise | Secret local | Fake | Dry-run | Estimate | Fallback / retry | Idempotence | Coût |
|---|---|---|---|---|---|---|---|---|---|
| OpenAI Marketing/Creative/Script/Art/Storyboard (infra AI) | Text directors | `OPENAI_API_KEY` + flags AI | PRESENT | analyzers fake E2E | oui (code) | oui (budget director) | human retry VHS-128 | run keys / retry_request_id | **payant** |
| OpenAI Image adapter | images Generation Engine | `OPENAI_API_KEY` | PRESENT | `createUniversalFakeAdapter` | dry-run worker | estimate routes | borné PD | attempt keys | **payant** |
| ElevenLabs voice | TTS | `ELEVENLABS_API_KEY`, voice id | PRESENT | fake universal | dry-run | estimate | borné PD | attempt keys | **payant** |
| fal.ai | vidéo / lipsync / merge | `FAL_KEY` | PRESENT | fake universal | dry-run | estimate | borné PD | attempt keys | **payant** |
| AICCOS export | livraison | `AICCOS_URL`, token | PRESENT | stub director | n/a | n/a | n/a | n/a | selon endpoint |
| Fake universal | E2E / local | — | N/A | oui | oui | n/a | n/a | oui | **0** |

**Aucun appel provider réel exécuté en 10A.**

---

## Budget / Ledger

Chaîne attendue (code + RPC distantes présentes) :

```text
estimate → budget check → atomic reservation → execution → actual cost → reconciliation
```

| Contrôle | État 10A |
|---|---|
| `reserve_budget` / `reserve_director_budget` | RPC présentes distant |
| `cost_ledger` / `budget_reservations` | tables présentes ; rows > 0 (historique antérieur) |
| Idempotence / replay | `idempotency_records` + clés director runs |
| Écriture `vh_spend` par V2 | non utilisée par design V2 (legacy séparé) |
| Nouvelle réservation 10A | **NON créée** |
| Rapprochement coûts réels (VHS-006) | **ouvert** |

---

## Storage

| Bucket | Public | Limite | MIME | Objets | Classification |
|---|---|---|---|---:|---|
| `director-final-assets` | false | 50 MiB | allowlist vidéo/audio/image | 0 | REQUIRED_V2 |
| `product-screens` | false | null | null | (non requêté en détail) | LEGACY |

- Path convention documentée : `{workspace}/{project}/{container}/{asset}.{ext}`.
- Gate mémoire : **interdite** sur Vercel / prod / Supabase non-local (`local-fake-delivery`).
- Policies Storage `pg_policies` : **aucune** → accès via service_role côté serveur.
- Upload/delete test : **non effectués**.
- Rétention automatique : **non** (backlog P2 VHS-206).

---

## Worker

| Point | Observation |
|---|---|
| Endpoint | `POST /api/internal/director-worker/run-once` |
| Auth | `x-director-worker-secret` timing-safe ; absent → 401 |
| Flags | exige `DIRECTOR_V2_WORKER_ENABLED` **et** `DIRECTOR_V2_PAID_GENERATION_ENABLED` sinon `disabled` / `providerCalled: false` |
| Auto-start / cron | aucun dans le code inspecté ; pas de preuve de cron Vercel |
| Claim / lease / retry | domaine worker + RPC `claim_production_jobs` / `reschedule_production_job` |
| Navigation `/director` déclenche production réelle ? | **SAFE** (pas d’appel worker depuis navigation seule) |

```text
Worker accidental trigger via /director navigation: SAFE
Worker / paid path on Vercel production: UNKNOWN
```

---

## Observability

| Capacité | État |
|---|---|
| Logs structurés | oui |
| `correlationId` | oui |
| Redaction secrets / data URLs | oui (tests) |
| Provenance artifacts | oui (domaine + DB) |
| Erreurs typées director | oui |
| Métriques distribuées | **manquant** (VHS-005) |
| Traces | **manquant** (VHS-005) |
| Dashboard coût / alertes | **manquant** (VHS-203/205) |

**Avant première production média payante contrôlée :** au minimum corrélation + ledger + plafond + flags kill ; métriques/alertes restent dette P1/P2 (ne bloque pas un smoke text ultra-borné si flags et budget verrouillés).

---

## Risks

| ID | Sévérité | Zone | Risque | Action recommandée | Bloque 10B |
|---|---|---|---|---|---|
| R-10A-01 | **P0** | Migrations | VERSION_MISMATCH `vhs_133`/`vhs_134` (drift historique MCP) | Réconciliation locale type Porte 3 **avant** tout apply futur | **Oui** (avant apply) |
| R-10A-02 | **P0** | Config locale | `.env.local` → Supabase **Production** + `DIRECTOR_V2_ENABLED=1` + clés provider PRESENT | Séparer env local Docker vs remote ; ne jamais pointer local vers prod pour dev courant | **Oui** |
| R-10A-03 | **P0** | Vercel | Flags / secrets Production & Preview **UNKNOWN** (API 403/404) | Inspection humaine dashboard Vercel : kill switches off tant que non validé | **Oui** |
| R-10A-04 | **P1** | Ops | Backup / restauration distante **non prouvée** en 10A | Backup + test restore avant toute mutation | **Oui** (avant mutation) |
| R-10A-05 | **P1** | Observabilité | VHS-005 métriques/traces absentes | Baseline minimale avant canary média | Partiel |
| R-10A-06 | **P1** | Budget | VHS-006 rapprochement coûts réels ouvert | Procédure de réconciliation avant volume | Partiel |
| R-10A-07 | **P1** | Données | Runs AI distants déjà présents (échecs/retries Art) | Inventaire humain avant nouveau smoke ; pas d’effacement audit | Non (contexte) |
| R-10A-08 | **P2** | Security advisors | `search_path` mutable sur 3 fonctions retry | Correctif migration future (hors 10A) | Non |
| R-10A-09 | **P2** | Legacy | Grants `anon` sur `vh_*` (mitigés RLS sans policy) | Durcir grants legacy si surface exposée | Non |
| R-10A-10 | **P2** | Worker | `DIRECTOR_V2_WORKER_SECRET` local MISSING | Normal si worker off ; **obligatoire** avant worker distant | Oui pour worker |

---

## Evidence

### Lectures obligatoires (Étape A)

- `docs/Developer-Handover/00_README.md`, `02_ARCHITECTURE.md`, `20_FINAL_AUDIT.md`, `21_VHS_125_REMOTE_MIGRATION_INCIDENT.md`, `22_DIRECTOR_HUMAN_RETRY.md`, `BACKLOG_V2.md`, `CHECKLIST_RELEASE.md`, `CHANGELOG.md`, `19_DEPLOYMENT.md`
- `studio/supabase/README.md`, `studio/.env.example`, `feature-flags.ts`, worker route, `local-fake-delivery.ts`, `asset-content-backend.ts`

### Commandes / vérifications (sans secret)

```text
MCP supabase list_migrations (ejdbksxaswhdtsudnmvi)
MCP supabase list_tables
MCP supabase get_project
MCP supabase get_advisors type=security
MCP supabase execute_sql — SELECT only (buckets, grants, RPC, counts, director_runs aggregate, pg_policies)
MCP vercel list_deployments → 403
MCP vercel get_project → 404
Compare local migration filenames vs remote versions
.env.local key presence + flag values + SUPABASE host class (no secret values printed)
npm test (suite locale) → 1005/1005 pass (session 10A)
git status --short → M .gitignore
```

### Preuves Phase 9 non rejouées intégralement

Batterie complète pgTAP / E2E / build non relancée (preuves Phase 9 / Porte 1 jugées suffisantes pour le code local). Session 10A a exécuté la suite unitaire npm (1005 verts) via les tests de guards.

---

## Operations NOT performed

```text
remote migration apply : NO
remote DB write : NO
remote Storage write : NO
real provider call : NO
paid execution : NO
worker trigger : NO
Vercel env mutation : NO
deploy : NO
commit : NO
push : NO
```

---

## Conditions de sortie Phase 10A

| # | Critère | Statut |
|---:|---|---|
| 1 | Distant aligné | **Partiel** (drift 133/134) |
| 2 | Migrations sûres | **Non** jusqu’à réconciliation |
| 3 | Auth/RLS compatibles | **Oui** (modèle service_role) |
| 4 | Secrets sans exposition | Local inventorié ; Vercel **UNKNOWN** |
| 5 | Flags anti-activation accidentelle | Code OK ; runtime Vercel **UNKNOWN** ; local→remote **risqué** |
| 6 | Ledger protecteur | Structures OK ; pas de test de réservation distante |
| 7 | Storage prêt | Bucket OK ; vide ; pas d’upload test |
| 8 | Worker sous contrôle | Navigation **SAFE** ; deploy **UNKNOWN** |
| 9 | Observabilité manquante | VHS-005 partiel documenté |
| 10 | Blockers 10B identifiés | **Oui** (R-10A-01…04) |

---

## Recommandation pour la porte suivante (humaine)

1. Réconcilier versions locales `vhs_133` / `vhs_134` avec timestamps Production (sans apply).  
2. Remettre le développement local sur Supabase Docker (séparer `.env` remote).  
3. Inspecter manuellement les env Vercel (flags Director/AI/paid/worker **off** sauf fenêtre contrôlée).  
4. Backup + preuve de restore.  
5. Seulement ensuite : définir 10B comme **un** smoke provider borné (idéalement Marketing déjà partiellement exercé — ou média Generation Engine) avec plafond et kill switches.

---

## STOP

Phase 10A terminée. Aucun correctif, provider réel, migration, deploy, commit ou push n’a été effectué après ce rapport.
