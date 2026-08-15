# 141 — Phase 11C Voice Narrator Binding and Consent

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_NARRATOR_BINDING_AND_CONSENT`  
**Nature :** binding + attestation · **0** ElevenLabs · **0** persist Production  
**HEAD au départ :** `770e844` (`140_`)

```text
VERDICT = BLOCKED_VOICE_NARRATOR_BINDING_CONFIG_UNAVAILABLE
REFUSE = character_substitution_mei
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
AUDIO_ASSETS_CREATED = 0
VOICE_RUNS_CREATED = 0
VOICE_JOBS_CREATED = 0
RESERVATIONS_CREATED = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
VOICE_ID_EXPOSED = false
PRODUCTION_WRITES = 0
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
NEXT_AUTH = AUTH_11C_VOICE_NARRATOR_IDENTITY_DECISION
```

---

## 1. Autorisation humaine

Christian a autorisé l’usage de la voix ElevenLabs **actuellement configurée dans son abonnement** comme narrateur `voice_over` français du projet I2V `984507af…`.

Cette autorisation **exclut explicitement** la substitution de Tom, Mei ou d’une autre identité, le clonage, le lipsync, la dépense et tout appel provider.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `770e844` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS protégés |

## 3. Working tree

Au départ : uniquement les deux fichiers AICCOS (hors périmètre). Non touchés.

## 4. Source de configuration

Locator : `env:ELEVENLABS_VOICE_ID`  
Source locale observée : `studio/.env.local` (valeur **jamais** affichée).  
Présence : **oui** · classe de longueur : typical.  
Clé API présente : oui (non lue).  
Aucun appel ElevenLabs pour classer la voix.

## 5. Mode de protection du voiceId

- Persistance d’un **locator** (`env:ELEVENLABS_VOICE_ID`), jamais de la valeur.
- Hash sha256 calculé en mémoire.
- Vérification call-time : présence + correspondance de hash.
- Aucun voiceId dans artifacts, tests, rapports ou Git.
- Redaction des erreurs.

## 6. Fingerprint redacted

Préfixe observé : `1a398f86b113…`  
Collision caractère : **Mei** (comparaison de hash avec `characters/Mei SDK v1.0.0/voice/config.json`).  
Tom : **non**.  
Ce préfixe ne révèle pas le voiceId.

## 7. Narrator binding

**Non établi en Production.** Fail-closed.

La voix configurée est la voix d’identité **Mei**. L’Auth courante interdit de substituer Mei au narrateur. Un binding `narrator:project` avec cette voix violerait cette limite.

Le contrat de binding (code + store append-only de test) existe : workspace/projet/narrateur, `voice_over` / `fr` / ElevenLabs / `eleven_multilingual_v2`, locator, fingerprint, `activeForProviderExecution=false`, `revocable=true`.

## 8. Scope

Le binding **aurait pu** couvrir les cinq segments `voice_over` du script `349e2792…` rev.1 (`segment-1`…`segment-5`), même narrateur, même langue, même projet. **Non appliqué.**

Hors scope automatique : dialogues personnage, autre script, autre langue, autre projet, lipsync, voix clonée distincte, nouvelle révision sans revalidation.

## 9. Consentement

Attestation humaine **reçue** et **non persistée** comme `authorized` pour cette voix.

Raison : l’attestation porte sur « la voix configurée », mais cette voix est l’identité Mei. L’Auth dit que cela **n’est pas** une autorisation de substituer Mei. Aucun consentement Voice narrateur admissible n’est donc enregistré.

MV-001 reste un consentement benchmark Motion, **≠** Voice global.

## 10. Limites du consentement

Même si une voix distincte était liée plus tard :

- pas de consentement global ;
- pas de clonage ;
- pas de lipsync automatique ;
- pas de publication ;
- pas d’appel provider dans cette phase ;
- révocable ;
- scope projet uniquement ;
- l’abonnement n’est pas une garantie juridique universelle — seulement une attestation de droits déclarée par Christian.

## 11. Premier persist

**0** écriture Production.

`project_artifacts.artifact_type` est contraint à la liste V2 existante. Il n’existe pas de type `voice_narrator_binding` / `voice_consent_attestation`. Improviser un champ JSON (`audit_log`, `domain_events`, `quality_report`) est interdit.

Blocage secondaire documenté : une migration distante serait nécessaire **après** une voix narrateur distincte (ou une Auth Mei-explicite). Non exécutée.

## 12. Replay

Store de test : premier `created`, replay identique `existing`, 0 doublon. Aucun persist live à rejouer.

## 13. Conflits testés

Tom/Mei substitution, autre projet, dialogue, autre langue, fingerprint mismatch, locator absent, consentement révoqué/contradictoire, clonage, optimistic lock. Tous refusés.

## 14. Référence Voice résolue

Live : **refusée** (`character_substitution_mei`).  
`ExistingVoiceReference` n’est construite que dans les tests synthétiques (voix fixture ≠ Tom/Mei).

## 15. executionAuthorized

`false`

## 16. providerCallAllowed

`false`

## 17. Pricing status

Catalogue non ferme. Estimate théorique 1–3¢ pour 81 caractères. Plan non vérifié. 0 appel ElevenLabs.

## 18. Budget

Inchangé : **437 / 389 / 0 / 48**. Hard live `437`. 0 réserve.

## 19. Flags

Tous OFF, 0 write Vercel. VHS11C / VHS11B / VHS124 / Motion / Paid Generation OFF.

## 20. Compteurs

Tous à **0**. `VOICE_ID_EXPOSED=false`. Vidéo `9be6cb0c` inchangée.

## 21. Tests

8 tests ciblés binding/consent couvrent les 30 cas demandés. Wiring 11C : 15 tests. Suite unitaire **1755/1755** (2 skipped historiques). Typecheck PASS. Lint des fichiers de phase : 0 error. Build PASS. Fraîcheur PASS. Secret scan PASS.  
pgTAP / intégration / E2E : **non relancés**.

## 22. Secret scan

Aucun voiceId, secret, dataUrl ou URL signée ajouté. Script de sonde temporaire **supprimé**.

## 23. Fichiers modifiés

Contrats binding/consent/locator/resolver, tests, rapport `141_`, living handover et index. AICCOS exclus.

## 24. Commit et push

Commit de clôture sur `main` hors AICCOS, push normal si périmètre propre.

## 25. Verdict

`BLOCKED_VOICE_NARRATOR_BINDING_CONFIG_UNAVAILABLE`

La configuration pointe vers la voix d’identité Mei. Le binding narrateur est **ambigu / interdit** sous l’Auth courante. Runtime OFF.

## 26. Prochaine porte, non exécutée

`AUTH_11C_VOICE_NARRATOR_IDENTITY_DECISION`

Décision humaine unique :

- configurer et désigner une voix narrateur **distincte** de Tom et Mei ; **ou**
- autoriser **explicitement** l’usage de la voix Mei comme narrateur `voice_over` de ce projet (nouvelle Auth, ce n’est pas implicitement couvert).

Une persistance Production exigera ensuite une **migration** distincte (`voice_narrator_binding` / `voice_consent_attestation`). Pas d’appel TTS avant live preflight + Auth payante.
