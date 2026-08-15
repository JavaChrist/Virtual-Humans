# 140 — Phase 11C Voice/TTS Production Wiring Preflight

**Date :** 2026-08-15  
**Auth :** `AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT`  
**Nature :** audit + câblage + tests fakes · **0** ElevenLabs · **0** média Production · **0** réservation  
**HEAD au départ :** `df514c9` (`139_`)

```text
VERDICT = VOICE_TTS_PATH_WIRED_DISABLED_BLOCKED_VOICE_OR_CONSENT
PHASE_COST = 0
ELEVENLABS_CALLS = 0
FAL_CALLS = 0
OPENAI_CALLS = 0
OTHER_PROVIDER_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
PRODUCTION_WRITES = 0
RESERVATIONS_CREATED = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
VOICE_RUNTIME = OFF
VOICE_DOWNSTREAM = OFF
LIPSYNC = OFF
MERGE_EXPORT = OFF
VIDEO_ACTIVE = false
HARD = 437
COMMITTED = 389
RESERVED = 0
AVAILABLE = 48
RETRY = 0
FALLBACK = 0
RUNTIME_PAID_MEDIA = OFF
NEXT_AUTH = AUTH_11C_VOICE_NARRATOR_BINDING_AND_CONSENT
```

---

## 1. Autorisation consommée

`AUTH_11C_VOICE_TTS_PRODUCTION_WIRING_PREFLIGHT` — Christian, chat courant.

Audit, conception, câblage et tests avec fakes du chemin Voice/TTS `/director`. Aucun appel ElevenLabs, aucun provider réel, aucun média Production, aucune réservation, aucune écriture métier Production, aucune ouverture de flag Vercel.

## 2. Git initial et final

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `df514c9` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS protégés · non touchés |
| Preview MP4 | gitignorée · non touchée |

## 3. Working tree

Au départ : uniquement `studio/src/app/api/aiccos/send/route.ts` et `studio/src/components/send-to-aiccos.tsx` (hors périmètre).  
Cette phase n’a ni restauré, ni reformaté, ni stashé ces fichiers.

## 4. Inventaire de l’existant

| Élément | Classe |
|---|---|
| Interface `/voice` | **legacy seulement** · interdit comme preuve Production |
| Endpoint `/api/generate/voice` | **legacy seulement** · dataUrl MP3 |
| Usages Voice Scene / Storyboard | **réutilisable avec hardening** (`spokenContent.kind` + `sourceText`) |
| `lib/providers/elevenlabs-voice.ts` | **legacy seulement** · fallback silencieux `ELEVENLABS_VOICE_ID` · dataUrl |
| `createElevenLabsVoiceAdapter` | **réutilisable avec hardening** · voiceId explicite · sortie encore mappée via dataUrl |
| `ElevenLabsVoiceClientPort` | **réutilisable avec hardening** · pas d’id de requête · dataUrl |
| Modèle `eleven_multilingual_v2` | **réutilisable tel quel** |
| Config voix Tom / Mei SDK | **legacy / non bound** au narrateur I2V · ids bruts hors contrat Production |
| `ELEVENLABS_VOICE_ID` | **interdit** comme fallback Production |
| Pricing `estimateVoice` / 0,15 USD/1k | **réutilisable avec hardening** · catalogue, **non ferme** |
| Capability `audio.voice` | **réutilisable tel quel** |
| Action `voice` | **réutilisable tel quel** |
| Stratégie library `voice_over` | **réutilisable avec hardening** · template T2V+TTS ; 11C n’instancie que la slice TTS |
| Registry / Router | **réutilisable avec hardening** · profil ElevenLabs Production **disabled** |
| Generation Engine | **réutilisable avec hardening** · tests fake existants ≠ preuve `/director` |
| Worker | **réutilisable avec hardening** · sync TTS : submit intent + buffer durable |
| Budget / ledger | **réutilisable tel quel** · compare-only cette phase |
| Storage audio | **manquant** comme preuve Production · path conçu, **0 write** |
| QC audio | **manquant** perceptuel · technique conçu · `unavailable_humanOnly` |
| Human Review Voice | **manquant** live · handoff conçu · APPROVE ≠ lipsync |
| Fake adapter universel | **interdit** en Production |
| Tests Engine/Director Voice | **fake seulement** |
| Data URLs | **interdit** comme persistance Production |
| Persistance locale / navigateur | **interdit** comme preuve Production |
| Lien lipsync | **hors scope** · vidéo I2V = contexte futur seulement |

## 5. Composants réutilisés

- Capability `audio.voice`, action `voice`, modèle `eleven_multilingual_v2`.
- `createElevenLabsVoiceAdapter` (contrat voiceId explicite).
- `generation-attempt-terminal-state.ts`.
- Bundle I2V explicite `139_` (`3d1858eb` rev.3, vidéo `9be6cb0c`).
- `estimateVoice`, `parseStrictEnabledFlag`, `fromLegacyUsdEstimate`.
- Script I2V actif `349e2792` rev.1 + storyboard `7cf183c1` + scene package `2e8e9e6f` rev.2.

## 6. Composants durcis

- Résolution explicite workspace/projet/scène/script/segment — **pas** de pointeurs actifs mélangés.
- Voix : aucun fallback `ELEVENLABS_VOICE_ID`.
- Adapter Production : buffer mémoire / ingest simulé · **aucune** dataUrl persistée.
- Router/allowlist : refuse voix absente, consent insuffisant, script étranger, texte vide/trop long, modèle hors liste, fake universel, lipsync, merge_audio, flags OFF.
- Worker sync : `submission_unknown` sans second appel ; attempt terminal ; settlement une fois.

## 7. Composants ajoutés

- `existing-voice-reference.ts`
- `phase-11c-voice-allowlist.ts`
- `phase-11c-spoken-segment.ts`
- `phase-11c-voice-reference.ts`
- `phase-11c-single-step-plan.ts`
- `phase-11c-voice-worker.ts`
- `phase-11c-voice-ingest.ts`
- `phase-11c-voice-qc.ts`
- `phase-11c-voice-human-review.ts`
- `phase-11c-voice-dry-run.ts`
- tests `phase-11c-voice-tts-production-wiring.test.ts`

## 8. Script et segment canonique (redacted)

Lecture MCP métadonnées uniquement, projet I2V `984507af…`, **0** dump de texte complet.

| Champ | Valeur |
|---|---|
| Workspace | `3c308f57…` |
| Projet | `984507af…` (projet I2V exact) |
| Scène | `scene-2` |
| Script | `349e2792…` rev. **1** actif |
| Storyboard | `7cf183c1…` rev. 1 |
| Scene package set | `2e8e9e6f…` rev. 2 |
| Segment | `segment-2` |
| Kind | `voice_over` |
| Speaker | narrateur (pas un personnage) |
| Langue | `fr` |
| Hash | `f228654fc7fbb60731d02e8609e8520ef935fb8dba92e501fccafb9def3547d6` |
| Caractères | **81** |
| Extrait redacted | `Pass…` |
| Durée scène | 7,01 s |
| Provenance | script actif + `spokenContent.sourceText` storyboard · **même hash** |

Les cinq segments du script sont des `voice_over`. Aucun dialogue personnage. Le texte Production n’est pas recopié ici.

## 9. Référence de voix

Contrat `ExistingVoiceReference` v1.0.0 : workspace, projet, characterId/narratorId, provider, `voiceConfigIdRedacted` (`el-voice:********`), modèle, langue, source, consent, restrictions, fingerprint. **Aucune clé API.**

État live I2V : **aucune** liaison narrateur explicite. Tom/Mei ont une config technique SDK, non autorisée comme narrateur de ce projet, et non substituable. Fail-closed. Pas de fallback env.

## 10. Consentement

| Distinguer | Statut live |
|---|---|
| Config technique de voix | absente pour le narrateur projet |
| Autorisation d’utiliser cette voix | **insuffisante** |
| Consentement global | **non** |
| Consentement limité benchmark | Privacy Pack MV-001 **≠** Voice |
| Identité personnage | non liée au segment `voice_over` |
| Voix clonée | non prouvée · interdite sans Auth |

Le wiring est livré désactivé. Tout futur appel réel reste bloqué tant que voix + consentement Voice ne sont pas explicitement liés.

## 11. Capability / action / strategy

- capability : `audio.voice`
- action : `voice`
- provider : `elevenlabs`
- modèle : `eleven_multilingual_v2`
- stratégie plan : slice `spoken_tts_single_step` (id library `voice_over`, **sans** étape T2V/mux)

Distinct de lipsync, merge_audio, Motion, I2V, legacy `/api/generate/voice`, fake universel.

## 12. GenerationPlan Voice

Single-step, déterministe, **non persisté**, **non actif**. Référence :

- bundle I2V explicite GP `3d1858eb` rev.3 / run `4c5b53a5` / output `9be6cb0c` ;
- vidéo approuvée comme **contexte lipsync futur uniquement** · 0 lecture MP4 ;
- script `349e2792` rev.1 · segment-2 · hash texte ;
- voix fixture dry-run seulement ;
- ElevenLabs / `eleven_multilingual_v2` ;
- output audio unique ;
- Human Review obligatoire.

Contraintes : max 1 call / 1 job / 1 output · retry=0 · fallback=0 · lipsync/merge/export/activation/downstream OFF.

## 13. Bundle I2V explicite

Réutilisé via `buildPhase11BExplicitI2vBundle` + stratégie C. Ensemble naïf des pointeurs actifs **non utilisé**. Le GP I2V n’est pas activé. La vidéo n’est pas mutée.

## 14. Registry / Router

Profil ElevenLabs Voice : `disabled` · `paidExecution=false` · `globallyEligible=false` · allowlist stricte workspace/projet/scène/voix/texte/langue. Aucune wildcard. Aucun fallback. Aucune autre voix automatique.

Le Router refuse : voix absente, consent insuffisant, script d’un autre projet, texte vide/trop long, modèle hors liste, autre provider, lipsync, merge_audio, fake universel, budget non autorisé, flags OFF.

## 15. Adapter / client ElevenLabs

Réutilisation du port existant. Hardening Production :

- voiceId explicite obligatoire ;
- modèle exact ;
- output attendu `audio/mpeg` / `mp3_44100_128` côté legacy ;
- timeout 60 s sur le step ;
- erreurs redacted ;
- idempotency key déterministe ;
- max texte 400 ;
- max réponse 5 MiB ;
- pas de fallback, pas de retry auto.

Le client actuel **ne fournit pas** d’identifiant de requête exploitable. **Aucun** `providerJobId` n’est inventé pour un appel synchrone.

## 16. Worker / idempotence

Chemin durable conçu pour un TTS potentiellement synchrone :

1. réservation compare-only (cette phase : non créée) ;
2. submit intent durable ;
3. un appel maximum ;
4. run/job/attempt uniques ;
5. idempotency key = sha256(workspace|projet|scène|script|rev|segment|hash|voix|modèle|wire) ;
6. `submission_unknown` sans nouvel appel ;
7. attempt terminal via `generation-attempt-terminal-state.ts` ;
8. settlement au plus une fois ;
9. replay sans second appel ;
10. aucune reprise lipsync.

Preuves tests : succès → `completed` ; erreur → `failed` `retryable=false` ; inconnu → `prudent_hold` · 0 second call.

## 17. Gestion du résultat synchrone

Si les octets sont durablement disponibles (`durableAudio.persisted`) : reprise locale d’ingest, **sans** nouvel appel.  
Si crash après réponse HTTP avant persist des octets : état `submission_unknown` / prudent — **interdit** de relancer TTS.  
Mécanisme minimal avant un futur appel réel : persister le buffer audio privé **avant** le settlement. Non écrit cette phase.

## 18. Storage audio

Conçu, **0 write** :

- bucket privé `production-private` (contrat) ;
- path `{workspace}/{project}/scene-2/audio/voice/{assetId}.mp3` ;
- MIME `audio/mpeg` ;
- max 5 MiB ;
- checksum sha256 ;
- durée / sample rate / channels / bitrate si probe (sinon unavailable) ;
- no overwrite ;
- `active=false` ;
- provenance script → voix → audio · vidéo I2V contexte only ;
- aucune URL ni dataUrl persistée.

## 19. QC

Technique : MIME, taille, checksum, décodabilité, durée, sample rate, channels, bitrate, silence (si mesurable), cohérence durée/texte, provenance, estimate.  
Perceptuel (langue, intelligibilité, prononciation, rythme, ton, fidélité, clipping, identité, naturel) : **`unavailable_humanOnly`**. Aucun score inventé. Human Review obligatoire.

## 20. Human Review

Handoff append-only simulé : APPROVE / REJECT / commentaire / optimistic lock / replay idempotent.  
Pas de retry auto, pas d’activation, pas de lipsync auto.  
APPROVE Voice = audio **utilisable plus tard** pour une porte lipsync. **N’autorise pas** cette porte.

## 21. Pricing

Source primaire [elevenlabs.io/pricing](https://elevenlabs.io/pricing) (2026-08-15) : 1 caractère = 1 crédit pour les modèles Multilingual v2. Le **USD dépend du plan** (Free / Starter 30k / Creator 121k / Pro…).  
Code local : `ELEVENLABS_USD_PER_1K_CHARS` défaut **0,15** — catalogue indicatif.  
Plan réel configuré : **non prouvé** sans secret. **Estimation non ferme.**

## 22. Estimate / réserve / cap théoriques

Segment canonique **81** caractères → 81 crédits.

| | Catalogue 0,15 USD/1k | Note |
|---|---|---|
| Estimate | ~1–2¢ | arrondi · **non ferme** |
| Réserve ×1,2 | ~2–3¢ | théorique |
| Cap | = réserve | théorique |
| Available | 48¢ | suffisant *si* le catalogue tenait |

Ne pas présenter ces chiffres comme un prix ferme. Futur paid preflight **bloqué pricing** jusqu’à preuve de plan. **0** réserve cette phase.

## 23. Budget

Compare-only : `budgetDecision.allowed=false` · `reservationCreated=false` · `budgetWrites=0`.  
Live inchangé : **437 / 389 / 0 / 48**. Hard limit non augmenté.

## 24. Flags

Tous **OFF**, non écrits sur Vercel :

- `VHS11C_VOICE_CAPABILITY_ENABLED`
- `VHS11C_VOICE_PAID_ENABLED`
- `VHS11C_VOICE_ELEVENLABS_ENABLED`
- `VHS11C_VOICE_WORKER_ENABLED`
- `VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION`
- `VHS11C_VOICE_DOWNSTREAM_ENABLED`

VHS11B, VHS124, Motion, `DIRECTOR_V2_PAID_GENERATION_ENABLED` restent OFF.

## 25. Isolation legacy / lipsync

Tests : Voice `/director` n’utilise pas `/api/generate/voice` ; legacy ≠ preuve Production ; Voice ne déclenche pas lipsync ni merge_audio ; ne lit/modifie pas le MP4 ; ne change aucun pointeur actif ; pas d’export ; pas de provider vidéo ; fake universel refusé.

## 26. Dry-run et replay

Fakes synthétiques uniquement. Produit : segment canonique redacted + fixture hashée, voix fixture, consent live insuffisant, plan single-step, bundle I2V cohérent, allowlist disabled, pricing non ferme, budget compare-only, run/job/attempt simulés, buffer MP3 8 octets, ingest simulé, QC technique `needs_review`, perceptuel humanOnly, HR pending, asset `active=false`, 0 lipsync.

Replay : fingerprint dry-run `861975968090b18c…` · plan `c96fb9829561cdba…` · idempotency `93214c636ea182d8…` · providerCalls=0 · 0 second run/job/output · 0 persistance.

## 27. Tests

15 tests ciblés couvrent les 33 cas demandés. Suite unitaire **1747/1747**. Typecheck PASS. Lint des fichiers de phase : 0 error. Build PASS. Fraîcheur PASS. Secret scan PASS.  
pgTAP / intégration DB / E2E : **non relancés**.

## 28. Secret scan

Aucun secret, dataUrl, URL signée, clé, voice id brut, média ou texte parlé complet ajouté aux rapports. Les ids Tom/Mei du SDK restent dans leurs fichiers historiques, hors contrat 11C.

## 29. Compteurs Production / provider / média

Tous à **0** (voir encadré). Phase cost **0¢**. Vidéo `9be6cb0c` toujours `approved` / `active=false`.

## 30. Fichiers modifiés

Nouveaux modules `phase-11c-*`, contrat `existing-voice-reference.ts`, tests 11C, rapport `140_`, living handover et index. AICCOS **exclus**. Preview MP4 **exclue**.

## 31. Commit et push

Commit de clôture sur `main` (hors AICCOS), puis push normal si périmètre propre. SHA dans le living handover après commit.

## 32. Verdict

`VOICE_TTS_PATH_WIRED_DISABLED_BLOCKED_VOICE_OR_CONSENT`

Le chemin est câblé, désactivé, testé en fakes, et **bloqué** pour tout appel réel : pas de voix narrateur autorisée, consentement Voice insuffisant (MV-001 ≠ Voice). Pricing catalogue **non ferme** (bloc secondaire documenté, pas le verdict).

## 33. Prochaine porte, non exécutée

`AUTH_11C_VOICE_NARRATOR_BINDING_AND_CONSENT`

Porte corrective minimale unique : lier explicitement une voix narrateur autorisée au projet I2V + documenter le consentement Voice applicable. Sans cela, aucun live preflight payant ni appel ElevenLabs.

Un live preflight sans provider (`AUTH_11C_VOICE_TTS_LIVE_PREFLIGHT_NO_PROVIDER`) ne pourra être proposé qu’après cette porte. Aucun appel Voice payant avant ce live preflight **et** une nouvelle autorisation humaine explicite.
