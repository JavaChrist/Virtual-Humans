# 146 — Phase 11C Voice Identity Catalog Grant Hardening Remote Apply Preflight

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_PREFLIGHT`  
**Nature :** preflight distant **lecture seule** · **0** apply · **0** seed  
**HEAD au départ :** `ced73d0` (`145_`)

```text
VERDICT = VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH
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
MEDIA_READS = 0
MEDIA_WRITES = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
VOICE_IDS_EXPOSED = false
VOICE_RUNTIME = OFF
HARD = 437
COMMITTED = 389
RESERVED = 0
AVAILABLE = 48
RUNTIME_PAID_MEDIA = OFF
MIGRATION_APPLY_ALLOWED = false
SEED_ALLOWED = false
NEXT_AUTH = AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE
```

---

## 1. Autorisation consommée

Christian a autorisé uniquement le preflight distant lecture seule de  
`20260815212100_vhs_11c_voice_identity_catalog_grant_hardening.sql`.

Aucun apply, seed, write Production, provider, flag, média, ni modification des default privileges globaux.

## 2. Git

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `ced73d0` |
| ahead / behind | **0 / 0** |

`documentedHead=ced73d0` · `headStatus=pending commit`.

## 3. Working tree

Hors scope non touchés : AICCOS.  
Hors scope non stagé : `studio/src/app/page.tsx` (retrait cartes dashboard, chat précédent).  
`.env.local` non lu. Preview MP4 hors Git.

## 4. Projet distant

`ejdb…nmvi` · **Virtual Humans Studio** · `eu-west-3` · `ACTIVE_HEALTHY`. MCP `execute_sql` / `list_migrations` uniquement. 0 `apply_migration`.

## 5. Drift

| | |
|---|---|
| Remote | **31** · last `20260815195207_vhs_11c_voice_identity_catalog` |
| Local | **32** |
| Local-only | exactement `20260815212100` |
| Remote inconnu localement | **0** |
| Autre trou | **0** |

Pas de verdict `BLOCKED_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_DRIFT`.

## 6. Migration / checksum / blob

| | |
|---|---|
| Fichier | `studio/supabase/migrations/20260815212100_vhs_11c_voice_identity_catalog_grant_hardening.sql` |
| SHA-256 | `4db521b8165cf870b6d07dcf93f93783bc4fa26fb0beced2cfd2860011937b24` |
| Git blob | `b0eb2eb50ba726df520fa60bb9008e725130bca9` |
| SQL depuis `145_` | **inchangé** |

## 7. Tables et row counts

| Table | Présente | Lignes |
|---|---|---|
| `voice_identities` | oui | 0 |
| `voice_consent_attestations` | oui | 0 |
| `project_voice_bindings` | oui | 0 |

Aucun seed, consentement, binding.

## 8. RLS / policies

RLS on · `relforcerowsecurity=false` · 0 policy · 0 trigger utilisateur · 0 fonction Voice · 0 vue Voice.

## 9. ACL source

`relacl` identique : `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`.

`service_role` : SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER = **true** sur les trois tables.  
PUBLIC / anon / authenticated : tous **false**. PUBLIC oid 0 SELECT = false.

Owner `postgres` : administrateur, distinct du runtime.

## 10. Origine des grants

Overlay `DEFAULT PRIVILEGES` schema `public` (relations), grantors `postgres` / `supabase_admin`.  
Le SQL `144_` a révoqué les clients et accordé la matrice minimale ; il n’a pas retiré DELETE/TRUNCATE/REFERENCES/TRIGGER déjà posés sur `service_role`.

## 11. Delta

Identique à `145_` :

| Table | REVOKE service_role | GRANT |
|---|---|---|
| `voice_identities` | DELETE, TRUNCATE, REFERENCES, TRIGGER | aucun |
| `voice_consent_attestations` | UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | aucun |
| `project_voice_bindings` | DELETE, TRUNCATE, REFERENCES, TRIGGER | aucun |

Pas de verdict `BLOCKED_VOICE_GRANT_HARDENING_REMOTE_PREFLIGHT_SECURITY`.

## 12. ACL cible (futur apply)

| Table | service_role |
|---|---|
| `voice_identities` | SELECT, INSERT, UPDATE |
| `voice_consent_attestations` | SELECT, INSERT |
| `project_voice_bindings` | SELECT, INSERT, UPDATE |

DELETE/TRUNCATE/REFERENCES/TRIGGER = false. Consent UPDATE = false. Clients = 0. RLS on · 0 policy.  
`postgres` owner documenté séparément.

## 13. Audit SQL

BEGIN/COMMIT. REVOKE/GRANT limités aux trois tables et à `service_role` (+ révocation clients).  
0 `ALTER DEFAULT PRIVILEGES` · 0 `ALTER TABLE` · 0 CREATE/DROP · 0 TRUNCATE statement · 0 DML · 0 seed · 0 policy · 0 fonction · 0 rôle · 0 voiceId.

Idempotent au niveau GRANT/REVOKE si la cible est déjà atteinte. **Ne pas** l’exécuter deux fois en Production.

## 14. Plan d’application (non exécuté)

1. revalidation Git/checksum/blob  
2. revalidation remote 31 / local 32  
3. tables vides  
4. ACL source  
5. **une** migration  
6. interdiction d’une seconde invocation  
7. remote 32 / local 32  
8. ACL cible  
9. RLS/policies  
10. tables toujours vides  
11. runtime OFF  
12. budget/assets inchangés  
13. documentation  

`migrationApplyAllowed=false` dans cette phase.

## 15. Gestion d’incertitude

Si un futur apply est ambigu : ne pas rejouer ; relire l’historique distant et les ACL ; déterminer l’état réel ; arrêter sans réparation automatique.  
Migration inscrite + ACL cibles = succès.  
Migration absente + ACL partielles = décision humaine.

## 16. Rollback documentaire

Pas de rollback automatique. Interdit de restaurer les privilèges excessifs ou `GRANT ALL`.  
Préférer : diagnostic → preuve du privilège requis → migration minimale → Auth distincte.

## 17. Dry-run / fingerprint

Module : `phase-11c-voice-identity-grant-hardening-remote-preflight.ts`

`migrationApplyAllowed=false` · `seedAllowed=false` · `productionWrites=0`. Replay identique.

Fingerprint :

`3df33c13191e2ed2e7aa24b00b589a98f0e63dc8539aff065138b45ddb119d80`

## 18. Tests

| Check | Résultat |
|---|---|
| Ciblés remote apply preflight | **7/7** |
| Ciblés grants `145_` | **10/10** |
| migrations-static | PASS · 32 locales |
| Suite unitaire | **1797/1797** |
| Typecheck / lint / build / fraîcheur | **PASS** |
| DB locale / pgTAP / intégration / E2E | **N/A** |

## 19. Secret scan

PASS : 0 voiceId, 0 clé, 0 URL signée, 0 base64, 0 `sk-`.

## 20. Compteurs

Apply distant **0** · writes **0** · seed **0** · ElevenLabs **0** · média **0** · budget/flags **0** · 437 / 389 / 0 / 48¢.

## 21. Fichiers modifiés

- `studio/src/application/production/phase-11c-voice-identity-grant-hardening-remote-preflight.ts`
- `studio/src/application/production/__tests__/phase-11c-voice-identity-grant-hardening-remote-preflight.test.ts`
- `studio/src/application/docs/__tests__/current-state-freshness.test.ts`
- docs : `146_`, living handover, index, backlog, changelog, checklist, plan migrations, `17_`, Voice/security, LEO, roadmap

Hors commit : AICCOS · `page.tsx`.

## 22. Commit / push

`feat(studio): preflight Voice catalog grant hardening apply` hors AICCOS / dashboard.

## 23. Verdict

`VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_PREFLIGHT_READY_FOR_APPLY_AUTH`

Migration unique, checksum inchangé, drift 31/32 admissible, overlay toujours présent, tables vides.

## 24. Prochaine porte non exécutée

`AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE`

Une seule migration ACL. 0 seed. 0 provider. Seed interdit jusqu’à vérification post-apply.
