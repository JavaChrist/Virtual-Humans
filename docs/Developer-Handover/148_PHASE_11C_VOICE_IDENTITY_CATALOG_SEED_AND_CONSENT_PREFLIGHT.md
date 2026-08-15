# 148 — Phase 11C Voice Identity Catalog Seed and Consent Preflight

**Date :** 2026-08-16  
**Auth :** `AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_PREFLIGHT`  
**Nature :** preflight **lecture seule** · plan atomique en mémoire · **0** insertion Production  
**HEAD au départ :** `6968876` (`147_`)

```text
VERDICT = VOICE_IDENTITY_CATALOG_SEED_PREFLIGHT_READY_FOR_SINGLE_TRANSACTION_AUTH
PRODUCTION_WRITES = 0
VOICE_IDENTITIES_SEEDED = 0
VOICE_CONSENTS_PERSISTED = 0
PROJECT_BINDINGS_CREATED = 0
PROVIDER_ACTIVE_IDENTITIES = 0
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
SEED_ALLOWED = false
NEXT_AUTH = AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION
```

---

## 1. Autorisation consommée

Christian a autorisé uniquement la **préparation lecture seule** de quatre identités vocales et quatre consentements bornés.

Aucun seed réel, binding, provider, média, budget write, flag ou activation.

## 2. Git

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main | `6968876` |
| ahead / behind | **0 / 0** |

`documentedHead=6968876` · `headStatus=pending commit`.

## 3. Working tree

Hors scope non touchés : AICCOS + `studio/src/app/page.tsx`.  
`.env.local` non affiché. Preview MP4 hors Git.

## 4. État des tables

| | |
|---|---|
| Remote / local | **32/32** · last `20260815215407_vhs_11c_voice_identity_catalog_grant_hardening` |
| Tables | présentes |
| Rows | identities **0** · consents **0** · bindings **0** |
| RLS / policies | on · **0** |

## 5. ACL

Conformes à `147_` :

| Table | service_role | clients |
|---|---|---|
| identities | SELECT+INSERT+UPDATE | aucun |
| consent | SELECT+INSERT · pas d’UPDATE/DELETE/TRUNCATE | aucun |
| bindings | SELECT+INSERT+UPDATE | aucun |

Seed interdit si cette matrice diverge.

## 6. Quatre identities

Toutes `status=available` · `revocable=true` · `active_for_provider_execution=false` · provider `elevenlabs` · modèle `eleven_multilingual_v2` · locale `fr`.

| stable_key | role | character_id | kinds | locator |
|---|---|---|---|---|
| `character_mei` | character | `mei` | dialogue | `character:mei:voice` |
| `character_tom` | character | `tom` | dialogue | `character:tom:voice` |
| `narrator_female` | narrator | null | voice_over | `env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID` |
| `narrator_male` | narrator | null | voice_over | `env:ELEVENLABS_NARRATOR_MALE_VOICE_ID` |

Metadata : version catalogue seulement. 0 secret, 0 voiceId, 0 biométrie.

## 7. IDs / fingerprints redacted

IDs déterministes = workspace + stable key + version catalogue. **Pas** dérivés du voiceId.

| Identité | identity id | consent id | prefix |
|---|---|---|---|
| `character_mei` | `ddf3f39e…` | `4c965cca…` | `1a398f86b113…` |
| `character_tom` | `0e02c5e1…` | `e56a3d23…` | `456769a82a84…` |
| `narrator_female` | `bc1c8046…` | `6fd84baf…` | `99db51be34bc…` |
| `narrator_male` | `8ba260c6…` | `0848b2b9…` | `84af11a65704…` |

Quatre fingerprints distincts. Prefixes identiques à `143_`. 0 collision. 0 valeur exposée.

## 8. Quatre consentements

Append-only. `decision=authorized` · `revocable=true` · `revoked_at=null` · `created_by=christian` ·  
source `christian_explicit_workspace_voice_authorization`.

Aucun consentement n’autorise l’exécution provider, le clonage, la substitution, le lipsync, la publication ou un autre workspace.

## 9. Scopes

| Identité | scope | kinds | projet |
|---|---|---|---|
| Mei | `character_dialogue` | dialogue | null · Mei parlante seulement |
| Tom | `character_dialogue` | dialogue | null · Tom parlant seulement |
| narrator_female | `workspace_voice_over` | voice_over | null · après choix explicite |
| narrator_male | `workspace_voice_over` | voice_over | null · après choix explicite |

Mei/Tom ne sont pas des narrateurs génériques. Les narrateurs ne sont pas des voix Character.

## 10. Absence de binding

`PROJECT_BINDINGS_CREATED=0`. Le projet I2V n’a ni narratrice ni narrateur.  
Après un futur seed : le catalogue proposera les deux narrateurs ; **aucun** projet lié ; **aucun** GenerationPlan Voice ; **aucune** génération ; **aucun** plan historique muté.

## 11. Plan transactionnel

Non exécuté. Ordre futur unique :

1. revalider tables vides ou replay exact ;
2. INSERT idempotent des 4 identities ;
3. vérifier IDs et fingerprints ;
4. INSERT append-only des 4 consentements ;
5. vérifier scopes ;
6. vérifier `active_for_provider_execution=false` ;
7. vérifier bindings=0 ;
8. commit seulement si 8 lignes conformes.

Pas d’UPDATE destructif. Pas d’UPSERT écrasant. INSERT + conflit vérifié + replay `existing`.

## 12. Idempotence

Chaque identité et chaque consentement a une clé distincte, déterministe, non secrète.  
Replay futur : mêmes huit lignes, 0 doublon, refus si contradictoire, jamais d’écrasement locator/fingerprint/consentement.

## 13. CAS / conflits

| Avant | Désiré | Résultat |
|---|---|---|
| table vide | 4+4 | `created` |
| 8 lignes identiques | même plan | `existing` |
| fingerprint/locator/consent divergents | — | `conflict` → rollback |
| binding > 0 | — | rollback |
| identity active | — | rollback |

Attendu après seed : identities 4 · consents 4 · bindings 0 · provider-active 0.

## 14. Rollback transactionnel

Rollback intégral si collision identité/locator/fingerprint, consentement contradictoire, ID non conforme, compteur divergent, binding apparu, ou identité devenue active.

## 15. Dry-run / fingerprint

Dry-run mémoire avec les quatre locators réels, résultats redacted seulement.

```text
seedAllowed=false
productionWrites=0
bindings=0
providerActiveIdentities=0
voiceIdExposed=false
planFingerprint=f2b738919970ebffde4b8bb9fe0e423ec6da6a37d0d206c4b9a0f44182011696
replay=stable
```

Refus prouvés : voix absente, collision, ACL trop larges, table non vide, runtime ON, voiceId dans le payload.

## 16. Tests

| Check | Résultat |
|---|---|
| identities / consents / IDs / idempotency / CAS | PASS |
| transaction rollback / collision / scopes / no binding | PASS |
| active=false / ACL / append-only / dry-run / redaction | PASS |
| Suite unitaire | **1809/1809** |
| migrations-static / typecheck / lint / build | PASS |
| Fraîcheur / secret scan | PASS |
| DB locale / pgTAP / E2E | **N/A** ou historiques |

## 17. Secret scan

PASS. 0 voiceId, 0 secret, 0 URL signée. Prefixes seulement.

## 18. Compteurs

```text
PRODUCTION_WRITES = 0
VOICE_IDENTITIES_SEEDED = 0
VOICE_CONSENTS_PERSISTED = 0
PROJECT_BINDINGS_CREATED = 0
PROVIDER_ACTIVE_IDENTITIES = 0
ELEVENLABS_CALLS = 0
VOICE_RUNTIME = OFF
```

## 19. Fichiers modifiés

Module + tests seed preflight, rapport `148_`, living handover et index. AICCOS + `page.tsx` exclus.

## 20. Commit / push

Message prévu : `feat(studio): preflight Voice catalog seed and consent`  
Push `main` hors AICCOS / dashboard. Pas de force push.

## 21. Verdict

`VOICE_IDENTITY_CATALOG_SEED_PREFLIGHT_READY_FOR_SINGLE_TRANSACTION_AUTH`

## 22. Prochaine porte, non exécutée

`AUTH_11C_VOICE_IDENTITY_CATALOG_SEED_AND_CONSENT_SINGLE_TRANSACTION`

Autorisation humaine distincte exigée pour exactement : 4 identities · 4 consentements · 0 binding · 0 provider · `active_for_provider_execution=false`.

Le choix du narrateur I2V restera une porte ultérieure.
