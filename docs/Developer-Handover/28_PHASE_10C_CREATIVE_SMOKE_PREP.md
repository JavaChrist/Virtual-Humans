# 28 — Phase 10C-PREP — Creative Director Real Smoke Preparation

**Date :** 10 août 2026  
**Entrée :** Phase 10B PASS + 10B-CLOSE PASS  
**Directeur :** Creative uniquement (préparation)  
**Provider calls :** **0**

---

## Verdict

```text
READY_FOR_HUMAN_AUTH
```

Aucun appel Creative réel. Aucune écriture Vercel. Aucun push. Aucun média.

---

## MarketingPlan 10B réutilisable

| Champ | Valeur |
|---|---|
| projectId | `984507af-a89e-4644-8ea3-344797baa974` |
| marketing artifact | `199284d6-7126-4383-b85f-1ecd74d9528e` |
| revision active | 1 |
| zodOk | true |
| CreativeConcept existant | **aucun** |
| bodyPrinted | false |

Marketing replay : **interdit** (flag `DIRECTOR_V2_MARKETING_AI_ENABLED` reste `0` dans la matrice 10C).

---

## Creative dry-run (local, sans provider)

| Champ | Valeur |
|---|---|
| providerCalled | **false** |
| executable | true |
| model | `gpt-5.6` |
| reasoningEffort | `medium` |
| maxOutputTokens | 4096 |
| promptVersion | `creative-analyzer-v5` |
| schemaVersion | `1.2.0` |
| approximateInputTokens | 1190 |
| pricingConfigured | true |
| priceVersion | `manual-2026-08-porte7-sol` |
| input / output per 1M | 500 / 3000 minor USD |
| estimatedCostMinor | **12** |
| reservationPlanned | **12** |
| proposedCeilingMinor | **100** |

Note : `vercel env pull` redacte les Sensitive → price book résolu via canon Production Porte 7H-B/8E, recoupé par l’estimate Marketing 10B (24¢ = floor(8192×3000/1e6)).

---

## Matrice flags prévue (futur execute uniquement)

| Flag | Valeur 10C |
|---|---|
| `DIRECTOR_V2_ENABLED` | 1 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 |
| `DIRECTOR_V2_CREATIVE_AI_ENABLED` | 1 |
| `DIRECTOR_V2_MARKETING_AI_ENABLED` | **0** |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | **0** |
| `DIRECTOR_V2_ART_AI_ENABLED` | **0** |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | **0** |
| `DIRECTOR_V2_WORKER_ENABLED` | **0** |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | **0** |

Script d’application (futur, **interdit en PREP**) :

```text
CONFIRM_PHASE_10C_VERCEL_FLAGS=1 node scripts/phase-10c-set-creative-flags.mjs on
```

Fermeture immédiate après smoke :

```text
CONFIRM_PHASE_10C_VERCEL_FLAGS=1 node scripts/phase-10c-set-creative-flags.mjs off
node scripts/phase-10c-verify-flags-off.mjs
```

---

## Budget workspace (lecture seule)

| Champ | Valeur |
|---|---:|
| hard_limit_minor | 100 |
| active_reserved | 0 |
| estimate Creative | 12 |

Le smoke futur exige `estimate <= plafond` et `available >= reservation`.

---

## Idempotence

Clé Creative dérivée de :

```text
cre:{projectId}:{briefArtifact}:{briefRev}:{planArtifact}:{planRev}:{model}:{promptVersion}:{schemaVersion}
```

Replay post-execute : `phase-10c-replay-idempotence.mjs` (refusé si `CONFIRM_PHASE_10C_PREP=1`).

---

## Autorisation humaine exacte requise

```text
PHASE_10C_SMOKE_CONFIRM=ONE_CREATIVE_CALL_MAX_100_CENTS
PHASE_10C_ALLOW_EXECUTE=1
PHASE_10C_DRY_ONLY=0
CONFIRM_PHASE_10C_VERCEL_FLAGS=1   # pour on puis off uniquement
```

Contraintes d’exécution futures :

```text
estimate <= 100
reservation == estimate
maximum provider calls == 1
media calls == 0
no Marketing replay
no Script/Art/Storyboard
flags OFF immediately after
```

---

## Scripts livrés

| Script | Rôle |
|---|---|
| `phase-10c-verify-marketing-plan.mjs` | Identité MarketingPlan 10B (read-only) |
| `phase-10c-prep-creative-dry-run.mjs` | Dry-run Creative sans provider |
| `phase-10c-set-creative-flags.mjs` | Matrice flags (futur) |
| `phase-10c-verify-flags-off.mjs` | Preuve runtime OFF |
| `smoke-phase-10c-creative-vercel.mjs` | Smoke (dry-only par défaut) |
| `phase-10c-replay-idempotence.mjs` | Replay post-execute |

Preuves : `studio/.tmp/` (gitignoré).

---

## P1 conservé

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```
