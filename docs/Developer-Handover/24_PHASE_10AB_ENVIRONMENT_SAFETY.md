# 24 — Phase 10A-B — Environment Safety & Remote Reconciliation

**Date :** 10 août 2026  
**Périmètre :** correctifs locaux uniquement ; aucun provider réel ; aucune écriture distante  
**Entrée :** `23_PHASE_10A_REMOTE_PREFLIGHT.md` (`GO_WITH_BLOCKERS`)  
**Projet Supabase Production :** `ejdbksxaswhdtsudnmvi` (lecture seule)

---

## Executive Summary

### Verdict

```text
GO_WITH_BLOCKERS
```

**Levée locale réussie** pour R-10A-01 (drift 133/134) et R-10A-02 (isolation `.env.local` + guard).  
**Phase 10A-C (suite) :** kill switches Vercel explicitement remis à `0` — voir `25_PHASE_10AC_VERCEL_KILL_SWITCH_RESET.md`.  
**Phase 10A-D (suite) :** Docker + `db reset`/pgTAP/intégration verts ; redeploy Production appliquant les kill switches — voir `26_PHASE_10AD_LOCAL_DB_SAFE_REDEPLOY.md` (`GO_FOR_10B`).  
**Reste P1 :** preuve restore (R-10A-04) — bloque ops distantes invasives, pas le smoke texte 10B borné.

Le verdict **propre à 10A-B** reste `GO_WITH_BLOCKERS`.  
La suite **10A-D** lève les blockers DB/Docker + applique le redeploy → `GO_FOR_10B` (doc 26).  
Cela ne signifie **pas** « production distante complètement validée ».

| Blocker 10A / 10A-B | Après 10A-B → 10A-D |
|---|---|
| R-10A-01 drift `vhs_133`/`vhs_134` | **CLOTURÉ** (historique local = Production, 29/29 ; apply local prouvé en 10A-D) |
| R-10A-02 `.env.local` → Production | **CLOTURÉ** (Docker local + guard fail-closed) |
| R-10A-03 / **R-10AB-01** Vercel | **CLOTURÉ** (10A-C write + 10A-D redeploy) |
| R-10A-04 Backup/restore | **OUVERT** → `BACKUP_PRESENT_RESTORE_UNPROVEN` (P1 ; ne bloque pas smoke texte 10B) |
| R-10A-05 Observabilité | Min 10B documenté (pas d’implémentation VHS-005) |
| R-10A-06 Coûts | Protocole min 10B documenté (pas d’implémentation VHS-006) |
| **R-10AB-03** Docker/db reset | **CLOTURÉ** (10A-D) |

---

## Environment Isolation

### Avant (10A)

```text
SUPABASE_URL → ejdbksxaswhdtsudnmvi.supabase.co (Production)
DIRECTOR_V2_ENABLED=1
provider keys PRESENT
VH_ALLOW_REMOTE_SUPABASE absent
```

### Après (10A-B)

```text
SUPABASE_URL → http://127.0.0.1:54321  (Docker local ; ports 10A-D)
DIRECTOR_V2_ENABLED=0
DIRECTOR_V2_* AI / worker / paid = 0
VH_ALLOW_REMOTE_SUPABASE=0
Production credentials → .env.remote.local (gitignored, NOT auto-loaded by Next)
```

Séparation explicite :

```text
LOCAL DEV     → Supabase Docker (54321 / 54322 / 54323 — 10A-D)
PRODUCTION    → Supabase Production (Vercel only)
REMOTE MANUAL → .env.remote.local + VH_ALLOW_REMOTE_SUPABASE=1 (volontaire)
```

Scripts ajoutés (locaux) :

- `scripts/fix-env-local-docker.mjs` — répare `.env.local` vers Docker
- `scripts/verify-env-local-safety.mjs` — imprime host/flags/présence (jamais secrets)
- `scripts/neutralize-env-local-for-docker.mjs` — archive remote → `.env.remote.local`
- `scripts/compare-migration-history.mjs` — alignement 29/29

---

## Local Production Guard

### Mécanisme

Fichier : `studio/src/infrastructure/config/supabase-target-guard.ts`

| Signal | Effet |
|---|---|
| `SUPABASE_URL` host `127.0.0.1` / `localhost` / `::1` | **autorisé** (mode `local`) |
| Runtime Vercel (`VERCEL=1` ou `VERCEL_ENV` non vide) | **autorisé** remote (mode `vercel`) |
| Remote hors Vercel + `VH_ALLOW_REMOTE_SUPABASE=1\|true` | **autorisé** (mode `remote_explicit`) |
| Remote hors Vercel sans opt-in | **refusé** fail-closed |
| `NODE_ENV` seul | **insuffisant** (ne débloque pas) |

Branché sur :

- `parseV2SupabaseConfig` / persistance Director V2
- `lib/supabase.ts` → `supabase()` (studios historiques)

### Tests

`src/infrastructure/config/__tests__/supabase-target-guard.test.ts` + couverture dans `config-and-mapping.test.ts`.

---

## Migration Reconciliation

### Drift constaté (10A)

| Migration | Local (avant) | Production |
|---|---|---|
| `vhs_133_art_human_retry_input_artifact` | `20260807120000` | `20260807213624` |
| `vhs_134_legacy_art_timeout_retry` | `20260807133000` | `20260807213803` |

Cause probable : apply MCP distant (timestamps générés à l’apply) vs préfixes locaux d’auteur — **même classe que VHS-125**.

### Preuve d’équivalence (avant rename)

Corps `CREATE OR REPLACE FUNCTION … $$;` normalisés (whitespace → espace unique), MD5 :

| Objet | Local | Remote statements | Résultat |
|---|---|---|---|
| `begin_or_retry_director_run` (vhs_133) | `dd23e9087e2ef861608cbb925c407d35` | identique | **MATCH** |
| `director_run_is_legacy_art_timeout_misclassified` (vhs_134) | `f7ed857577a02ae185f46564d1085833` | identique | **MATCH** |
| `begin_or_retry_director_run` (vhs_134) | `096165481220306e84615c77a43552e6` | identique | **MATCH** |

Diff octet-à-octet des fichiers : wrappers locaux `BEGIN;` / `COMMIT;` absents du payload `schema_migrations.statements` distant — non mutatif pour le schéma final.

### Correctif local appliqué

Renommage uniquement (contenu SQL inchangé) :

```text
20260807213624_vhs_133_art_human_retry_input_artifact.sql
20260807213803_vhs_134_legacy_art_timeout_retry.sql
```

### Validation historique

```text
node scripts/compare-migration-history.mjs
→ HISTORY_ALIGNED=YES
local_count=29 production_count=29
```

Re-lecture MCP `list_migrations` Production : **29** entrées, versions identiques.

```text
LOCAL MIGRATION HISTORY
=
KNOWN PRODUCTION MIGRATION HISTORY
```

### Non exécuté (Docker absent sur PATH)

```text
npx supabase db reset     — NON (Docker Desktop introuvable)
npx supabase test db      — NON
npm run test:integration:db — NON
```

**Risque résiduel P1 :** rebuild local Docker non rejoué dans cette session ; à faire dès que Docker est disponible (aucune écriture Production).

---

## Vercel Manual Checklist

API Vercel 10A : `list_deployments` 403 / `get_project` 404 — **aucune lecture automatique des env**.

```text
VERCEL_SAFE = YES   (après Phase 10A-C)
```

**Mise à jour 10A-C :** les 10 kill switches listés ci-dessous ont été explicitement écrits à `0` en Production et Preview (`vercel env update … --value 0 --sensitive --yes`, 20/20 OK). Les valeurs restent `sensitive` / non relisibles via CLI — preuve = `LAST_EXPLICIT_WRITE=0`. Détail : `25_PHASE_10AC_VERCEL_KILL_SWITCH_RESET.md`.

Checklist historique (présence) — toujours utile pour audit humain :

| Variable | Valeur sûre attendue | Production | Preview | Vérification |
|---|---|---|---|---|
| `DIRECTOR_V2_ENABLED` | `0` (ou absent) tant que 10B non autorisé | ☐ | ☐ | Lecture humaine |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | `0` | ☐ | ☐ | |
| `DIRECTOR_V2_WORKER_ENABLED` | `0` | ☐ | ☐ | Kill switch worker |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | `0` | ☐ | ☐ | Kill switch médias |
| `DIRECTOR_V2_PAID_AI_ENABLED` | `0` | ☐ | ☐ | Kill switch text AI |
| `DIRECTOR_V2_MARKETING_AI_ENABLED` | `0` | ☐ | ☐ | |
| `DIRECTOR_V2_CREATIVE_AI_ENABLED` | `0` | ☐ | ☐ | |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | `0` | ☐ | ☐ | |
| `DIRECTOR_V2_ART_AI_ENABLED` | `0` | ☐ | ☐ | |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | `0` | ☐ | ☐ | |
| `DIRECTOR_V2_E2E_FAKE_MODE` | `0` / absent | ☐ | ☐ | Jamais en prod |
| `DIRECTOR_V2_E2E_HARNESS` | absent | ☐ | ☐ | |
| `DIRECTOR_V2_E2E_ASSET_STORAGE` | `0` / absent | ☐ | ☐ | |
| `VH_ALLOW_REMOTE_SUPABASE` | absent (N/A sur Vercel) | ☐ | ☐ | |
| `DIRECTOR_V2_WORKER_SECRET` | PRESENT si worker un jour on ; sinon peut être absent (fail-closed) | ☐ | ☐ | Présence seule |
| `APP_PASSWORD` | PRESENT (≥12) | ☐ | ☐ | Présence seule |
| `APP_SESSION_SECRET` | PRESENT (≥32) | ☐ | ☐ | Présence seule |
| `SUPABASE_URL` | URL projet Production | ☐ | ☐ | Host seulement |
| `SUPABASE_SERVICE_ROLE_KEY` | PRESENT | ☐ | ☐ | Présence seule |
| `OPENAI_API_KEY` / `FAL_KEY` / `ELEVENLABS_API_KEY` | PRESENT ok ; **inertes** si flags paid/AI off | ☐ | ☐ | Présence seule |
| Cron / Scheduled Job vers `/api/internal/director-worker/run-once` | **aucun** | ☐ | ☐ | |

Kill switches minimum pour empêcher tout provider payant Director :

```text
DIRECTOR_V2_PAID_AI_ENABLED=0
DIRECTOR_V2_PAID_GENERATION_ENABLED=0
DIRECTOR_V2_WORKER_ENABLED=0
(+ flags *_AI_ENABLED=0)
```

**Statut post-10A-C :** `VERCEL_SAFE=YES` pour les kill switches (écriture explicite à `0`).  
Prise d’effet runtime : **prochain deployment uniquement** (`CURRENT_DEPLOYMENT_STATE_UNCHANGED`).

---

## Backup / Restore

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```

| Élément | État 10A-B |
|---|---|
| Projet actif `ACTIVE_HEALTHY` | oui (MCP) |
| Mécanisme plateforme Supabase (daily / PITR selon plan) | **supposé disponible** — plan/quotas **non lus** ici |
| Fréquence exacte | UNKNOWN |
| PITR activé ? | UNKNOWN |
| Dernière preuve de backup | UNKNOWN |
| Dernière preuve de restore | **aucune** |
| Restore testé en 10A-B | **NON** (interdit / non lancé) |

### Précondition avant future mutation Production

1. Confirmer dans Dashboard Supabase → Database → Backups : backup récent + PITR si Pro.  
2. Documenter point-in-time cible.  
3. Idéalement restore drill sur **branche / projet isolé** (pas Production).  
4. Seulement ensuite autoriser apply / smoke distant.

---

## Minimum Observability

Pour **un** appel provider réel contrôlé (futur 10B) — sans implémenter VHS-005 complet :

| Élément | État code | Classe |
|---|---|---|
| correlation ID | `startObservedRoute` / logs | **READY** |
| run ID | `director_runs.id` | **READY** |
| artifact / revision | persist director + active revisions | **READY** |
| provider choisi | `provider_id` sur run / adapters | **READY** |
| modèle choisi | `model_id` + env `OPENAI_*_MODEL` | **READY** |
| tentative | `attempt_number` (VHS-128+) | **READY** |
| estimation avant appel | dry-run + `estimated_cost_minor` + réserve | **READY** |
| coût réel / dérivé | metering usage tokens → pricing book ; sinon `cost_status` | **PARTIAL** (dépend price book / provider) |
| durée | logs `durationMs` / obs route | **READY** |
| succès / échec | `director_runs.status` + error_code | **READY** |
| erreur redacted | redact + taxonomie 429 | **READY** |
| timestamp | `created_at` / logs | **READY** |
| métriques/traces distribuées | absent | **MISSING** (non bloquant smoke unique si ledger OK) |

**Bloquant 10B si :** impossibility d’attacher correlationId + runId + estimate + statut terminal redacted.  
→ Aujourd’hui : **non bloquant** pour un smoke text unique borné.

---

## Minimum Cost Reconciliation

Protocole pour **un seul** appel réel futur :

```text
1. dry-run → estimated_cost_minor (E)
2. reserve_director_budget → reservation R (amount = E or policy)
3. execute provider (1 call max)
4. metering : usage tokens / secondes → derived_actual D
   (si provider ne renvoie pas $ : D = f(usage, price book env))
5. complete/fail run → ledger actual A + release/commit reservation
6. fiche humaine :
   E | R | D | A | (A-E) | (A-R)
```

Si le provider ne retourne pas de coût monétaire :

- enregistrer usage brut (tokens / durée) ;
- calculer D via grilles `OPENAI_*_PRICE_*` / `FAL_*_USD_*` ;
- marquer `cost_status` / warning si price book absent ;
- **refuser** de conclure « coût réel inconnu » sans au moins D dérivé ou échec explicite `pricing_required`.

Si E, R, A (ou D) ne peuvent pas être produits pour l’appel : **10B bloquée**.

État actuel : structures ledger + dry-run + metering Marketing **READY/PARTIAL** ; rapprochement automatisé dashboard = **MISSING** (VHS-006) — acceptable pour fiche manuelle d’un unique appel.

---

## .gitignore Decision

```text
KEEP
```

Diff observé :

```diff
+.vercel
```

| Question | Réponse |
|---|---|
| Appartient à 10A ? | Non directement (déjà modifié avant/rapport 10A) |
| Protège un secret ? | Protège métadonnées de lien Vercel local (org/project) — bonne hygiène |
| Doit être conservé ? | **Oui** — éviter de committer `.vercel/` |

---

## Tests

| Gate | Résultat |
|---|---|
| `compare-migration-history.mjs` | **HISTORY_ALIGNED=YES** (29/29) |
| Unitaires (suite npm) | **1016/1016** pass |
| `typecheck` | vert |
| `lint` | **0** erreur, **16** warnings (préexistants) |
| `supabase db reset` / pgTAP / intégration DB | **NON exécutés** — Docker absent |
| E2E / build | non requis / non lancés |
| Backend écriture des tests | **local only** (guard + `.env.local` Docker) |

---

## Remaining Risks

| ID | Sévérité | Zone | Risque | Bloque 10B |
|---|---|---|---|---|
| R-10AB-01 | **P0** | Vercel | Flags Production/Preview non vérifiés | **CLOTURÉ (10A-C)** |
| R-10AB-02 | **P1** | Backup | Restore non prouvé | **Oui** avant mutation |
| R-10AB-03 | **P1** | Docker | `db reset`/pgTAP non rejoués après rename 133/134 | **CLOTURÉ (10A-D)** |
| R-10AB-04 | **P1** | Obs/coûts | VHS-005/006 incomplets | Non pour 1 smoke text si protocole manuel suivi |
| R-10AB-05 | **P2** | Scripts | `neutralize-env-local-for-docker.mjs` a nécessité `fix-env-local-docker.mjs` | Non |

---

## Operations NOT performed

```text
remote migration apply: NO
remote DB write: NO
remote Storage write: NO
real provider call: NO
paid execution: NO
worker trigger: NO
Vercel mutation: NO
deploy: NO
push: NO
commit: NO
```

---

## STOP

Phase 10A-B terminée. Attente autorisation humaine pour :

1. cocher la checklist Vercel ;  
2. prouver backup/restore ;  
3. (recommandé) `db reset` + pgTAP locaux dès Docker disponible ;  
4. seulement ensuite décider d’ouvrir 10B.
