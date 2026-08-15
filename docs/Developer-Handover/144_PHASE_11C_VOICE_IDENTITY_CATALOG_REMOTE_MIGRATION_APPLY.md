# 144 — Phase 11C Voice Identity Catalog Remote Migration Apply

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLY_ONCE`  
**Nature :** **une** migration structurelle Production · **0** seed · **0** ElevenLabs · **0** activation  
**HEAD au départ :** `2b2b856` (`143_`)

```text
VERDICT = VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLIED_EMPTY_RUNTIME_OFF
REMOTE_MIGRATIONS_APPLIED = 1
REMOTE_MIGRATIONS_TOTAL = 31
LOCAL_MIGRATIONS_TOTAL = 31
MIGRATION_ALIGNMENT = 31/31
VOICE_TABLES_CREATED = 3
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
NEXT_AUTH = AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT
```

---

## 1. Autorisation humaine

Christian a autorisé l’application **unique** de `20260815182203_vhs_11c_voice_identity_catalog` (fichier, SHA-256 et blob exacts) sur Supabase Production `ejdb…nmvi`.

Aucun seed, consentement, binding, appel ElevenLabs ou activation Voice.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `2b2b856` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS protégés |

HEAD final = commit de cette phase. `documentedHead=2b2b856` · `headStatus=pending commit`.

## 3. Working tree

Au départ : uniquement AICCOS dirty. Non touchés. `.env.local` ignoré. Preview MP4 hors Git.

## 4. Projet distant

`ejdb…nmvi` · **Virtual Humans Studio** · `eu-west-3` · `ACTIVE_HEALTHY` avant et après. Postgres 17.6.1.147.

## 5. État avant

| | |
|---|---|
| Remote | **30** · last `20260811211757_vhs_mt005_human_review_decision_extend` |
| Local | **31** |
| Tables Voice | **absentes** · 0 collision |
| Compteurs métier | workspaces 1 · projects 4 · artifacts 35 · revisions 17 · assets 9 · HR 6 · director_runs 29 · jobs 4 · attempts 2 · ledger 69 · reservations 26 · budget policies 1 |

## 6. Checksum et blob

| | |
|---|---|
| SHA-256 | `58069e22849afd82546200be0b6afb4d61c57d962d767830faced2910b77f8ce` |
| Git blob | `103d5b93adafa3e97b264ffe6370e18244965174` |
| Après rename local | **identiques** (contenu inchangé) |

## 7. Préconditions

Les 20 préconditions ont passé : Git, checksum, blob, 30 remote, 1 local-only, tables absentes, 0 collision, projet healthy, 0 INSERT/voiceId, RLS/grants SQL, 4 locators redacted, flags OFF.

## 8. Mécanisme d’apply redacted

| | |
|---|---|
| Outil | MCP `apply_migration` |
| name | `vhs_11c_voice_identity_catalog` |
| query | SQL exact du fichier autorisé |
| Invocations | **1** |
| `supabase db push` | non |
| SQL ad hoc | non |

## 9. Nombre de migrations appliquées

**1.** Succès `true`. Aucune autre version.

## 10. Gestion de l’incertitude

Résultat non ambigu : historique + 3 tables conformes. **Aucun second apply.**

MCP a généré la version `20260815195207` (comportement connu, `21_` / `82_`). Réconciliation locale : rename du fichier uniquement, SQL inchangé.

## 11. Historique après

| | |
|---|---|
| Remote | **31** |
| Local | **31** |
| Alignement | **31/31** |
| Dernière | `20260815195207_vhs_11c_voice_identity_catalog` |
| Drift | **0** |

## 12. Tables

`voice_identities` · `voice_consent_attestations` · `project_voice_bindings`  
Owner `postgres`. Aucune autre table métier inattendue.

## 13. Colonnes

Types, nullability et defaults conformes au SQL autorisé. Pas de colonne voiceId.

## 14. Contraintes

PK, FK, CHECK, UNIQUE présentes, y compris `active_for_provider_execution = false` et l’unicité workspace/stable_key/locator/fingerprint.

## 15. Index

Index attendus présents, dont `project_voice_bindings_one_active_narrator_idx`. 0 trigger utilisateur.

## 16. RLS

RLS **on** · `relforcerowsecurity=false` sur les trois tables.

## 17. Policies

**0** policy. Deny-by-default hors `service_role`.

## 18. Grants

| Rôle | Résultat |
|---|---|
| PUBLIC / anon / authenticated | **aucun** · `has_table_privilege(SELECT)=false` |
| service_role explicite | SELECT/INSERT/UPDATE (identities, bindings) · SELECT/INSERT (consent) |
| Overlay DEFAULT PRIVILEGES | DELETE/TRUNCATE/REFERENCES/TRIGGER `service_role` — **identique aux tables V2** |

Pas de réparation automatique. Aucun grant client.

## 19. Row counts

`voice_identities=0` · `voice_consent_attestations=0` · `project_voice_bindings=0`

## 20. Absence de seed

0 identité · 0 consentement · 0 binding · 0 locator/fingerprint persisté.

## 21. Invariants métier existants

Tous les compteurs §5 **inchangés**.

## 22. Budget

`hard_limit_minor=437` live. Ledger 69 / reservations 26 inchangés. Committed/reserved/available **non recalculés** (dernier connu 389 / 0 / 48). 0 écriture budget.

## 23. Flags

Tous les flags Voice / I2V / Image / Paid Media **OFF**. 0 write Vercel.

## 24. Provider / media

```text
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
```

## 25. Tests

| Check | Résultat |
|---|---|
| migrations-static | PASS · 31 alignées |
| Alignement 31/31 | PASS |
| SQL / RLS / policies / grants / vides | PASS |
| Voice catalog | PASS |
| Suite unitaire | **1779/1779** |
| Typecheck / lint / build | PASS |
| Fraîcheur / secret scan | PASS |
| DB locale / pgTAP / E2E | **N/A** ou historiques |

## 26. Secret scan

PASS sur migration, modules apply, rapport `144_`. 0 voiceId, 0 secret.

## 27. Fichiers modifiés

Rename migration (même blob), constantes/tests, rapport `144_`, living handover et index. AICCOS exclus.

## 28. Commit et push

Commit de clôture hors AICCOS, puis push si le périmètre reste propre.

## 29. Verdict

`VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_APPLIED_EMPTY_RUNTIME_OFF`

## 30. Prochaine porte non exécutée

`AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT`

Préparer en lecture seule quatre identités et quatre consentements bornés, sans binding, sans write Production. Le seed réel exigera une Auth distincte.
