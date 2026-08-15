# 152 — Phase 11C Voice/TTS Live Preflight No Provider

**Date :** 2026-08-16  
**Auth :** `AUTH_11C_VOICE_TTS_LIVE_PREFLIGHT_NO_PROVIDER`  
**Nature :** lectures Production de métadonnées + dry-run fail-closed · **0** write · **0** provider  
**HEAD au départ :** `6e519c4` = `origin/main`

```text
VERDICT = VOICE_TTS_LIVE_PREFLIGHT_READY_FOR_FINAL_PAID_AUTH
NARRATOR_SELECTED = narrator_female
NARRATOR_MALE_SELECTED = false
MEI_SUBSTITUTED = false
TOM_SUBSTITUTED = false
ACTIVATION_MECHANISM = C
MODEL = eleven_multilingual_v2
PRICING_SOURCE = internal_versioned_catalogue + elevenlabs_public_api_pricing 2026-08-16
UNITS = characters
ESTIMATE_MINOR = 1
CAP_MINOR = 2
MARGIN_MINOR = 1
FIRM = false
PLAN_KNOWN = false
BUDGET = 437 / 389 / 0 / 48
BUDGET_SUFFICIENT = true
DRY_RUN_FINGERPRINT = 2e86cee67f9902c1df8f8c3d14d6bff2b8b7e476789feba6c1abcbb044215c7b
REPLAY_STABLE = true
PROVIDER_MODE = disabled
PROVIDER_CALL_ALLOWED = false
MUTATION_ALLOWED = false
PRODUCTION_WRITES = 0
VOICE_IDENTITIES_UPDATED = 0
VOICE_CONSENTS_UPDATED = 0
PROJECT_BINDINGS_UPDATED = 0
ACTIVE_PROVIDER_IDENTITIES = 0
RESERVATIONS_CREATED = 0
VOICE_RUNS_CREATED = 0
VOICE_JOBS_CREATED = 0
VOICE_ATTEMPTS_CREATED = 0
AUDIO_OUTPUTS_CREATED = 0
ELEVENLABS_CALLS = 0
OTHER_PROVIDER_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
PHASE_COST = 0
VOICE_RUNTIME = OFF
VIDEO_ACTIVE = false
VIDEO_PUBLISHED = false
VOICE_IDS_EXPOSED = false
NEXT_AUTH = AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION
```

---

## 1. Autorisation consommée

Christian a autorisé un live preflight Voice/TTS **sans provider** pour le projet I2V lié à `narrator_female`.

Autorisé : métadonnées Production nécessaires, vérification du wiring/binding déployés, résolution redacted, modèle tarifaire, préparation mémoire, dry-run fail-closed.

Interdit et non fait : tout appel ElevenLabs (synthèse, preview, quota, compte), tout autre provider, URL signée, lecture/écriture média, génération audio, réservation, run/job Production, activation identité/binding/flag, écriture budget, dépense, lipsync, publication, merge, export.

## 2. Git

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `6e519c4` |
| ahead / behind | **0 / 0** au départ |
| Hors scope | AICCOS + `page.tsx` protégés · non touchés · non stagés |

HEAD de départ `6e519c4`. Commit de phase `46eda6f`. `studio/.env.local` ignoré.

## 3. Working tree

Hors scope identifiés et protégés. Cette phase ne les a ni restaurés, ni stashés, ni stagés.

## 4. Déploiement Production

| Champ | Valeur |
|---|---|
| Alias Ready | `virtual-humans.vercel.app` → host `qywaw2ovo-…` (redacted) |
| Deployment id | `dpl_HCZX…` |
| État | **Ready** · target Production |
| Créé | 2026-08-16 01:17:26 Europe/Paris |
| SHA inspecté | **`6e519c4`** · commit docs 01:17:09 · auto-deploy, **aucun** déploiement manuel |
| Ancêtres requis | wiring `770e844` (`140_`) · binding code `77dc1a7` (`150_`) · binding write `abaec84` (`151_`) |
| Wiring Voice/TTS | **présent** dans le SHA |
| Résolution binding | **présente** dans le SHA |

Le CLI Vercel n’expose plus le champ commit en texte ; le SHA est corrélé à l’auto-deploy Ready créé 17 s après `6e519c4` sur `main`. Même si le build avait pris `abaec84`, le wiring et le binding requis y sont déjà. **Pas** `BLOCKED_DEPLOYMENT_NOT_READY`.

## 5. Préconditions live (lecture seule)

Toutes passées **sans** modifier l’état live.

| Check | Résultat |
|---|---|
| Git `6e519c4` = origin/main | PASS · 0/0 |
| Hors scope protégés | PASS |
| Migrations | **32/32** |
| Tables Voice | **4 / 4 / 1** · provider-active **0** |
| Binding `e3a1cc87…` | projet `984507af…` · `narrator_female` · narrator · voice_over · fr · prepared |
| Identity `bc1c8046…` | available · revocable · execution=false · locator `env:ELEVENLABS_NARRATOR_FEMALE_VOICE_ID` · prefix `99db51be34bc` · modèle `eleven_multilingual_v2` |
| Consent `6fd84baf…` | authorized · `workspace_voice_over` · voice_over · revoked_at null |
| `narrator_male` | non sélectionné |
| Mei / Tom | non substitués · `character_dialogue` seulement |
| ACL `147_` | identities/bindings `service_role` SELECT/INSERT/UPDATE · consent SELECT/INSERT · clients 0 |
| RLS | on · **0** policy |
| Script actif | `349e2792…` rev.1 |
| Scène 2 | `segment-2` · voice_over · fr · **81** · hash `f228654f…` · texte non recopié |
| GenerationPlan I2V | `3d1858eb…` rev.3 · **non actif** |
| GenerationPlan actif 11A | `a55bd426…` rev.2 · non utilisé |
| Vidéo `9be6cb0c…` | approved · bucket privé · active=false · published=false · contenu non lu |
| Budget | **437 / 389 / 0 / 48** |
| Réservations Voice | **0** |
| Runs / jobs ElevenLabs | **0 / 0** |
| Outputs audio projet | **0** |
| Flags VHS11C | **absents** de Vercel (jamais écrits) = OFF |
| Autres flags paid | noms présents, chiffrés · valeurs non lues · attendu OFF · aucun write |
| Voice runtime | OFF |
| voiceId brut | non exposé |

## 6. Contrat d’activation future

`active_for_provider_execution=false` **n’a pas été activé**.

| Option | Supporté | Motif |
|---|---|---|
| A — activation persistante | non | CHECK `voice_identities_execution_off_default` interdit `true` |
| B — flip transactionnel temporaire | non | viole le même CHECK |
| **C — autorisation d’exécution distincte** | **oui** | Auth + fenêtre de flags bornée + `finally`, **sans** muter le catalogue |
| D — autre mécanisme | non | aucun autre grant fail-closed |

Mécanisme retenu : **C**. Les flags futurs s’ouvrent au dernier moment et se referment dans `finally`. Le voiceId brut n’est résolu qu’au call-time. Cette porte n’ouvre rien.

## 7. Pricing

Aucun endpoint ElevenLabs. L’abonnement personnel n’est **pas** traité comme coût nul.

| Rang | Source | Preuve | Date |
|---|---|---|---|
| 1 | Contrat interne versionné `estimateVoice` / `ELEVENLABS_USD_PER_1K_CHARS` | **0,15 USD / 1k caractères** · `firm=false` · `planKnown=false` | code actuel |
| 2 | Documentation publique officielle API | Multilingual v2 **0,10 USD / 1k caractères** | 2026-08-16 |
| 3 | Plafond conservateur | non requis : le contrat interne est déjà le plus haut |

| Grandeur | Valeur |
|---|---|
| Unités | caractères (81) · 1 crédit / caractère catalogue |
| Coût marginal plan perso | **inconnu** · non vérifiable sans appel compte |
| Coût USD démontré | **null** |
| Estimate interne | 81 × 0,15 / 1000 = 0,01215 USD → **1¢** |
| Cap de réservation | ceil(1¢ × 1,2) = **2¢** |
| Marge | **1¢** |
| Public corroboratif | 81 × 0,10 / 1000 = 0,0081 USD → 1¢ (plus bas) |
| Suffisance | 2 ≤ 48 · **oui** |

Le modèle câblé reste **`eleven_multilingual_v2`**. Aucun changement de modèle.

## 8. Dry-run

`providerMode=disabled` · `mutationAllowed=false`. Chemin réel de préparation, arrêté avant voiceId brut, URL signée, réservation, run/job/attempt, ElevenLabs, ingest, activation.

| Champ | Résultat |
|---|---|
| Source | admissible |
| Narratrice | `narrator_female` via binding projet |
| Consentement | admissible |
| Plan TTS | déterministe · 1 step |
| Fingerprint | `2e86cee67f9902c1df8f8c3d14d6bff2b8b7e476789feba6c1abcbb044215c7b` |
| Replay | identique · 0 effet |
| Idempotency key | `0c5d61c9e81eeb79e03bf770fb8b0b8a4bff9626420ca5f1dab4a7a91c1d305b` |

## 9. Plan futur (mémoire seulement)

Exactement 1 segment `voice_over` · 1 narratrice · 1 synthèse · 1 run · 1 job · 1 attempt · 1 output audio privé `pending_review` · `active=false` · `published=false` · ingest bucket privé · Human Review obligatoire · 0 retry · 0 fallback · 0 second submit · aucun lipsync / merge / export / activation automatique.

Garde-fous préparés, **non activés** : mécanisme C · flags `finally` · voiceId call-time · `submitCount` max 1 · settlement borné au coût démontrable ou au cap 2¢ · attempt terminal avant clôture · reconciliation idempotente · fail-closed si réponse ambiguë.

## 10. Tests

| Check | Résultat |
|---|---|
| Ciblés live preflight | **9/9 PASS** |
| Pricing / budget / idempotence / activation | PASS |
| Refus male / Mei / Tom / consent / binding / unavailable | PASS |
| Runtime OFF / providerMode disabled / 0 mutation | PASS |
| Suite unitaire | voir living handover |
| Typecheck / lint / build | voir living handover |
| Fraîcheur / secret scan | voir living handover |
| migrations-static | **32/32** |
| pgTAP / intégration DB / E2E | **N/A** · stack locale non disponible |

## 11. Hors scope

`studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx` · `studio/src/app/page.tsx` intacts. `studio/.env.local` hors Git.

## 12. Verdict

`VOICE_TTS_LIVE_PREFLIGHT_READY_FOR_FINAL_PAID_AUTH`

Prochaine porte **annoncée, non commencée** :

`AUTH_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION`

Cette future Auth devra mentionner explicitement : cap de réservation **2¢**, **1** appel ElevenLabs, **1** segment, **1** run, **1** job, **1** attempt, **1** output privé, **0** retry, **0** fallback, fermeture des flags dans `finally`, Human Review pending, interdiction lipsync/downstream.
