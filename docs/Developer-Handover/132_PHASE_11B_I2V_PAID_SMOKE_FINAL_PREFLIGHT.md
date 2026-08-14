# 132 — Phase 11B I2V Paid Smoke Final Preflight

**Date :** 2026-08-14  
**Auth :** `AUTH_11B_I2V_PAID_SMOKE_FINAL_PREFLIGHT`  
**Nature :** preflight final du premier smoke I2V payant · **0** réserve · **0** fal · **0** média · **0** flag write  
**HEAD au départ :** `f06a31f` (`131_`)  
**Déploiement inspecté :** Production Ready `virtual-humans-p17b6sn5m-…` · Commit **`89d16e4`** · wiring **`57de914`** ancêtre

```text
VERDICT = I2V_PAID_SMOKE_FINAL_PREFLIGHT_READY_FOR_SINGLE_PAID_AUTH
EXECUTION_AUTHORIZED = false
PROVIDER_CALL_ALLOWED = false
THEORETICALLY_SUFFICIENT = true
HARD_LIMIT = 437
COMMITTED = 249
RESERVED = 0
AVAILABLE = 188
RESERVATIONS_CREATED = 0
PHASE_COST = 0¢
PROVIDER_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
FLAGS_WRITTEN = 0
NEXT_AUTH = AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION
```

---

## 1. Autorisation consommée

`AUTH_11B_I2V_PAID_SMOKE_FINAL_PREFLIGHT` — Christian, chat courant.

Cette Auth **n’autorise pas** : réserve 168¢ · flags ON · run/job · URL signée · lecture média · fal · ingest · Human Review.

## 2–3. Git

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD initial | `f06a31f` |
| origin/main initial | `f06a31f` |
| ahead / behind | **0 / 0** |
| Working tree | AICCOS hors scope protégés |
| Hors scope | `studio/src/app/api/aiccos/send/route.ts` · `studio/src/components/send-to-aiccos.tsx` |
| Protection | ni modifiés, ni restorés, ni stashés, ni stagés |

## 4. Déploiement

| Champ | Valeur |
|---|---|
| Alias | `virtual-humans.vercel.app` |
| Host inspecté | `virtual-humans-p17b6sn5m-…` |
| Environnement | **production** |
| Statut | **Ready** |
| Clone log | `Branch: main, Commit: 89d16e4` |
| Wiring applicatif | **`57de914`** est ancêtre de `89d16e4` et de `f06a31f` |
| HEAD Git | `f06a31f` (docs + hard-limit) · **non promu** comme nouveau runtime I2V |
| Runtime image | historique **`245bea2`** · composeur 1.2.0 **`d395ec7`** |
| Déploiement manuel | **aucun** |

## 5. Asset source (métadonnées seulement)

Asset `49284892-d6ba-5249-b645-4f55084361cc`.

| Champ | Live | Attendu |
|---|---|---|
| workspace / projet | `3c308f57…` / `984507af…` | identique |
| lifecycle | `approved` | identique |
| active | `false` | identique |
| source_kind | `internal` | identique |
| bucket | `director-final-assets` privé | identique |
| MIME / dims | `image/png` · 1024×1024 | identique |
| checksum | `9ac484b7…` exact | identique |
| type | `composed_overlay_image` | identique |
| scène | `scene-2` | identique |
| path canonique | **match** (booléen SQL) | identique |
| HR | `fb2f886c…` = `approved` | identique |
| stale / quarantine | absents | identique |

`MEDIA_READS = 0` · `SIGNED_URL_COUNT = 0` · asset **toujours inactif**.

## 6. Budget live

| | ¢ |
|---|---|
| hard | **437** |
| committed | **249** |
| reserved | **0** |
| available | **188** |
| réservations actives | 0 |
| réservations I2V | 0 |
| reconciliations | table absente · 0 |
| ledger / reservation rows | 66 / 25 |
| runs / jobs | 3 / 3 inchangés |

## 7. Pricing officiel

Source : `https://fal.ai/models/fal-ai/kling-video/v2/master/image-to-video/llms.txt` (2026-08-14).

| Champ | Valeur |
|---|---|
| Endpoint | `fal-ai/kling-video/v2/master/image-to-video` |
| Durée | **5 s** (enum 5 / 10) |
| Prix | **$1.40 / 5 s** · **$0.28 / s** |
| Écart vs `130_` / `131_` | **aucun** |
| Estimate / cap / marge | **140 / 168 / 20** ¢ |

## 8–9. Contrat de réservation future

Préparé, **non créé** :

- workspace / projet bornés
- capability `video.image_to_video` · fal · Kling exact · 5 s
- estimate 140¢ · cap 168¢
- idempotency key déterministe `984507af…:phase-11b-i2v-paid-smoke-final-preflight-1.0.0:scene-2:i2v-kling-5s:1`
- expiration contrôlée · settlement ≤ 1 · release si échec avant coût
- pas de dépassement de cap · pas de concurrent équivalent

`RESERVATIONS_CREATED = 0`

## 10. Contrat d’exécution 1/1/1

Séquence de 20 étapes prouvée en mémoire / fakes. Maximum : 1 submit · 1 job · 1 output. Retry 0 · fallback 0 · downstream OFF · output futur `active=false`.

## 11. Flags (non écrits)

Ouverture future minimale, environnement **Vercel Production**, valeur `1` :

1. `DIRECTOR_V2_WORKER_ENABLED`
2. `DIRECTOR_V2_PAID_GENERATION_ENABLED`
3. `VHS11B_I2V_CAPABILITY_ENABLED`
4. `VHS11B_I2V_PAID_ENABLED`
5. `VHS11B_I2V_FAL_ENABLED`
6. `VHS11B_FAL_I2V_DIRECTOR_EXCEPTION`
7. `VHS11B_I2V_WORKER_ENABLED`

Fermeture dans un `finally`, ordre inverse, valeur `0`, vérification finale OFF. Si une fermeture échoue : fail-closed, **aucun resubmit**.

Toujours OFF : `VHS11B_I2V_DOWNSTREAM_ENABLED` · `DIRECTOR_V2_PAID_AI_ENABLED` · VHS124 · Motion (4).

Live cette phase : VHS11B **absents** · Paid/Worker/VHS124/Motion Encrypted · **0 write**.

## 12. Resolver / signed URL

Resolver interne seulement. Signature interdite sans réserve + pre-submit + Auth. Politique future : TTL 60 s · mémoire seulement · non persistée. `SIGNED_URL_COUNT = 0`.

## 13. Worker / poll / no-resubmit

Prouvé en fakes : persist intent → 1 submit → poll · `submission_unknown` ne resoumet pas · reprise fresh-process via `providerJobId` · settlement idempotent · output tardif quarantined.

## 14–16. Ingest / QC / HR

- bucket privé `director-final-assets` · path workspace/projet
- MIME `video/mp4` \| `video/webm` · max 80 MiB · HTTPS
- SSRF + allowlist `*.fal.media`
- checksum après ingest · provenance image → vidéo · `active=false`
- QC technique honnête · visuel `unavailable_humanOnly`
- HR append-only locale · 0 session Production · 0 décision auto

## 17–18. Dry-run et fingerprints

Voie : `runPhase11BI2vPaidSmokeFinalPreflight` — mémoire seulement.

- source admissible · `active=false`
- budget théoriquement suffisant (188 ≥ 168)
- `executionAuthorized=false` · `providerCallAllowed=false` · `reservationCreated=false`
- `paidBlockedReason=BLOCKED_PENDING_NEW_HUMAN_PAID_AUTH`
- fingerprint `6e7199283c45e940…` **stable** au replay
- 0 submit · 0 poll · 0 signed URL · 0 media · 0 run/job

## 19–23. Compteurs

| Compteur | Valeur |
|---|---|
| FAL / OPENAI / ELEVENLABS / OTHER | **0 / 0 / 0 / 0** |
| PRODUCTION_WRITES | **0** |
| RUNS_CREATED / JOBS_CREATED | **0 / 0** |
| MEDIA_READS / MEDIA_WRITES | **0 / 0** |
| SIGNED_URL_COUNT | **0** |
| FLAGS_WRITTEN | **0** |
| HUMAN_REVIEW_WRITES | **0** |
| ASSET_ACTIVATIONS | **0** |
| Flags finaux | OFF |

## 24–25. Tests

| Check | Résultat |
|---|---|
| Unitaires | **1672/1672** (1660 + 12 paid preflight) |
| Typecheck / lint / build | PASS |
| Fraîcheur | PASS après alignement |
| Secret scan | PASS · fixture `token=` de redaction seulement |
| pgTAP / intégration / E2E | **N/A** historiques |

## 26. Fichiers

- `studio/src/application/production/phase-11b-i2v-paid-smoke-final-preflight.ts`
- `studio/src/application/production/__tests__/phase-11b-i2v-paid-smoke-final-preflight.test.ts`
- `studio/src/application/production/phase-11b-i2v-ingest.ts` (allowlist hôte résultat)
- ce rapport `132_`
- living handover + index

AICCOS **exclus**.

## 27. Commit / push

Voir living handover après commit. Push normal `main` uniquement.

## 28. Verdict

**`I2V_PAID_SMOKE_FINAL_PREFLIGHT_READY_FOR_SINGLE_PAID_AUTH`**

Le chemin unique est prêt à être autorisé. Ce verdict **n’autorise toujours pas** fal.

## 29. Prochaine porte (non exécutée)

**`AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION`**

Devra mentionner explicitement :

- réserve unique plafonnée à 168¢
- 1 appel fal · Kling I2V 5 s · 1 job · 1 output
- 0 relance · 0 fallback
- URL signée call-time seulement
- ingest privé · QC technique · HR pending
- output `active=false`
- fermeture flags dans un `finally`
- downstream / activation / merge / export interdits

---

## Interdictions respectées

Aucun fal · aucun OpenAI · aucune réservation · aucun ledger spend · aucun flag · aucun média · aucun run/job · AICCOS intacts.
