# 33 — Phase 10E-PREP — Art Director Text Smoke Preparation

**Date :** 10 août 2026  
**Entrée :** Phase 10D PASS (`4780de7`) + runtime OFF  
**Directeur :** Art texte uniquement (préparation)  
**Provider calls :** **0**  
**Média / jobs / worker :** **0**

---

## Verdict

```text
READY_FOR_HUMAN_AUTH
```

Aucun appel Art réel. Aucune écriture Vercel. Aucun push. Aucun média.

---

## Contrat Art

| Champ | Valeur |
|---|---|
| Artifact DB | `visual_direction` |
| Domaine | `VisualDirection` |
| Schéma Zod | `VisualDirectionSchema` (`studio/src/domain/art/schemas.ts`) |
| Candidate IA | `ArtAnalysisCandidateSchema` / schema version `1.1.0` |
| Prompt | `art-analyzer-v2` |
| Entrées | Brief + MarketingPlan + CreativeConcept + VideoScript (actifs) |
| Personnage | optionnel ; si `brief.characterId` → snapshot Runtime + ≥1 outfit |
| Chaînage média auto | **NON** — Art text-only ; Storyboard/Production manuels ; flags média orthogonaux |

---

## Artifacts amont réutilisables

| Artifact | id | rev | actif |
|---|---|---:|---|
| MarketingPlan | `199284d6-7126-4383-b85f-1ecd74d9528e` | 1 | oui |
| CreativeConcept | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` | 1 | oui |
| VideoScript | `349e2792-3235-4c00-a1da-9e087b0b4d1c` | 1 | oui |
| VisualDirection | — | — | **absent** |

Projet : `984507af-a89e-4644-8ea3-344797baa974`  
Marketing / Creative / Script : **jamais régénérés** dans la fenêtre 10E.

### Snapshot personnage / assets

| Champ | Valeur |
|---|---|
| brief.characterId | **null** (aucun personnage requis) |
| Snapshot | N/A (`status=none`) |
| Assets critiques | OK (non requis) |

---

## Art dry-run (local, sans provider)

| Champ | Valeur |
|---|---|
| providerCalled | **false** |
| executable | true |
| provider | OpenAI |
| model | `gpt-5.6` (pattern Production documenté) |
| reasoningEffort | `medium` |
| maxOutputTokens | 4096 |
| promptVersion | `art-analyzer-v2` |
| schemaVersion | `1.1.0` |
| approximateInputTokens | 2077 |
| pricingConfigured | true |
| priceVersion | `manual-2026-08-porte7-sol` |
| input / output per 1M | 500 / 3000 minor USD |
| estimatedCostMinor | **13** |
| reservationPlanned | **13** |
| proposedCeilingMinor | **100** |
| codeDefaultEstimate (transparence) | 9¢ (`gpt-5.6-terra` / 2800) |

### Confiance knobs Production

```text
OPENAI_ART_* = Encrypted présents sur Vercel Production
vercel env pull = redacted (valeurs non observables)
artKnobConfidence = unconfirmed_pending_live_dry_run
```

Canon PREP = pattern text directors 10B–10D (`gpt-5.6` / `medium` / `4096`), **pas** les défauts code.  
Le premier dry-run Production live (après ouverture des flags) **doit** confirmer model / effort / maxOut / estimate avant l’unique appel. Divergence → BLOCKED.

Note readiness non bloquante observée : `screen_text_composition_pending` (executable reste true).

---

## Matrice flags prévue (futur execute uniquement)

| Flag | Valeur 10E |
|---|---|
| `DIRECTOR_V2_ENABLED` | 1 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 |
| `DIRECTOR_V2_ART_AI_ENABLED` | 1 |
| Marketing / Creative / Script AI | **0** |
| Storyboard AI | **0** |
| Worker | **0** |
| Paid generation | **0** |

Ouverture (futur) :

```text
CONFIRM_PHASE_10E_VERCEL_FLAGS=1 node scripts/phase-10e-set-art-flags.mjs on
# redeploy Production
# dry-run live must match canon (model/effort/maxOut/estimate)
```

Fermeture (obligatoire, même après erreur) :

```text
CONFIRM_PHASE_10E_VERCEL_FLAGS=1 node scripts/phase-10e-set-art-flags.mjs off
# redeploy Production
node scripts/phase-10e-verify-flags-off.mjs
```

Runtime actuel (PREP) : `CURRENT_RUNTIME_REAL_AI=OFF`.

Si `PAID_GENERATION` ou Worker est ON → smoke interdit (gate procédurale).

---

## Idempotence

Clé Art dérivée de :

```text
art:{projectId}:{brief}:{plan}:{concept}:{script}:{model}:{promptVersion}:{schemaVersion}[:characterFingerprint]
```

Replay post-execute : `phase-10e-replay-idempotence.mjs` (refusé si `CONFIRM_PHASE_10E_PREP=1`).  
Route `/art/retry` : **interdite** pendant le smoke 10E.

---

## Scripts livrés

- `phase-10e-verify-upstream-artifacts.mjs`
- `phase-10e-prep-art-dry-run.mjs`
- `phase-10e-set-art-flags.mjs`
- `phase-10e-verify-flags-off.mjs`
- `smoke-phase-10e-art-vercel.mjs` (dry-only par défaut)
- `phase-10e-replay-idempotence.mjs`
- Tests : `phase-10e-prep-guards.test.ts`

Preuves sous `studio/.tmp/` (gitignoré).

---

## Autorisation humaine exacte requise (futur 10E)

```text
J’autorise la Phase 10E : un seul appel Art texte, modèle gpt-5.6,
estimate/réservation 13¢ (à confirmer dry-run live), plafond absolu 100¢,
écritures Production bornées (visual_direction + provenance + ledger),
PAID_GENERATION et worker restent OFF, fermeture immédiate des flags.
```

Confirmations :

```text
PHASE_10E_SMOKE_CONFIRM=ONE_ART_TEXT_CALL_MAX_100_CENTS
PHASE_10E_ALLOW_EXECUTE=1
PHASE_10E_DRY_ONLY=0
CONFIRM_PHASE_10E_VERCEL_FLAGS=1
```

---

## Validations PREP

| Check | Résultat |
|---|---|
| Unitaires | **1038/1038** |
| Typecheck | PASS |
| Lint | 0 erreur |
| Build | PASS |
| Syntax scripts | PASS |
| Secret scan (diff) | PASS |
| git diff --check | PASS |
| Provider calls | **0** |
| Remote writes | **0** |
| Push | **non** |
