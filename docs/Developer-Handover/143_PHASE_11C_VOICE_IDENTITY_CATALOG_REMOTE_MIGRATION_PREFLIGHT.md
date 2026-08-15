# 143 — Phase 11C Voice Identity Catalog Remote Migration Preflight

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT`  
**Nature :** preflight distant **lecture seule** · **0** apply · **0** write Production · **0** seed · **0** ElevenLabs  
**HEAD au départ :** `d3bc5fc` (`142_`)

```text
VERDICT = VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT_READY_FOR_APPLY_AUTH
REMOTE_MIGRATIONS = 0
PRODUCTION_WRITES = 0
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
VOICE_IDENTITIES_SEEDED = 0
VOICE_CONSENTS_PERSISTED = 0
PROJECT_BINDINGS_CREATED = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
VOICE_IDS_EXPOSED = false
VOICE_RUNTIME = OFF
VOICE_DOWNSTREAM = OFF
LIPSYNC = OFF
MERGE_EXPORT = OFF
VIDEO_ACTIVE = false
HARD = 437
COMMITTED = 389
RESERVED = 0
AVAILABLE = 48
RUNTIME_PAID_MEDIA = OFF
NEXT_AUTH = AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE
```

---

## 1. Autorisation consommée

Christian a autorisé uniquement un preflight distant en lecture seule de la migration Voice Identity Catalog.

Cette Auth n’autorise pas : apply distant, write Production, seed, binding, consentement persisté, appel ElevenLabs, génération Voice, write Vercel, réserve budget, lecture/écriture média, activation, lipsync, merge/export, migration de réparation, suppression, force push, modification AICCOS, exposition d’IDs ou de secrets.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `d3bc5fc` |
| ahead / behind | **0 / 0** au départ |
| Message HEAD | `feat(studio): prepare Voice identity catalog and local migration` |
| Hors scope | AICCOS protégés |

HEAD final = commit de cette phase (voir §29). `headStatus=pending commit` · `documentedHead=d3bc5fc`.

## 3. Working tree

Au départ : uniquement `studio/src/app/api/aiccos/send/route.ts` et `studio/src/components/send-to-aiccos.tsx` (hors périmètre). **Non touchés**, non stagés, non commités.

`studio/.env.local` : ignoré (`studio/.gitignore` `.env*`). Non lu dans ce rapport. Non stagé.

Preview MP4 hors Git / hors scope.

## 4. Projet Supabase redacted

| Champ | Valeur |
|---|---|
| Projet | `ejdb…nmvi` · **Virtual Humans Studio** |
| Région | `eu-west-3` |
| Statut | `ACTIVE_HEALTHY` |
| Postgres | 17.6.1.147 |
| Host | redacted |

## 5. État de santé

Production **ACTIVE_HEALTHY**. Aucune écriture. Budget **non relu** cette phase (dernier live connu `133_` / living handover : **437 / 389 / 0 / 48**). Assets et flags inchangés par construction (0 write).

## 6. Migrations locales

**31** fichiers sous `studio/supabase/migrations/`.

Dernière locale : `20260815182203_vhs_11c_voice_identity_catalog.sql`.

Les 30 premières correspondent exactement aux 30 versions Production.

## 7. Migrations distantes

**30** versions appliquées. Dernière : `20260811211757_vhs_mt005_human_review_decision_extend`.

Aucune version distante inconnue localement. Aucun trou. Voice catalog **absente** du remote.

## 8. Drift

| | |
|---|---|
| Remote | 30 |
| Local | 31 |
| Remote unknown locally | 0 |
| Local-only | exactement `20260815182203_vhs_11c_voice_identity_catalog` |
| Extra local-only | 0 |
| Verdict drift | **admissible** — pas `BLOCKED_VOICE_IDENTITY_REMOTE_MIGRATION_DRIFT` |

## 9. Migration cible et checksum

| | |
|---|---|
| Fichier | `studio/supabase/migrations/20260815182203_vhs_11c_voice_identity_catalog.sql` |
| Versionné dans | `d3bc5fc` |
| Git blob | `103d5b93adafa3e97b264ffe6370e18244965174` |
| SHA-256 | `58069e22849afd82546200be0b6afb4d61c57d962d767830faced2910b77f8ce` |
| BEGIN/COMMIT | oui |
| INSERT / seed | **0** |
| CREATE POLICY | **0** |
| SECURITY DEFINER | **0** |
| voiceId brut | **absent** |

## 10. Analyse des tables

### `voice_identities`

- PK `id` uuid `gen_random_uuid()`
- FK `workspace_id` → `workspaces(id)` NOT NULL
- Types : text / boolean / timestamptz / integer / jsonb
- `secret_locator` + `voice_fingerprint` (sha256 `^[0-9a-f]{64}$`) — **pas** de colonne voiceId
- Defaults : `revocable=true`, `active_for_provider_execution=false`, `revision=1`, `metadata='{}'`
- Timestamps `created_at` / `updated_at` UTC
- Optimistic locking : `revision >= 1`
- Statuts : `prepared|available|unavailable|blocked|revoked`
- CHECK execution **forcée à false**
- UNIQUE `(workspace_id, stable_key)`, `(workspace_id, secret_locator)`, `(workspace_id, voice_fingerprint)`
- Pas de cascade DELETE documentée (FK sans `ON DELETE CASCADE`)
- metadata interdit `xiApiKey`

### `voice_consent_attestations`

- PK `id` uuid
- FK `workspace_id` → `workspaces(id)` ; `voice_identity_id` → `voice_identities(id)` ; `allowed_project_id` nullable → `video_projects(id)`
- Append-only par contrat (GRANT sans UPDATE/DELETE)
- Révocation : nouvelle ligne + `revoked_at` cohérent avec `decision='revoked'`
- UNIQUE `(workspace_id, idempotency_key)`
- Scopes et content kinds bornés
- Pas de voiceId / secret

### `project_voice_bindings`

- PK `id` uuid
- FK `workspace_id` → `workspaces` ; `project_id` → `video_projects` ; `voice_identity_id` → `voice_identities`
- `script_artifact_id` uuid NOT NULL **sans FK** — garde applicative (`script_artifact_belongs_to_project`)
- Révisions : `revision >= 1` ; nouvel enregistrement = nouvelle révision
- Index unique partiel : un narrateur `active` par `(workspace, project, script, script_revision)`
- UNIQUE idempotency `(workspace_id, idempotency_key)`
- Pas de voiceId / secret

## 11. Contraintes

**Garanties DB :**

- stable key unique par workspace
- locator unique par workspace
- fingerprint unique par workspace
- `active_for_provider_execution=false` (CHECK)
- rôle `character` ou `narrator` + cohérence `character_id`
- content kinds bornés
- consentement append-only (pas de GRANT UPDATE)
- idempotency unique
- révocation traçable
- un narrateur `active` non ambigu par projet/script/révision
- provider/modèle bornés (`elevenlabs` / `eleven_multilingual_v2`)

**Gardes applicatives seulement** (déjà fail-closed `142_`) :

- Mei/Tom ne peuvent pas être narrateur
- pas de fallback `ELEVENLABS_VOICE_ID`
- pas de génération automatique
- fingerprint call-time
- appartenance `script_artifact_id` au projet
- consentement rôle = identité
- aucune substitution Mei/Tom

## 12. Index

| Index | Table | Rôle |
|---|---|---|
| `voice_identities_workspace_role_status_idx` | identities | lookup workspace/rôle/statut |
| UNIQUE workspace+stable_key / locator / fingerprint | identities | unicité métier |
| `voice_consent_workspace_identity_created_idx` | consent | historique append-only |
| UNIQUE workspace+idempotency | consent / bindings | idempotence |
| `project_voice_bindings_one_active_narrator_idx` | bindings | un narrateur actif |
| `project_voice_bindings_project_role_status_idx` | bindings | lookup projet |

Aucun de ces noms n’existe en Production.

## 13. RLS

Les trois tables : `ENABLE ROW LEVEL SECURITY`.  
Baseline V2 Production : RLS **on** sur toutes les tables public observées, **0** policy anon/authenticated. Compatible.

## 14. Policies

Migration : **0** `CREATE POLICY`.  
Production comparée (`workspaces`, `video_projects`, `project_artifacts`, `human_review_decisions`, `cost_ledger`) : **0** policy.  
Aucune policy anon/authenticated à créer. Deny-by-default + `service_role` bypass RLS.

## 15. Grants

Matrice **attendue après apply** :

| Table | RLS | Policies | PUBLIC | anon | authenticated | service_role |
|---|---|---|---|---|---|---|
| `voice_identities` | on | 0 | REVOKE ALL | REVOKE ALL | REVOKE ALL | SELECT, INSERT, UPDATE |
| `voice_consent_attestations` | on | 0 | REVOKE ALL | REVOKE ALL | REVOKE ALL | SELECT, INSERT |
| `project_voice_bindings` | on | 0 | REVOKE ALL | REVOKE ALL | REVOKE ALL | SELECT, INSERT, UPDATE |

Plus restrictif que les tables V2 existantes (celles-ci ont aussi DELETE/TRUNCATE `service_role`).  
Aucun GRANT PUBLIC / anon / authenticated. Consentement sans UPDATE/DELETE.

## 16. Collisions

Lecture Production : **0** table, index, contrainte, trigger, fonction, type ou vue portant les noms Voice.  
Les trois tables **n’existent pas**.

## 17. Dépendances

FK cibles confirmées uuid NOT NULL :

- `workspaces.id`
- `video_projects.id` / `workspace_id`
- `project_artifacts.id` (pas de FK SQL depuis bindings)

Ordre de création : identities → consent → bindings → RLS/grants.  
La migration ne dépend d’aucune autre migration locale non appliquée.  
Aucune fonction SECURITY DEFINER existante ne référence ces tables.  
Aucune vue existante ne les expose.  
Pas d’inclusion automatique dans une API cliente (pas de types générés, pas de route).

## 18. Sécurité Voice

Le futur modèle persisté = stable keys, locators, fingerprints, rôles, scopes, consentements, bindings, métadonnées non sensibles.

Ne doit jamais persister : API key, voiceId brut, audio, base64, URL, échantillon vocal, biométrie, texte complet inutile, secret Vercel/local.

Scan SQL : 0 voiceId, 0 assignment `ELEVENLABS_*VOICE_ID=`, 0 seed, 0 SECURITY DEFINER, denylist metadata `xiApiKey` seulement.

## 19. Configuration locale redacted

Vérifié **sans afficher les valeurs** (fichier ignoré) :

| Identité | Locator | Présent | Fingerprint prefix |
|---|---|---|---|
| `narrator_female` | `env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID` | oui | `99db51be34bc…` |
| `narrator_male` | `env:ELEVENLABS_NARRATOR_MALE_VOICE_ID` | oui | `84af11a65704…` |
| `character_mei` | `character:mei:voice` | oui | `1a398f86b113…` |
| `character_tom` | `character:tom:voice` | oui | `456769a82a84…` |

Quatre fingerprints distincts. 0 collision. 0 variable narrateur dans Git.  
Ceci **n’est pas** un seed ni un appel provider.

## 20. Plan d’application

Non exécuté. `migrationApplyAllowed=false`.

1. Revalider Git (`main`, HEAD=origin, AICCOS hors scope).
2. Revalider le drift (30 remote / 1 local-only).
3. Backup / checkpoint applicable (humain).
4. Appliquer **une seule** migration `20260815182203`.
5. Vérifier la version distante = 31, last = Voice catalog.
6. Vérifier les trois tables.
7. Vérifier RLS on.
8. Vérifier 0 policy.
9. Vérifier la matrice de grants.
10. Vérifier contraintes et index.
11. Vérifier tables **vides**.
12. Vérifier runtime Voice OFF.
13. Vérifier budget et assets inchangés.
14. Mettre à jour la doc.

**Pas de seed** dans la même opération.

Porte requise : `AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE`.

## 21. Plan de vérification post-apply

Après une future Auth apply : compter 31 versions distantes ; `to_regclass` des trois tables ; `relrowsecurity=true` ; `pg_policies` vide ; grants = matrice §15 ; 0 ligne ; flags OFF ; budget 437/389/0/48 ; 0 ElevenLabs.

## 22. Plan de rollback

**Documentaire seulement. Non automatique. Non exécuté.**

- Sûr seulement si les trois tables sont **vides** et qu’aucune RPC/vue/app ne les référence.
- Ordre de DROP éventuel : bindings → consent → identities.
- Si des consentements append-only existent : **restauration**, pas DROP. Perte de consentement interdite sans audit humain.
- Après usage réel : rollback SQL interdit sans décision humaine.
- Cette phase ne crée **aucune** migration destructive.

## 23. Plan de seed séparé

Non écrit. Porte future distincte après apply.

- 4 `voice_identities` (locators + fingerprints, execution=false)
- 4 consentements bornés, idempotency déterministe
- **0** binding projet
- **aucun** narrateur sélectionné pour le projet I2V actuel
- fingerprints redacted · locators seulement · 0 voiceId brut

Le choix narrateur du projet actuel = action UI ou porte de binding dédiée, plus tard.

## 24. Dry-run et fingerprint

Dry-run déterministe rejoué 2× : fingerprint identique.

| | |
|---|---|
| `migrationApplyAllowed` | `false` |
| `productionWrites` | `0` |
| `providerCalls` | `0` |
| Drift | admissible |
| SHA-256 migration | `58069e22849afd82546200be0b6afb4d61c57d962d767830faced2910b77f8ce` |

Refuse : drift, table préexistante, RLS absente, policy publique, grant élargi, voiceId dans le SQL, seed intégré, collision locator/fingerprint, >1 local-only, dépendance non satisfaite, checksum modifié.

Fingerprint dry-run (stable, 2× identique) : `3af5d57cb9e2b9062c8f68846ec804670b2001a4a7b9317c6ae47e95d110c431`.

## 25. Tests

| Check | Résultat |
|---|---|
| migrations-static | PASS (31 fichiers) |
| Voice catalog existants | inchangés |
| Preflight ciblés | 10/10 |
| SQL statique / RLS / grants / no seed / no voiceId | PASS |
| Drift + refus | PASS |
| Dry-run + replay | PASS |
| Rollback / seed plans sans write | PASS |
| Redaction | PASS |
| Suite unitaire | **1774/1774** |
| Typecheck / lint / build | PASS |
| Fraîcheur | PASS |
| Secret scan | PASS |
| DB locale / `db reset` | **N/A** — Docker/Podman absent |
| pgTAP / intégration DB / E2E | **non relancés** (historiques) |

## 26. Secret scan

Cible : migration Voice + modules/tests/docs `143_`.  
0 voiceId brut, 0 clé, 0 URL signée, 0 base64, 0 chaîne de connexion.  
`.env.local` ignoré, non scanné en clair dans Git.

## 27. Compteurs Production / provider / média

```text
REMOTE_MIGRATIONS = 0
PRODUCTION_WRITES = 0
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
VOICE_IDENTITIES_SEEDED = 0
VOICE_CONSENTS_PERSISTED = 0
PROJECT_BINDINGS_CREATED = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
```

## 28. Fichiers modifiés

Inclus : module + tests preflight, rapport `143_`, living handover, index, backlog, changelog, checklist, plan migrations, `17_`, Voice/Production/tests, `LEO_NEW_CHAT_HANDOVER.md`.

Exclus : AICCOS, `.env.local`, preview MP4.

## 29. Commit et push

Commit de clôture sur `main` hors AICCOS, puis push si le périmètre reste propre. Voir SHA dans le living handover après commit.

## 30. Verdict

`VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT_READY_FOR_APPLY_AUTH`

Pas de drift bloquant. Pas de collision. SQL/RLS/grants suffisants. Config locale prête (prefixes seulement). 0 write.

## 31. Prochaine porte non exécutée

`AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE`

Autorisation humaine explicite pour appliquer **exactement une** migration structurelle, sans seed, sans provider, sans activation Voice.

Après apply : porte distincte pour persister le catalogue et les consentements ; une autre pour le choix narrateur du projet.
