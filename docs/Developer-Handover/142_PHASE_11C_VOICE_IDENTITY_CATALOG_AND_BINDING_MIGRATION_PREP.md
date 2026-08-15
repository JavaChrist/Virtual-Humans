# 142 — Phase 11C Voice Identity Catalog and Binding Migration Prep

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_IDENTITY_CATALOG_AND_BINDING_MIGRATION_PREP`  
**Nature :** catalogue + règles + sélecteur + migration locale · **0** ElevenLabs · **0** persist Production · **0** apply distant  
**HEAD au départ :** `b2828f8` (`141_`)

```text
VERDICT = VOICE_IDENTITY_CATALOG_DESIGN_READY_BLOCKED_MISSING_SECURE_CONFIG
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
PRODUCTION_WRITES = 0
REMOTE_MIGRATIONS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
AUDIO_ASSETS_CREATED = 0
RESERVATIONS_CREATED = 0
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
NEXT_AUTH = AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT
```

---

## 1. Autorisation humaine

Christian a autorisé la préparation d’un catalogue de **quatre identités distinctes** :

- `character_mei` — dialogue Mei uniquement ;
- `character_tom` — dialogue Tom uniquement ;
- `narrator_female` — `voice_over` si choisie explicitement ;
- `narrator_male` — `voice_over` si choisie explicitement.

Les IDs narrateur ont été fournis séparément. Ils **n’ont pas** été recopiés ici. Cette Auth n’autorise aucun appel ElevenLabs, aucune génération, aucun lipsync, aucune migration distante et aucune écriture Production.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `b2828f8` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS protégés |

## 3. Working tree

Au départ : uniquement les deux fichiers AICCOS (hors périmètre). Non touchés.

## 4. Audit Mei / Tom

Sources SDK (valeurs jamais affichées) :

| Identité | Locator | Provider | Modèle | Locale | Config |
|---|---|---|---|---|---|
| Mei | `character:mei:voice` | elevenlabs | `eleven_multilingual_v2` | `fr` | `characters/Mei SDK v1.0.0/voice/config.json` · status `defined` |
| Tom | `character:tom:voice` | elevenlabs | `eleven_multilingual_v2` | `fr` | `characters/Tom SDK v1.0.0/voice/config.json` · status `defined` |

`141_` a déjà établi : fingerprints distincts · variable globale historique = Mei · Tom ≠ Mei.  
La variable `ELEVENLABS_VOICE_ID` **ne sert plus de fallback**. Tom n’est pas substitué.

## 5. Disponibilité narrator female / male

Locators canoniques :

- `env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID`
- `env:ELEVENLABS_NARRATOR_MALE_VOICE_ID`

Ces variables **ne sont pas** encore présentes dans les locators canoniques de l’environnement Cursor. Les contrats et le sélecteur sont prêts. **Aucune valeur n’a été inventée.** À configurer localement (jamais Git, jamais Vercel dans cette phase).

## 6. Protection des IDs

- Résolution serveur uniquement.
- Persistance prévue : locator + fingerprint SHA-256.
- Vérification call-time du hash.
- Redaction des erreurs.
- Collision de fingerprints refusée.
- Aucun voiceId dans artifacts, tests, rapports ou Git.
- `ELEVENLABS_VOICE_ID` historique documenté comme alias Mei, `usableAsFallback=false`.

## 7. Modèle de données

Trois tables locales :

- `voice_identities` — catalogue, `stable_key` unique par workspace, locator unique, fingerprint unique.
- `voice_consent_attestations` — append-only, `idempotency_key` unique, révocation = nouvelle ligne.
- `project_voice_bindings` — révisions append-only, un narrateur `active` par script/révision.

Aucun seed. Aucun secret. `active_for_provider_execution` forcé à `false` par CHECK.

## 8. Migration locale

Fichier : `studio/supabase/migrations/20260815182203_vhs_11c_voice_identity_catalog.sql`  
Créée via `supabase migration new`. **Non appliquée** en local DB ni en Production.

## 9. RLS / grants

RLS activée. **Aucune** `CREATE POLICY`.  
`REVOKE` PUBLIC/anon/authenticated.  
`GRANT` `service_role` seulement : identities SELECT/INSERT/UPDATE ; consent SELECT/INSERT ; bindings SELECT/INSERT/UPDATE (supersede).  
pgTAP / `db reset` : **N/A** (stack DB locale non relancée).

## 10. Catalogue quatre identités

Toutes `activeForProviderExecution=false`.

| stable_key | role | kinds | Consentement prévu | Statut live |
|---|---|---|---|---|
| `character_mei` | character | dialogue | Mei parlante seulement | préparé (SDK) |
| `character_tom` | character | dialogue | Tom parlant seulement | préparé (SDK) |
| `narrator_female` | narrator | voice_over | choix projet explicite | **unavailable** (env absente) |
| `narrator_male` | narrator | voice_over | choix projet explicite | **unavailable** (env absente) |

Le projet I2V actuel **n’a pas** de narrateur sélectionné.

## 11. Consentements bornés

Attestations in-memory (non persistées Production) : workspace VHS, révocables, pas de consentement global, pas de clonage, pas de substitution, pas de lipsync auto, pas de publication, pas d’appel provider, pas d’autre workspace, pas d’identité dérivée. L’abonnement n’est pas une garantie juridique universelle.

## 12. Règles de sélection

Dialogue : Mei → `character_mei` · Tom → `character_tom` · inconnu / narrateur → refus.  
Voice-over : choix explicite `narrator_female` ou `narrator_male` · Mei/Tom refusés · absence et double choix refusés.  
Aucun fallback global.

## 13. UI

Sélecteur `/director` : Narratrice / Narrateur. Affiche libellé, rôle, langue, disponibilité, consentement. **Aucun voiceId.** Dialogues Mei/Tom affichés comme identités résolues, non substituables. La sélection ne persiste pas et ne génère pas. Inopérant tant que la migration n’est pas appliquée et que les flags restent OFF.

## 14. Intégration GenerationPlan

Le plan Voice référence : stable key, bindingId, consentAttestationId, locator, fingerprint attendu, rôle, script/révision, segment, kind, speaker, locale, selection revision, provenance fingerprint. Aucun voiceId.

## 15. Invalidation après changement

Changement de binding, consentement révoqué, fingerprint, script, speaker ou sélection → plan stale. Pas de génération automatique.

## 16. Dry-run

Synthétique : Mei→Mei · Tom→Tom · VO female/male · VO sans choix bloqué · collision bloquée · 0 provider · 0 persist · fingerprints de plan distincts après changement de sélection.

## 17. Tests

8 tests ciblés couvrent les 25 cas. +1 migrations-static Voice. Suite unitaire **1764/1764**. Typecheck PASS. Lint des fichiers de phase : 0 error. Build PASS. Fraîcheur PASS. Secret scan PASS.  
pgTAP / intégration / E2E : **non relancés**.

## 18. migrations-static

**PASS** · 31 fichiers versionnés (30 Production + 1 locale non appliquée).

## 19. Secret scan

Aucun voiceId, secret, dataUrl ou URL signée ajouté.

## 20. Compteurs

Tous à **0**. Budget **437 / 389 / 0 / 48**. Vidéo `9be6cb0c` inchangée.

## 21. Fichiers modifiés

Catalogue/consent/binding/resolver/plan/dry-run, sélecteur `/director`, settings (noms de variables seulement), migration locale, tests, rapport `142_`, living handover et index. AICCOS exclus.

## 22. Commit et push

Commit de clôture sur `main` hors AICCOS, push normal si périmètre propre.

## 23. Verdict

`VOICE_IDENTITY_CATALOG_DESIGN_READY_BLOCKED_MISSING_SECURE_CONFIG`

Architecture, règles, UI et migration locale prêtes. Les deux variables narrateur restent à injecter dans une config locale protégée :

- `ELEVENLABS_NARRATOR_FEMALE_VOICE_ID`
- `ELEVENLABS_NARRATOR_MALE_VOICE_ID`

## 24. Prochaine porte, non exécutée

`AUTH_11C_VOICE_IDENTITY_CATALOG_REMOTE_MIGRATION_PREFLIGHT`

Vérification sans write : migration locale, état Supabase, drift, RLS/grants, rollback, catalogue, fingerprints redacted, choix narrateur du projet. L’apply distant exigera une Auth distincte. Aucun TTS avant binding Production + live preflight + Auth payante.
