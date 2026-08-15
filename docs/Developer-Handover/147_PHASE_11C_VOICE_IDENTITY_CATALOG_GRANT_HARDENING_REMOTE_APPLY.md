# 147 — Phase 11C Voice Identity Catalog Grant Hardening Remote Apply

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_IDENTITY_CATALOG_GRANT_HARDENING_REMOTE_APPLY_ONCE`  
**Nature :** **une** migration ACL Production · **0** seed · **0** ElevenLabs · **0** activation  
**HEAD au départ :** `2db8249` (`146_`)

```text
VERDICT = VOICE_IDENTITY_CATALOG_GRANTS_HARDENED_REMOTE_TABLES_EMPTY_RUNTIME_OFF
REMOTE_MIGRATIONS_APPLIED_THIS_PHASE = 1
REMOTE_MIGRATIONS_TOTAL = 32
LOCAL_MIGRATIONS_TOTAL = 32
MIGRATION_ALIGNMENT = 32/32
VOICE_TABLES_ROWS = 0/0/0
VOICE_IDENTITIES_SEEDED = 0
VOICE_CONSENTS_PERSISTED = 0
PROJECT_BINDINGS_CREATED = 0
SECOND_APPLY = 0
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
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
NEXT_AUTH = AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT
```

---

## 1. Autorisation humaine

Christian a autorisé **exactement une** application ACL Production de  
`20260815212100_vhs_11c_voice_identity_catalog_grant_hardening`  
(fichier, SHA-256 et Git blob exacts).

Aucun seed, consentement, binding, provider, média, budget write, flag ou activation Voice.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `2db8249` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS + `page.tsx` protégés |

HEAD final = commit de clôture de cette phase. Rename local = `0a1b432`. `documentedHead=0a1b432` · `headStatus=pending commit`.

## 3. Working tree

Au départ : AICCOS + `studio/src/app/page.tsx` dirty hors scope. **Non touchés, non stagés.**  
`.env.local` non lu. Preview MP4 hors Git.

## 4. Projet distant

`ejdb…nmvi` · **Virtual Humans Studio** · `eu-west-3` · `ACTIVE_HEALTHY` avant et après.

## 5. État avant

| | |
|---|---|
| Remote | **31** · last `20260815195207_vhs_11c_voice_identity_catalog` |
| Local | **32** |
| Local-only | exactement grant hardening |
| Tables Voice | **présentes** · 0 / 0 / 0 |
| Overlay | `service_role=arwdDxtm` |
| RLS / policies | on · 0 policy |
| Clients | PUBLIC / anon / authenticated = 0 |
| Voice runtime | OFF |
| Budget | 437 / 389 / 0 / 48¢ |
| Compteurs métier | workspaces 1 · projects 4 · artifacts 35 · revisions 17 · assets 9 · HR 6 · director_runs 29 · jobs 4 · attempts 2 · ledger 69 · reservations 26 · budget policies 1 |

## 6. Checksum et blob

| | |
|---|---|
| SHA-256 | `4db521b8165cf870b6d07dcf93f93783bc4fa26fb0beced2cfd2860011937b24` |
| Git blob | `b0eb2eb50ba726df520fa60bb9008e725130bca9` |
| Après rename local | **identiques** (contenu inchangé) |

## 7. Préconditions

Les 20 préconditions ont passé : HEAD `2db8249` = origin/main · 0/0 · hors scope AICCOS/`page.tsx` · SHA-256 · blob · SQL relue · identité 145_/146_ · remote 31 / local 32 · une local-only · 3 tables présentes et vides · RLS on / 0 policy · 0 privilège client · overlay excessif · 0 fonction/RPC/trigger Voice · 0 seed · Voice OFF · projet healthy · SQL sans DML/DROP/TRUNCATE/defaults globaux · checksum/fingerprint preflight.

Aucune divergence `BLOCKED_VOICE_GRANT_HARDENING_APPLY_DIVERGENCE`.

## 8. Mécanisme d’apply

| | |
|---|---|
| Outil | MCP `apply_migration` |
| name | `vhs_11c_voice_identity_catalog_grant_hardening` |
| query | SQL exact du fichier autorisé |
| Invocations | **1** |
| `supabase db push` | non |
| SQL ad hoc | non |
| Seed | non |

## 9. Nombre d’invocations

**1.** Succès `true`. Aucune autre version. Aucun second apply.

## 10. Gestion de l’incertitude

Résultat non ambigu : historique + ACL cibles + tables vides. **Aucun second apply.**

MCP a généré la version `20260815215407` (mécanisme déjà validé `21_` / `82_` / `144_`).  
Réconciliation locale : `git mv` du fichier uniquement. SQL, SHA-256 et blob **inchangés**.

Pas de verdict `BLOCKED_VOICE_GRANT_HARDENING_APPLY_UNCERTAIN`.

## 11. Historique après

| | |
|---|---|
| Remote | **32** |
| Local | **32** |
| Alignement | **32/32** |
| Dernière | `20260815215407_vhs_11c_voice_identity_catalog_grant_hardening` |
| Drift | **0** |

## 12. ACL finales détaillées

`relacl` post-apply :

| Table | postgres | service_role |
|---|---|---|
| `voice_identities` | `arwdDxtm` | `arw` |
| `voice_consent_attestations` | `arwdDxtm` | `ar` |
| `project_voice_bindings` | `arwdDxtm` | `arw` |

`has_table_privilege` `service_role` :

| Table | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER |
|---|---|---|---|---|---|---|---|
| identities | true | true | true | false | false | false | false |
| consent | true | true | **false** | false | false | false | false |
| bindings | true | true | true | false | false | false | false |

Clients (trois tables) : PUBLIC / anon / authenticated = **aucun** privilège.

Pas de `GRANT ALL`. Pas de modification globale des default privileges.

## 13. RLS / policies

RLS **on**. **0** policy. Deny-by-default hors `service_role`.

## 14. Structure

Owner `postgres` inchangé. **0** trigger utilisateur. **0** fonction / vue / RPC Voice.  
Contraintes et index inchangés. Consent append-only durci (pas d’UPDATE runtime).

## 15. Row counts

`voice_identities=0` · `voice_consent_attestations=0` · `project_voice_bindings=0`

## 16. Absence de seed

0 identité · 0 consentement · 0 binding · 0 locator/fingerprint persisté.

## 17. Invariants métier

Tous les compteurs §5 **inchangés**.  
Vidéo `9be6cb0c…` : `status=approved` · `active=false` · `published=false`.

## 18. Budget / flags

`hard_limit_minor=437` live. Ledger 69 / reservations 26 inchangés.  
Committed/reserved/available **non recalculés** (dernier connu 389 / 0 / 48). 0 écriture budget.  
Tous les flags Voice / I2V / Image / Paid Media **OFF**. 0 write Vercel.

## 19. Replay read-only

ACL déjà conformes. `migrationNeeded=false`. `secondApply=false`.  
`seedAllowed` seulement pour une porte future distincte. **Aucun second write.**

## 20. Tests

| Check | Résultat |
|---|---|
| migrations-static | PASS · 32/32 |
| Alignement 32/32 | PASS |
| ACL source/cible · RLS · policies · tables vides · consent append-only · no-second-apply | PASS |
| Voice Catalog | PASS |
| Suite unitaire | **1801/1801** |
| Typecheck / lint / build | PASS |
| Fraîcheur / secret scan | PASS |
| DB locale / pgTAP / E2E | **N/A** ou historiques |

## 21. Secret scan

PASS sur migration, modules apply, rapport `147_`. 0 voiceId, 0 secret.

## 22. Compteurs

```text
REMOTE_MIGRATIONS_APPLIED_THIS_PHASE = 1
REMOTE_MIGRATIONS_TOTAL = 32
LOCAL_MIGRATIONS_TOTAL = 32
MIGRATION_ALIGNMENT = 32/32
VOICE_TABLES_ROWS = 0/0/0
SECOND_APPLY = 0
ELEVENLABS_CALLS = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
VOICE_RUNTIME = OFF
```

## 23. Fichiers modifiés

Rename migration (même blob), module apply + tests, constantes timestamp, rapport `147_`, living handover et index. AICCOS + `page.tsx` exclus.

## 24. Commit / push

Rename : `0a1b432` `feat(studio): harden Voice catalog grants remotely`.  
Clôture docs/tests : commit suivant, même périmètre. Push `main` hors AICCOS / dashboard. Pas de force push.

## 25. Verdict

`VOICE_IDENTITY_CATALOG_GRANTS_HARDENED_REMOTE_TABLES_EMPTY_RUNTIME_OFF`

Pas de `BLOCKED_VOICE_GRANT_HARDENING_POSTCHECK`.

## 26. Prochaine porte, non exécutée

`AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT`

Préparer, **sans écrire** : quatre identities, quatre consentements bornés, locators/fingerprints redacted, `active_for_provider_execution=false`, 0 binding projet, idempotency/CAS, 0 provider.

Le seed réel exigera une autorisation humaine distincte.
