# 145 — Phase 11C Voice Identity Catalog Grant Hardening Preflight

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_PREFLIGHT`  
**Nature :** audit distant **lecture seule** · migration corrective **locale uniquement** · **0** apply distant · **0** seed  
**HEAD au départ :** `8332bee` (`144_`)

```text
VERDICT = VOICE_IDENTITY_CATALOG_GRANTS_HARDENING_READY_FOR_REMOTE_APPLY_PREFLIGHT
REMOTE_MIGRATIONS_APPLIED_THIS_PHASE = 0
PRODUCTION_WRITES = 0
REMOTE_MIGRATIONS_TOTAL = 31
LOCAL_MIGRATIONS_TOTAL = 32
LOCAL_ONLY = 1
MIGRATION_ALIGNMENT = remote 31 / local 32
VOICE_IDENTITIES_SEEDED = 0
VOICE_CONSENTS_PERSISTED = 0
PROJECT_BINDINGS_CREATED = 0
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
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
MIGRATION_APPLY_ALLOWED = false
SEED_ALLOWED = false
NEXT_AUTH = AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT
```

---

## 1. Autorisation consommée

Christian a autorisé uniquement :

- l’audit lecture seule des privilèges réels des trois tables Voice ;
- l’identification de l’overlay `DEFAULT PRIVILEGES` ;
- la préparation d’une migration locale corrective ;
- les tests statiques des grants attendus.

Interdit et non exécuté : migration distante, seed, écriture Production, ElevenLabs, modification des default privileges globaux, modification AICCOS.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `8332bee` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS protégés |

HEAD final = commit de cette phase. `documentedHead=8332bee` · `headStatus=pending commit`.

## 3. Working tree

Au départ : uniquement AICCOS dirty. Non touchés, non restaurés, non formatés, non stashés. `.env.local` ignoré. Preview MP4 hors Git.

## 4. État migrations avant / après préparation locale

| | Avant (live `144_`) | Après préparation locale |
|---|---|---|
| Remote | **31** · last `20260815195207_vhs_11c_voice_identity_catalog` | **31** inchangé |
| Local | **31** | **32** |
| Local-only | aucune | exactement `20260815212100_vhs_11c_voice_identity_catalog_grant_hardening` |
| Apply distant cette phase | — | **0** |

`list_migrations` relue : 31 versions, dernière = catalog Voice. Aucun `apply_migration`.

## 5. ACL réelles

Audit SELECT-only via catalogues (`relacl`, `role_table_grants`, `has_table_privilege`, `aclexplode`, owner, `pg_default_acl`). Aucune opération destructive.

Owner : `postgres` sur les trois tables. RLS on · `relforcerowsecurity=false` · 0 policy · 0 trigger utilisateur.

`relacl` identique sur les trois tables :

`{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`

PUBLIC / anon / authenticated : **aucun** privilège (`has_table_privilege` = false pour SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER). PUBLIC oid 0 : tous false.

`service_role` actuel (les trois tables) :

| Opération | identities | consent | bindings |
|---|---|---|---|
| SELECT | true | true | true |
| INSERT | true | true | true |
| UPDATE | true | true | true |
| DELETE | true | true | true |
| TRUNCATE | true | true | true |
| REFERENCES | true | true | true |
| TRIGGER | true | true | true |

`postgres` (owner) conserve toutes les capacités administratives. Ce n’est **pas** le rôle runtime.

Rôle MCP courant : `postgres` / `postgres` / `postgres`.

## 6. Source des privilèges

L’overlay n’est pas un GRANT explicite du SQL `144_`. Ce SQL n’accorde que SELECT/INSERT(/UPDATE) et révoque PUBLIC/anon/authenticated.

Cause : `pg_default_acl` schema `public`, objet relation (`r`), grantors `postgres` et `supabase_admin` :

`{postgres=arwdDxtm/…,anon=arwdDxtm/…,authenticated=arwdDxtm/…,service_role=arwdDxtm/…}`

À la création, les default privileges ont posé ALL pour `service_role` (et auraient posé ALL pour anon/authenticated). Le `REVOKE ALL … FROM PUBLIC, anon, authenticated` du catalog a neutralisé les clients. Il n’a **pas** retiré DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN déjà accordés à `service_role`. Le GRANT additif n’enlève rien.

Les grants explosés (`aclexplode`) ont tous `grantor=postgres`, `is_grantable=false`.

Les default privileges **globaux** ne sont pas modifiés par cette phase.

## 7. Matrice cible

| Table | service_role |
|---|---|
| `voice_identities` | SELECT, INSERT, UPDATE |
| `voice_consent_attestations` | SELECT, INSERT |
| `project_voice_bindings` | SELECT, INSERT, UPDATE |

Pour les trois : PUBLIC / anon / authenticated = aucun ; DELETE, TRUNCATE, REFERENCES, TRIGGER = false ; RLS on ; 0 policy.

## 8. Différence réelle / cible

| Table | Rôle | REVOKE requis | GRANT requis |
|---|---|---|---|
| `voice_identities` | service_role | DELETE, TRUNCATE, REFERENCES, TRIGGER | aucun |
| `voice_consent_attestations` | service_role | UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | aucun |
| `project_voice_bindings` | service_role | DELETE, TRUNCATE, REFERENCES, TRIGGER | aucun |

PUBLIC / anon / authenticated : déjà conformes. Overlay **réellement utilisable** par le runtime `service_role` (`has_table_privilege` DELETE/TRUNCATE/UPDATE = true). Un correctif est donc nécessaire. Verdict `NO_FIX_REQUIRED` refusé.

## 9. Fonctions / RPC / routes d’écriture

Inventaire `voice_consent_attestations` :

| Kind | Nom | Persist Production |
|---|---|---|
| in-memory | `persistVoiceConsent` | false |
| in-memory | `persistVoiceIdentityConsent` | false |
| SQL function public | aucune (0 `prosrc` Voice) | false |
| RPC | aucune | false |
| Edge Function | 0 déployée | false |
| Route API | aucune | false |

Aucun SECURITY DEFINER Voice. Aucun trigger destructif. Le store applicatif est append-only en mémoire ; révocation = nouvelle attestation, jamais overwrite. Idempotency unique prévue au schéma (`workspace_id`, `idempotency_key`).

## 10. Append-only

Combinaison suffisante **après** hardening runtime :

- pas de GRANT UPDATE / DELETE / TRUNCATE à `service_role` ;
- pas de SECURITY DEFINER mutante ;
- pas de trigger destructif ;
- pas de policy client ;
- clé d’idempotence unique ;
- révocation par nouvelle attestation.

`postgres` owner conserve le pouvoir d’administration. Ce n’est pas le chemin runtime. Seed **bloqué** jusqu’à apply du hardening.

Pas de verdict `BLOCKED_VOICE_IDENTITY_CATALOG_APPEND_ONLY_SECURITY`.

## 11. Migration corrective

Fichier local uniquement :

`studio/supabase/migrations/20260815212100_vhs_11c_voice_identity_catalog_grant_hardening.sql`

Contenu : REVOKE ALL sur les trois tables (PUBLIC, anon, authenticated, service_role) → GRANT matrice minimale → REVOKE explicite DELETE/TRUNCATE/REFERENCES/TRIGGER (et UPDATE sur consent). Idempotent GRANT/REVOKE.

Ne touche pas : données, tables, contraintes, policies, RLS, default privileges globaux, rôles, seed.

**Non appliquée** à Production.

## 12. Checksum

| | |
|---|---|
| SHA-256 | `4db521b8165cf870b6d07dcf93f93783bc4fa26fb0beced2cfd2860011937b24` |
| Git blob | `b0eb2eb50ba726df520fa60bb9008e725130bca9` |

## 13. Absence de DML / seed

SQL inspecté : 0 `INSERT INTO` / `UPDATE public.` / `DELETE FROM` ; 0 `DROP` / `TRUNCATE` statement ; 0 `ALTER DEFAULT PRIVILEGES` ; 0 `ALTER TABLE` ; 0 policy ; 0 SECURITY DEFINER ; 0 identifiant provider.

## 14. Tables vides

| Table | Lignes |
|---|---|
| `voice_identities` | 0 |
| `voice_consent_attestations` | 0 |
| `project_voice_bindings` | 0 |

Aucune donnée à migrer. Aucun seed partiel. Aucune dépendance métier active. Voice runtime OFF. Vidéo I2V `9be6cb0c…` approved / `active=false`. 0 provider.

## 15. Dry-run et fingerprint

Module : `studio/src/application/production/phase-11c-voice-identity-grant-hardening-preflight.ts`

Compare matrice réelle / cible, REVOKE requis, GRANT requis (vide), migration locale, tables vides, `migrationApplyAllowed=false`, `seedAllowed=false`, `productionWrites=0`.

Refuse : table manquante, données seedées, policy, grant client, migration locale supplémentaire, default privileges globaux, DML, DROP/TRUNCATE, RLS/schéma.

Fingerprint replay :

`6998ca424aac55fab37c1c7d6a2c3e71a037fec05981348cbfdc11a630659852`

## 16. Tests

| Check | Résultat |
|---|---|
| Matrice ACL + migration + no DML/seed/defaults + append-only + dry-run/replay + redaction | **10/10** ciblés |
| migrations-static | PASS · 32 fichiers locaux |
| Suite unitaire | **1790/1790** |
| Typecheck / lint / build | **PASS** |
| Fraîcheur | **PASS** |
| DB locale / pgTAP / intégration / E2E | **N/A** (stack locale non relancée) |

## 17. Secret scan

PASS sur le delta de cette phase : 0 voiceId, 0 clé, 0 URL signée, 0 base64, 0 `BEGIN PRIVATE`, 0 `sk-`. Prefixes fingerprints seulement (déjà publics dans `143_`).

## 18. Compteurs Production / provider / média

| Compteur | Valeur |
|---|---|
| Apply distant | **0** |
| Writes Production | **0** |
| Seed / consent / binding | **0** |
| ElevenLabs / autres providers | **0** |
| Lectures / écritures média | **0** |
| Budget / flags | **0** |
| Hard / committed / reserved / available | **437 / 389 / 0 / 48** |

## 19. Fichiers modifiés

- `studio/supabase/migrations/20260815212100_vhs_11c_voice_identity_catalog_grant_hardening.sql` (nouveau)
- `studio/src/application/production/phase-11c-voice-identity-grant-hardening-preflight.ts` (nouveau)
- `studio/src/application/production/__tests__/phase-11c-voice-identity-grant-hardening-preflight.test.ts` (nouveau)
- `studio/src/application/production/__tests__/phase-11c-voice-identity-remote-preflight.test.ts` (exclut la local-only 32e)
- `studio/src/infrastructure/db/__tests__/migrations-static.test.ts`
- `studio/src/application/docs/__tests__/current-state-freshness.test.ts`
- docs : `145_`, living handover, `00_`, `BACKLOG_V2`, `CHANGELOG`, `CHECKLIST_RELEASE`, `SUPABASE_V2_MIGRATION_PLAN`, `17_`, `13_`, `14_`, `15_`, `18_`, `GLOSSARY`, `LEO_NEW_CHAT_HANDOVER`, `06_ROADMAP_V2`

Hors scope non touchés : `studio/src/app/api/aiccos/send/route.ts`, `studio/src/components/send-to-aiccos.tsx`.

## 20. Commit et push

Commit + push `main` hors AICCOS. Message : `feat(studio): prepare Voice catalog grant hardening`.

## 21. Verdict

`VOICE_IDENTITY_CATALOG_GRANTS_HARDENING_READY_FOR_REMOTE_APPLY_PREFLIGHT`

L’overlay DEFAULT PRIVILEGES est réel et utilisable par `service_role`. La migration locale corrective est prête et bornée. Elle n’est **pas** appliquée.

## 22. Prochaine porte non exécutée

`AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT`

Cette future porte devra revérifier le drift et la migration corrective **sans l’appliquer**.

Aucun seed avant résolution explicite des privilèges. `AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT` reste **après** le hardening distant.
