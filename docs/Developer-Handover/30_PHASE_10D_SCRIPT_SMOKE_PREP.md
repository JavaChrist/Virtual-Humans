# 30 — Phase 10D-PREP — Script Director Real Smoke Preparation

**Date :** 10 août 2026  
**Entrée :** Phase 10B PASS + Phase 10C PASS  
**Directeur :** Script uniquement (préparation)  
**Provider calls :** **0**

---

## Verdict

```text
READY_FOR_HUMAN_AUTH
```

Aucun appel Script réel. Aucune écriture Vercel. Aucun push. Aucun média.

---

## Artifacts amont réutilisables

| Artifact | id | rev | actif |
|---|---|---:|---|
| MarketingPlan | `199284d6-7126-4383-b85f-1ecd74d9528e` | 1 | oui |
| CreativeConcept | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` | 1 | oui |
| VideoScript | — | — | **absent** |

Projet : `984507af-a89e-4644-8ea3-344797baa974`  
Marketing / Creative : **jamais régénérés** dans la fenêtre 10D.

---

## Script dry-run (local, sans provider)

| Champ | Valeur |
|---|---|
| providerCalled | **false** |
| executable | true |
| model | `gpt-5.6-terra` (défauts code ; knobs Sensitive redacted via CLI) |
| maxOutputTokens | 2400 |
| promptVersion | `script-analyzer-v1` |
| schemaVersion | `1.0.0` |
| timingEngineVersion | `1.0.0` |
| approximateInputTokens | 1488 |
| pricingConfigured | true |
| priceVersion | `manual-2026-08-porte7-sol` |
| input / output per 1M | 500 / 3000 minor USD |
| estimatedCostMinor | **7** |
| reservationPlanned | **7** |
| proposedCeilingMinor | **100** |

Note : le dry-run Production live (après ouverture des flags) confirmera le modèle/estimate exacts avant l’unique appel.

---

## Matrice flags prévue (futur execute uniquement)

| Flag | Valeur 10D |
|---|---|
| `DIRECTOR_V2_ENABLED` | 1 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 |
| `DIRECTOR_V2_SCRIPT_AI_ENABLED` | 1 |
| `DIRECTOR_V2_MARKETING_AI_ENABLED` | **0** |
| `DIRECTOR_V2_CREATIVE_AI_ENABLED` | **0** |
| `DIRECTOR_V2_ART_AI_ENABLED` | **0** |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | **0** |
| `DIRECTOR_V2_WORKER_ENABLED` | **0** |
| `DIRECTOR_V2_PAID_GENERATION_ENABLED` | **0** |

Ouverture (futur) :

```text
CONFIRM_PHASE_10D_VERCEL_FLAGS=1 node scripts/phase-10d-set-script-flags.mjs on
# redeploy Production
```

Fermeture (obligatoire, même après erreur) :

```text
CONFIRM_PHASE_10D_VERCEL_FLAGS=1 node scripts/phase-10d-set-script-flags.mjs off
# redeploy Production
node scripts/phase-10d-verify-flags-off.mjs
```

Runtime actuel (PREP) : `CURRENT_RUNTIME_REAL_AI=OFF`.

---

## Idempotence

Clé Script dérivée de :

```text
{projectId}:{briefArt}:{briefRev}:{planArt}:{planRev}:{conceptArt}:{conceptRev}:{model}:{promptVersion}:{schemaVersion}:{timingEngineVersion}
```

Replay post-execute : `phase-10d-replay-idempotence.mjs` (refusé si `CONFIRM_PHASE_10D_PREP=1`).

---

## Autorisation humaine exacte requise

```text
PHASE_10D_SMOKE_CONFIRM=ONE_SCRIPT_CALL_MAX_100_CENTS
PHASE_10D_ALLOW_EXECUTE=1
PHASE_10D_DRY_ONLY=0
CONFIRM_PHASE_10D_VERCEL_FLAGS=1
```

Contraintes d’exécution futures :

```text
estimate <= 100
reservation == estimate
maximum provider calls == 1
media calls == 0
no Marketing replay
no Creative replay
no Art/Storyboard
no provider retry
flags OFF immediately after (success or failure)
```

---

## Scripts livrés

| Script | Rôle |
|---|---|
| `phase-10d-verify-upstream-artifacts.mjs` | Identités Marketing + Creative (read-only) |
| `phase-10d-prep-script-dry-run.mjs` | Dry-run Script sans provider |
| `phase-10d-set-script-flags.mjs` | Matrice flags (futur) |
| `phase-10d-verify-flags-off.mjs` | Preuve runtime OFF |
| `smoke-phase-10d-script-vercel.mjs` | Smoke (dry-only par défaut) |
| `phase-10d-replay-idempotence.mjs` | Replay post-execute |

Preuves : `studio/.tmp/` (gitignoré).

---

## P1 conservé

```text
BACKUP_PRESENT_RESTORE_UNPROVEN
```
