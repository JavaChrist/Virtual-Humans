# 157 — RideCloud Separate Project Input Collection Preflight

**Date :** 2026-08-26  
**Auth :** `AUTH_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT_NO_PROVIDER`  
**Nature :** collecte + inventaire + contrat de preflight · **0** provider · **0** média · **0** projet Production  
**HEAD au départ :** `d115d63` (`156_` SHA record)  
**HEAD de phase :** `3da4be0`

```text
VERDICT = BLOCKED_INPUTS_REQUIRED
PHASE_COST = 0¢
PROVIDER_CALLS = 0
ELEVENLABS_CALLS = 0
FAL_CALLS = 0
SIGNED_URL_COUNT = 0
MEDIA_READS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
HUMAN_REVIEW_WRITES = 0
PRODUCTION_WRITES = 0
PRODUCTION_PROJECTS_CREATED = 0
SUPABASE_MUTATIONS = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
DEPLOYMENTS_TRIGGERED = 0
HARD = 437
COMMITTED = 391
RESERVED = 0
AVAILABLE = 46
PROJECT_KEY = ridecloud-promo-separate-v1
PRODUCT_NAME = RideCloud
LIPSYNC = false
NEXT_AUTH = AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER
```

---

## 1. Autorisation consommée

`AUTH_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT_NO_PROVIDER` — Christian, chat courant.

Cette Auth n’autorise aucun provider, dépense, URL signée, lecture/écriture média, upload, mutation Supabase/Vercel, flag write, projet Production, activation, publication, lipsync, merge/export, ni Human Review Production.

## 2. Git et working tree

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `d115d63` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS + `page.tsx` protégés · ni modifiés, ni restorés, ni stashés, ni stagés |

## 3. Séparation de projet

Le projet promotionnel RideCloud est **distinct** des preuves techniques 11A/11B/11C.

Sources **REJECTED_UNSAFE** comme livrables RideCloud :

- `ref:vhs-11a-image-technical-proof`
- `ref:vhs-11b-i2v-technical-proof`
- `ref:vhs-11c-voice-technical-proof`
- `ref:vhs-10x-director-text-artifacts`
- `ref:vhs-studio-icon`
- `ref:vhs-studio-dashboard-screenshots`
- `ref:character-sdk-product-memory`
- `ref:e2e-ridecloud-fixtures`

Aucun de ces locators n’est un chemin local, une URL signée, un média ou un secret.

## 4. Inventaire redacted

| Input | État | Note |
|---|---|---|
| productName | **AVAILABLE_VERIFIED** | `RideCloud` |
| audience | **AVAILABLE_VERIFIED** | Google Play test + JavaChrist Beta Club Discord |
| campaignGoal | **AVAILABLE_UNVERIFIED** | intention promo testers · objectif d’annonce non verrouillé |
| language | **AVAILABLE_UNVERIFIED** | workspace FR · langue de campagne non verrouillée |
| voiceRole | **AVAILABLE_UNVERIFIED** | `narrator_female` recommandé · pas un ordre de livraison |
| productBrief | **MISSING_REQUIRED** | brief produit absent |
| logoBrand | **MISSING_REQUIRED** | logo / charte absents |
| screenshots | **MISSING_REQUIRED** | aucune capture RideCloud |
| screenRecordings | **MISSING_REQUIRED** | aucun screen recording RideCloud |
| approvedClaims | **MISSING_REQUIRED** | aucun message commercial autorisé |
| valueProposition | **MISSING_REQUIRED** | proposition de valeur absente |
| cta | **MISSING_REQUIRED** | CTA campagne absent |
| durationFormats | **MISSING_REQUIRED** | durée / ratios / plateformes non verrouillés |
| musicRights | **MISSING_REQUIRED** | musique + preuve de licence absentes |
| legalConstraints | **MISSING_REQUIRED** | mentions légales / marque absentes |
| lipsync | **OPTIONAL** | hors première pub recommandée |
| on-camera character | **OPTIONAL** | non requis |

Aucun contenu manquant n’a été fabriqué.

## 5. Manifeste déterministe

```text
projectKey = ridecloud-promo-separate-v1
productName = RideCloud
campaignGoal = null
audience = google_play_test+javachrist_beta_club_discord
targetPlatforms = []
aspectRatios = []
targetDuration = null
language = null
voiceRole = null
brandAssetReferences = []
captureReferences = []
recordingReferences = []
approvedClaims = []
CTA = null
musicRightsStatus = MISSING_REQUIRED
legalConstraints = []
readinessVerdict = BLOCKED_INPUTS_REQUIRED
```

`missingRequiredInputs` exact :

1. `productBrief`
2. `campaignGoal`
3. `logoBrand`
4. `approvedClaims`
5. `valueProposition`
6. `cta`
7. `durationFormats`
8. `language`
9. `voiceRole`
10. `musicRights`
11. `legalConstraints`
12. `screenshots`
13. `screenRecordings`

`campaignGoal`, `language` et `voiceRole` restent dans cette liste car **AVAILABLE_UNVERIFIED ≠ AVAILABLE_VERIFIED**.

## 6. Formats, contraintes, provenance

Attendus — **pas** des valeurs choisies :

| Famille | Contrainte |
|---|---|
| Logo | SVG/PNG · propriété ou licence RideCloud · référence opaque seulement dans Git |
| Captures | PNG/WebP · UI RideCloud réelle · pas de PII |
| Recordings | MP4 · UI RideCloud réelle · pas de PII |
| Claims / CTA | écrit et approuvé par Christian · 1 CTA · langue verrouillée · aucune improvisation |
| Durée / ratios | fenêtre suggérée 15–30 s · ratios suggérés `9:16` / `1:1` / `16:9` · **non choisis** |
| Musique | preuve de licence obligatoire pour le concept recommandé |
| Voix | `narrator_female` recommandé · lipsync **false** |
| Provenance | RideCloud owned/licensed · **interdit** d’utiliser 11A/11B/11C, SDK memory, fixtures E2E, icon/dashboard VHS |

Le preflight est **fail-closed** : READY seulement si tous les inputs obligatoires sont `AVAILABLE_VERIFIED` et qu’au moins une source visuelle (captures **ou** recordings) est vérifiée.

## 7. Concept minimal — aucun asset produit

captures ou screen recordings RideCloud → montage animé → `narrator_female` → textes / CTA → musique autorisée → export privé → Human Review.

**0** lipsync. **0** merge/export. **0** génération.

## 8. Verdict

**`BLOCKED_INPUTS_REQUIRED`**

Christian doit fournir le pack manquant. Cette porte s’arrête ici.

## 9. Prochaine autorisation exacte — non exécutée

**`AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER`**

Fournir uniquement les inputs listés ci-dessus, en références opaques, sans provider, sans dépense, sans média Git, sans projet Production.

**Ne pas exécuter cette porte ici.**

## 10. Tests

| Check | Résultat |
|---|---|
| Ciblés RideCloud preflight | **8/8** |
| Suite unitaire | **1863/1863** |
| Typecheck | **PASS** |
| Fraîcheur | **PASS** · `nextPhase=AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER` |
| Secret scan | **PASS** · 0 secret · 0 URL signée · 0 média · `VOICE_IDS_EXPOSED=false` |
| pgTAP / intégration / E2E | **N/A** · non relancés |

## 11. Fichiers

- `studio/src/application/production/ridecloud-input-preflight.ts`
- `studio/src/application/production/__tests__/ridecloud-input-preflight.test.ts`
- `studio/scripts/ridecloud-input-preflight-once.ts`
- `studio/src/application/docs/__tests__/current-state-freshness.test.ts`
- ce rapport `157_`
- living handover + index

AICCOS **exclus**. Aucun média ajouté à Git.

STOP.
