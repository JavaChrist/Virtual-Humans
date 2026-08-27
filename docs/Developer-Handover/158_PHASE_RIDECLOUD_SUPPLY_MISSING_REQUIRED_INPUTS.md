# 158 — RideCloud Supply Missing Required Inputs

**Date :** 2026-08-27  
**Auth :** `AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER`  
**Nature :** intégration du pack créatif verrouillé · références opaques + préfixes · **0** média Git · **0** provider · **0** projet Production  
**HEAD au départ :** `80d3e4d` (`157_` SHA record)

```text
VERDICT = READY
PHASE_COST = 0¢
PROVIDER_CALLS = 0
ELEVENLABS_CALLS = 0
FAL_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
HUMAN_REVIEW_WRITES = 0
PRODUCTION_WRITES = 0
PRODUCTION_PROJECTS_CREATED = 0
SUPABASE_MUTATIONS = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
DEPLOYMENTS_TRIGGERED = 0
LOCAL_PACK_METADATA_READS = 12
PRODUCTION_MEDIA_READS = 0
HARD = 437
COMMITTED = 391
RESERVED = 0
AVAILABLE = 46
CAPTURES_VERIFIED = 10
CAPTURES_BRIEFED = 8
MUSIC = OPTIONAL_WAIVED
LIPSYNC = false
NEXT_AUTH = AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER
```

---

## 1. Autorisation consommée

`AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER` — Christian, chat courant.

Aucun média copié dans Git. Aucun chemin local persisté. Aucun hash complet. Aucun provider, dépense, projet Production, activation, lipsync, merge/export.

## 2. Git et working tree

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `80d3e4d` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS + `page.tsx` protégés |

## 3. Inventaire intégré

| Input | État |
|---|---|
| productBrief | **AVAILABLE_VERIFIED** · claim + signature verrouillés |
| campaignGoal | **AVAILABLE_VERIFIED** · pub 20–30 s Programme Fondateur |
| audience | **AVAILABLE_VERIFIED** · LinkedIn + Instagram |
| logoBrand | **AVAILABLE_VERIFIED** · `ref:ridecloud-logo-512x512#5b3b85a3d8a5` |
| screenshots | **AVAILABLE_VERIFIED** · 10 × `720×1604` |
| screenRecordings | **OPTIONAL** · aucune ; les captures suffisent |
| approvedClaims | **AVAILABLE_VERIFIED** · une claim, pas d’improvisation |
| valueProposition | **AVAILABLE_VERIFIED** · « Centralisez, anticipez, valorisez. » |
| cta | **AVAILABLE_VERIFIED** · Programme Fondateur / Premium à vie |
| durationFormats | **AVAILABLE_VERIFIED** · 20–30 s · 9:16, 4:5, 1:1 optionnel |
| language | **AVAILABLE_VERIFIED** · `fr` |
| voiceRole | **AVAILABLE_VERIFIED** · `narrator_female` |
| musicRights | **OPTIONAL** · aucune musique tant que licence absente |
| legalConstraints | **AVAILABLE_VERIFIED** · voir §5 |

Bannière de marque : `ref:ridecloud-banner-1024x500#d26a04137ca0` · « Disponible sur Google Play » seulement si la formulation est exacte pour la diffusion.

Note : le briefing disait **8** captures ; le scan local en a trouvé **10** à `720×1604`. Les 10 sont retenues comme sources. Ce n’est pas un blocker.

## 4. Manifeste

```text
projectKey = ridecloud-promo-separate-v1
productName = RideCloud
campaignGoal = founder_program_ad_20_30s_linkedin_instagram
audience = linkedin+instagram
targetPlatforms = linkedin, instagram
aspectRatios = 9:16, 4:5, 1:1
targetDuration = 20-30s
language = fr
voiceRole = narrator_female
CTA = Rejoignez le Programme Fondateur…
musicRightsStatus = OPTIONAL
readinessVerdict = READY
missingRequiredInputs = []
```

Claims verrouillés :

- « Le carnet d’entretien intelligent de tous vos véhicules. »
- « Centralisez, anticipez, valorisez. »

## 5. Vigilances livrable — pas des blockers

- Recadrer / nettoyer le panneau flottant Android avant livrable.
- Badge Google Play seulement si le claim de diffusion est exact.
- « Premium à vie » uniquement avec le Programme Fondateur et ses conditions.
- Marques / modèles de véhicules : aucun partenariat implicite.
- 11A/11B/11C restent des preuves techniques, pas des livrables.

## 6. Concept minimal — aucun asset produit

captures → montage animé → `narrator_female` → textes / CTA → **pas de musique** → export privé → Human Review.

**0** lipsync. **0** merge/export. **0** génération.

## 7. Verdict

**`READY`**

Le preflight sort de `BLOCKED_INPUTS_REQUIRED`. Aucune génération n’est autorisée par cette porte.

## 8. Prochaine autorisation exacte — non exécutée

**`AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER`**

Préparer le storyboard / plan de plans de la première pub 20–30 s à partir du manifeste verrouillé. **Aucun** provider · **0¢** · **0** projet Production · **0** média Git.

**Ne pas exécuter cette porte ici.**

## 9. Tests

| Check | Résultat |
|---|---|
| Ciblés RideCloud | **10/10** |
| Suite unitaire | **1865/1865** |
| Typecheck | **PASS** |
| Fraîcheur | **PASS** · `nextPhase=AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER` |
| Secret scan | **PASS** · 0 chemin local · 0 hash complet · 0 média Git |
| pgTAP / intégration / E2E | **N/A** |

## 10. Fichiers

- `studio/src/application/production/ridecloud-input-preflight.ts`
- `studio/src/application/production/__tests__/ridecloud-input-preflight.test.ts`
- `studio/scripts/ridecloud-input-preflight-once.ts`
- `studio/src/application/docs/__tests__/current-state-freshness.test.ts`
- ce rapport `158_`
- living handover + index

AICCOS **exclus**. Aucun PNG/SVG RideCloud ajouté à Git.

STOP.
