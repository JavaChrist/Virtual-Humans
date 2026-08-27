# 164 — RideCloud Separate Project Create Idempotent

**Date :** 2026-08-27  
**Auth :** `AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER`  
**Nature :** une création Production idempotente · projet draft + brief textuel rev.1 · **0** provider · **0** média  
**HEAD au départ :** `e8f544f` (`163_` SHA record)  
**HEAD de phase :** pending commit (ce rapport)

```text
VERDICT = RIDECLOUD_SEPARATE_PROJECT_CREATED
RPC_STATUS = created
REPLAY = EXISTING · mayCreate=false · RPC_CALLS=0
PHASE_COST = 0¢
PROVIDER_CALLS = 0
TTS_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
RPC_CALLS = 1
PROJECTS_CREATED = 1
BRIEFS_CREATED = 1
OTHER_PRODUCTION_WRITES = 0
ASSETS_CREATED = 0
RUNS_CREATED = 0
JOBS_CREATED = 0
ATTEMPTS_CREATED = 0
OUTPUTS_CREATED = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
HARD = 437
COMMITTED = 391
RESERVED = 0
AVAILABLE = 46
NEXT_AUTH = AUTH_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_NO_PROVIDER
```

---

## 1. Autorisation consommée

`AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER` — Christian, chat courant.

Une seule création idempotente du projet RideCloud séparé et de son brief textuel initial. Aucun provider, média, upload, génération, dépense, `storyboard_project` Production, activation ou publication.

`157_`–`163_` restent des snapshots immuables. Preflight `163_` (pas `162_`) est l’autorité de création ; `162_` reste le polish VO.

## 2. Git avant action

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `e8f544f` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS + `page.tsx` protégés · non modifiés · non stashés · non stagés |

## 3. Identité confirmée — redacted-safe

| Champ | Valeur |
|---|---|
| projectKey | `ridecloud-promo-separate-v1` |
| Nom | RideCloud — First Founder Ad |
| Workspace | `3c308f57…` |
| projectId | `ba4a6021…` |
| briefId | `adea092a…` |
| fingerprint | `b266a03b66436acd…` |
| correlation_id | `ridecloud-promo-separate-v1` |
| Status | `draft` |
| Brief | `video_project_brief` rev.1 |
| Propriétaire | Christian |
| Campagne | Programme Fondateur |
| Canaux | LinkedIn + Instagram |
| Langue | `fr` |
| Director `durationSeconds` | **30** (enum) |
| Livrable | **26 s** via `brandConstraints.delivery_duration_sec=26` |
| Master | 9:16 |
| Dérivés | 4:5 · 1:1 (contrat, hors brief enum) |

## 4. Préconditions live — toutes PASS avant write

| # | Contrôle | Résultat |
|---|---|---|
| 1 | Git exact + hors scope | PASS · `e8f544f` · 0/0 · 3 AICCOS dirty |
| 2 | Supabase Production | PASS · `ejdb…nmvi` · host allowlisté · `eu-west-3` |
| 3 | Migrations | PASS · **32/32** |
| 4 | Voice runtime | PASS · OFF |
| 5 | Paid Media runtime | PASS · OFF |
| 6 | Flags sensibles | PASS · parse local strict = tous `false` · Vercel MCP non authentifié · même niveau de preuve que `156_`/`163_` |
| 7 | Budget | PASS · 437 / 391 / 0 / 46 |
| 8 | Réservations actives | PASS · **0** |
| 9 | Voice historique | PASS · `submitCount=1` · `maySubmit=false` · 1 job ElevenLabs `voice` completed |
| 10 | Projet cible absent | PASS · 0 row `ba4a6021…` |
| 11 | SELECT nom exact | PASS · 0 row avant write |
| 12 | Collision de nom | PASS · refusée si autre ID |
| 13 | Isolation 11A / Motion | PASS · `984507af…` et `390c25db…` intacts |
| 14 | Brief divergent | PASS · 0 artifact cible |
| 15 | RPC vhs_116 | PASS · crée projet draft + brief rev.1 · pointeur actif + audit/outbox internes |

Décision locale : `CREATE` · `RPC_CALLS=1`.

## 5. Write unique

Exactement **un** appel `create_director_project_with_brief`.

Réponse RPC : `status=created` · revision 1 · IDs déterministes.

Writes métier : 1 `video_projects` draft · 1 `video_project_brief` rev.1.

Effets internes vhs_116 uniquement : 1 pointeur `active_artifact_revisions` · 1 `audit_log` `director.project.created` · 1 `domain_events` `director.project.created`.

Aucun second appel. Aucun fallback. Aucun rattrapage.

## 6. Relecture live

| Champ | Confirmé |
|---|---|
| projectId | `ba4a6021…` |
| workspace | `3c308f57…` |
| nom | RideCloud — First Founder Ad |
| status | `draft` |
| briefId | `adea092a…` |
| type / rev | `video_project_brief` / **1** |
| fingerprint | `b266a03b66436acd…` |
| claim | Le carnet d’entretien intelligent de tous vos véhicules. |
| CTA | Programme Fondateur + Premium à vie |
| audience | LinkedIn and Instagram · master 9:16 · dérivés 4:5 et 1:1 |
| brandConstraints | `delivery_duration_sec=26` · `storyboard_local_contract_only` · Premium lié au Programme · 0 partenariat véhicule · 0 badge Play · bannière ≠ claim |
| mediaReferences | `[]` |
| characterId | absent |
| locators unsafe | **false** · 0 chemin local · 0 URL · 0 secret |
| même nom autre ID | **0** |
| `storyboard_project` | **0** |
| ledger / jobs / runs RideCloud | **0** |
| Pointeurs 11A/11B | inchangés · GP `a55bd426…` r2 · PR `fa5c42bd…` r10 · QR `0da85052…` r5 |
| 11A / Motion | draft inchangés |
| Budget | 437 / 391 / 0 / 46 |
| Runtimes | OFF |
| Réservations | 0 |

Signature Git « Centralisez, anticipez, valorisez. » reste l’autorité locale ; elle n’est pas dupliquée dans les champs brief (fingerprint inchangé).

`narrator_female` = rôle futur seulement · 0 `voiceId`.

## 7. Replay lecture seule

Faits live exacts → `decideRideCloudCreateApply` = `EXISTING` · `rpcCalls=0`.

`evaluateRideCloudCreateReplay` = `RIDECLOUD_SEPARATE_PROJECT_EXISTING` · `mayCreate=false` · `RPC_CALLS=0`.

Aucun second appel RPC.

## 8. Isolation

- Projet créé ≠ `984507af…` (11A/11B/11C) ≠ `390c25db…` (Motion).
- 0 mutation de pointeur technique.
- 0 activation / publication.
- Storyboard Git = autorité · 0 `storyboard_project` Director.
- 0 accès `studio/.tmp/ridecloud-pack`.
- AICCOS hors scope intacts.

## 9. Verdict

**`RIDECLOUD_SEPARATE_PROJECT_CREATED`**

Replay obligatoire : **existing** · `mayCreate=false`.

## 10. Prochaine autorisation exacte — non exécutée

**`AUTH_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_NO_PROVIDER`**

Preflight textuel du rattachement storyboard/pack au projet `ba4a6021…`. Aucun provider. Aucune lecture ni upload média. Aucun `storyboard_project` Production. 0¢.

**Ne pas exécuter cette porte ici.**

## 11. Tests

| Check | Résultat |
|---|---|
| Ciblés create apply | **5/5** avant write · **5/5** après write |
| Ciblés preflight + fraîcheur | **11/11** |
| Suite unitaire | **1884/1884** |
| Typecheck | **PASS** |
| Fraîcheur | **PASS** · next = storyboard/pack bind preflight |
| Secret scan | **PASS** · 0 voiceId · 0 URL signée |
| Scan Git | AICCOS exclus · 0 média · 0 `.tmp` |

AICCOS **exclus**. 0 média Git.

STOP.
