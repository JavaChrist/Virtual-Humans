# 81 — MT-013D Privacy Decision Pack MV-001 — ACCEPTED (limited)

**Date :** 11 août 2026  
**Auth :** `AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED`  
**Contrat :** `mt011-privacy-1.0.0`

```text
PRIVACY_DUE_DILIGENCE         = ACCEPTED_LIMITED_MV001
PRIVACY_GOVERNANCE_GATE       = CLOSED
RESTORE_DRILL                 = PASS  (78_ — inchangé)
RUNTIME_MOTION                = UNAVAILABLE  (inchangé)
MT005_REMOTE_APPLY            = NOT_APPLIED
PROVIDER_CALLS                = 0
UPLOADS                       = 0
SPEND                         = 0
DEPLOY                        = NOT_ATTEMPTED
VERCEL_MUTATIONS              = 0
```

---

## 1. Portée stricte (Auth)

| Contrainte | Valeur |
|---|---|
| Benchmark | **MV-001 uniquement** |
| Provider | **fal** uniquement |
| Endpoint autorisable *ultérieurement* | `fal-ai/kling-video/v3/pro/motion-control` |
| Réutilisation autre benchmark | **Interdite** |
| Réutilisation Production | **Interdite** |
| Validité | jusqu’au **10 septembre 2026 inclus** |
| Après expiration | **nouvelle confirmation** obligatoire |
| Cette Auth autorise | **uniquement** fermeture porte gouvernance Privacy |
| Cette Auth **n’autorise pas** | upload · appel provider · dépense · déploiement · activation runtime · modif Vercel · migration distante |

---

## 2. Décisions — toutes `true` (gouvernance)

| Clé | Valeur | Résumé déclaration humaine |
|---|---|---|
| `providerRetentionAccepted` | **true** | Conservation potentielle médias/payloads fal jusqu’à **30 jours**, MV-001 seulement |
| `providerCdnExposureAccepted` | **true** | Transit/exposition technique temporaire CDN fal ; **≠** publication publique volontaire |
| `biometricProcessingConsentConfirmed` | **true** | Source = autre personne réelle informée + autorisation explicite mouvement/traitement provider ; cible = personnage **virtuel** |
| `commercialUsageRightsConfirmed` | **true** | Droits sur créations, personnage virtuel, médias + autorisation personne source |
| `geographicRestrictionsSatisfied` | **true** | Exécution depuis **France / UE** ; aucune restriction territoriale/sanction connue applicable |

**decidedAt :** 2026-08-11  
**expiresAt :** 2026-09-10T23:59:59+02:00 (fin de journée 10 sept. 2026 inclusive, fuseau local déclarant)  
**provenance :** `AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED` (message humain chat)  
**policyVersion / schemaVersion :** `mt011-privacy-1.0.0`

---

## 3. Effets / non-effets

| Domaine | Effet |
|---|---|
| Gouvernance Privacy MV-001 | **Porte fermée** (`ACCEPTED_LIMITED_MV001`) |
| Defaults runtime code (`privacy-decision.ts` / gate) | **Inchangés** — fail-closed ; pas d’activation auto |
| Appel fal / upload | **Toujours interdit** sans Auth exécution distincte |
| MT-005 remote | **Toujours NOT_APPLIED** sans Auth distincte |
| Budget / deploy / Vercel | **Inchangés** |

Pour un futur run autorisé, l’exécuteur devra passer un `MotionPrivacyDecisionSet` avec ces 5 clés `true`, `expiresAt` ≤ 2026-09-10, et périmètre MV-001 — **après** Auth paid/runtime séparée.

---

## 4. Révocation

Toute révocation explicite (`false` sur une clé, ou message Auth de retrait) → pack **invalidé** immédiatement ; pas de nouvel upload/submit même si Auth runtime antérieure existait.

---

## 5. Suite (non fusionnée)

1. Auth **MT-005 remote apply** (si encore requis avant runtime).  
2. Auth **budget** (shortfall MV-001 vs available).  
3. Auth **deploy / flags runtime** (si applicable).  
4. Auth **paid single call MV-001** (upload + fal) — distincte.  
5. Ne pas fusionner ces Auth.
