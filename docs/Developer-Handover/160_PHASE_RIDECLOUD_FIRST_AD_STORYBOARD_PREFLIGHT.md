# 160 — RideCloud First Ad Storyboard Preflight

**Date :** 2026-08-27  
**Auth :** `AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER`  
**Nature :** storyboard déterministe 26 s · refs opaques · **0** provider · **0** TTS · **0** génération · **0** projet Production · **0** média Git  
**HEAD au départ :** `8d65bd8` (`159_` SHA record)  
**HEAD de phase :** `55107d9`

```text
VERDICT = RIDECLOUD_FIRST_AD_STORYBOARD_READY
PHASE_COST = 0¢
PROVIDER_CALLS = 0
ELEVENLABS_CALLS = 0
FAL_CALLS = 0
SIGNED_URL_COUNT = 0
TTS_CALLS = 0
MEDIA_WRITES = 0
STORAGE_UPLOADS = 0
HUMAN_REVIEW_WRITES = 0
PRODUCTION_WRITES = 0
PRODUCTION_PROJECTS_CREATED = 0
SUPABASE_MUTATIONS = 0
BUDGET_WRITES = 0
FLAGS_WRITTEN = 0
DEPLOYMENTS_TRIGGERED = 0
DURATION_SEC = 26
SHOT_COUNT = 6
MUSIC = false
LIPSYNC = false
HARD = 437
COMMITTED = 391
RESERVED = 0
AVAILABLE = 46
NEXT_AUTH = AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER
```

---

## 1. Autorisation consommée

`AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER` — Christian, chat courant.

Périmètre : plan de plans déterministe pour LinkedIn + Instagram. Aucun provider, TTS, génération média, upload, projet Production, dépense, export ou lipsync.

## 2. Git et working tree

| Champ | Valeur |
|---|---|
| Branche | `main` |
| HEAD / origin/main initiaux | `8d65bd8` |
| ahead / behind | **0 / 0** |
| Hors scope | AICCOS + `page.tsx` protégés |

## 3. Storyboard 26 s — master 9:16

Dérivés : 4:5 et 1:1 par recadrage centre sûr. VO `narrator_female`. Pas de musique. Pas de lipsync.

| Plan | Temps | Ref | Rôle | VO / overlay |
|---|---|---|---|---|
| s01 | 0–4 | `ref:ridecloud-capture-720x1604-01#eed8f55e672a` | hook landing | claim |
| s02 | 4–9 | `ref:ridecloud-capture-1080x2424-01#b0eb965287e6` | garage HD | signature |
| s03 | 9–14 | `ref:ridecloud-capture-1080x2424-02#031e72c27384` | détail échéance HD | silence |
| s04 | 14–18 | `ref:ridecloud-capture-1080x2424-04#ea898663643e` | types de véhicules HD | silence |
| s05 | 18–23 | `ref:ridecloud-capture-1080x2424-03#fba239a8de97` | visuel Programme Fondateur HD | CTA |
| s06 | 23–26 | `ref:ridecloud-logo-512x512#5b3b85a3d8a5` | end card | CTA à l’écran |

Motions : push-in lent / hold. Transitions : dissolve, cut final.

## 4. Textes verrouillés uniquement

- Claim : « Le carnet d’entretien intelligent de tous vos véhicules. »
- Signature : « Centralisez, anticipez, valorisez. »
- CTA : « Rejoignez le Programme Fondateur, testez RideCloud, remplissez le questionnaire et bénéficiez de Premium à vie. »

Aucun texte bannière. Aucun « places restantes », « IA Mistral » ou nom de véhicule en overlay.

## 5. Recadrage

- Barre de statut appareil sur tous les plans UI.
- Overlay Android sur la landing `720`.
- Centre sûr pour 4:5 et 1:1.
- Ne pas afficher le badge Google Play.
- Ne pas promouvoir le copy UI non approuvé comme overlay.

Les bannières restent des variantes officielles **hors timeline** : leur copy n’est pas un claim.

## 6. Verdict

**`RIDECLOUD_FIRST_AD_STORYBOARD_READY`**

Plan seulement. Aucune génération n’est autorisée.

## 7. Prochaine autorisation exacte — non exécutée

**`AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER`**

Préparer la création d’un projet Production RideCloud **séparé**, sans l’exécuter. **Aucun** provider · **0¢** · **0** write.

**Ne pas exécuter cette porte ici.**

## 8. Tests

| Check | Résultat |
|---|---|
| Ciblés storyboard | **6/6** |
| Suite unitaire | **1872/1872** |
| Typecheck | **PASS** |
| Fraîcheur | **PASS** · `nextPhase=AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER` |
| Secret scan | **PASS** · 0 chemin local · 0 média Git |

## 9. Fichiers

- `studio/src/application/production/ridecloud-first-ad-storyboard-preflight.ts`
- `studio/src/application/production/__tests__/ridecloud-first-ad-storyboard-preflight.test.ts`
- `studio/scripts/ridecloud-first-ad-storyboard-once.ts`
- ce rapport `160_`
- living handover + index

AICCOS **exclus**. Aucun PNG RideCloud ajouté à Git.

STOP.
