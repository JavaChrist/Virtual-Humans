# 38 — Phase 10F-PREP — Storyboard Director Text Smoke Preparation

**Date :** 10 août 2026  
**Entrée :** Phase 10E-V3 PASS (`0fef706`) + runtime OFF  
**Directeur :** Storyboard texte uniquement (préparation)  
**Provider calls :** **0**  
**Média / jobs / worker :** **0**

---

## Verdict

```text
READY_FOR_HUMAN_AUTH
```

Aucun appel Storyboard réel. Aucune écriture Vercel. Aucun push. Aucun média.

---

## Contrat Storyboard

| Champ | Valeur |
|---|---|
| Artifact DB | `storyboard_project` |
| Domaine | `StoryboardProject` |
| Schéma Zod projet | `StoryboardProjectSchema` (`1.0.0`) |
| Candidate IA | `StoryboardAnalysisCandidateSchema` / schema version `1.0.0` (`storyboard-analysis-candidate-v1`) |
| Prompt | **`storyboard-analyzer-v2`** (renforcé vs v1 : IDs segments, spoken fidelity, continuityKeys, assets) |
| Entrées | Brief + MarketingPlan + CreativeConcept + VideoScript + **VisualDirection** (actifs) |
| Correspondance segments | 5 script ↔ 5 VisualDirection ; couverture + ordre validés métier |
| Durée / timing | recalcul déterministe (`allocateStoryboardDurations`) — candidat non autoritatif |
| Continuity / narration / spoken | `validateCandidateAgainstSources` + coverage + conservation + continuity |
| Provider | OpenAI Responses + Structured Outputs |
| Modèle (canon PREP) | `gpt-5.6` (pattern Production text directors ; **pas** défaut code `gpt-5.6-terra`) |
| Reasoning / maxOut (canon PREP) | `medium` / `4096` |
| Défauts code (transparence) | `gpt-5.6-terra` / `low` / `3200` → estimate code **10¢** |
| Estimateur | price book Marketing partagé (`OPENAI_MARKETING_PRICE_*`) |
| Idempotence | préfixe `stb:` + brief/plan/concept/script/visual + model + prompt + schema |
| Flags | `DIRECTOR_V2_STORYBOARD_AI_ENABLED` + `PAID_AI` + persistence ; upstream AI OFF ; worker/PAID_GENERATION OFF |
| Retry/fallback | **aucun** retry auto ; **pas** de route `/storyboard/retry` |
| Chaînage média / Production | **NON** — Storyboard text-only ; flags média orthogonaux ; smoke refuse si PAID_GENERATION ou worker ON |

Validations métier existantes **non affaiblies**. Zod candidat ≠ validations métier (ex. coverage) prouvé en test.

---

## Artifacts amont réutilisables

| Artifact | id | rev | actif |
|---|---|---:|---|
| MarketingPlan | `199284d6-7126-4383-b85f-1ecd74d9528e` | 1 | oui |
| CreativeConcept | `11f8f8e0-a280-43aa-a7ea-5e6b0401b72a` | 1 | oui |
| VideoScript | `349e2792-3235-4c00-a1da-9e087b0b4d1c` | 1 | oui |
| VisualDirection | `49481462-6444-41f9-8c48-7e7d32c09f1b` | 1 | oui (5 segments, Art v3) |
| StoryboardProject | — | — | **absent** |

Projet : `984507af-a89e-4644-8ea3-344797baa974`  
Run Art v3 : `51d47124-54eb-41c1-8d03-3dbb5a8b7b1e` (completed) — immuable.  
Marketing / Creative / Script / Art : **jamais régénérés** dans la fenêtre 10F-PREP.

Hashes PREP (prefix) : Marketing `fa0097b80e1b662d` · Creative `c7cb65fda9f51182` · Script `6650d46ad6fee581` · Visual `0763ee2771c408c3`.

---

## Storyboard dry-run (local, sans provider)

| Champ | Valeur |
|---|---|
| providerCalled | **false** |
| executable | true |
| provider | openai |
| model | `gpt-5.6` (pattern Production documenté) |
| reasoningEffort | `medium` |
| maxOutputTokens | 4096 |
| promptVersion | `storyboard-analyzer-v2` |
| schemaVersion | `1.0.0` |
| idempotencyKeyVersion | `storyboard-analyzer-v2:1.0.0` |
| approximateInputTokens | 2638 |
| pricingConfigured | true |
| priceVersion | `manual-2026-08-porte7-sol` |
| input / output per 1M | 500 / 3000 minor USD |
| estimatedCostMinor | **13** |
| reservationPlanned | **13** (`reservation == estimate`) |
| proposedCeilingMinor | **100** |
| codeDefaultEstimate (transparence) | 10¢ (`gpt-5.6-terra` / 3200) |

### Confiance knobs Production

```text
OPENAI_STORYBOARD_* = Encrypted présents ou redacted sur Vercel Production
vercel env pull = redacted (valeurs non observables en PREP)
storyboardKnobConfidence = unconfirmed_pending_live_dry_run
```

Canon PREP = pattern text directors 10B–10E (`gpt-5.6` / `medium` / `4096`), **pas** les défauts code.  
Le premier dry-run Production live (après ouverture des flags) **doit** confirmer model / effort / maxOut / estimate avant l’unique appel. Divergence → BLOCKED.

Dry-run application expose explicitement : `promptVersion`, `schemaVersion`, `provider`, `model`, `reasoningEffort`, `maxOutputTokens`, `estimate` (`estimatedCostMinor`), `pricingConfigured`, `providerCalled`, `executable`, `idempotencyKeyVersion`.

---

## Matrice flags prévue (futur execute uniquement)

| Flag | Valeur 10F |
|---|---|
| `DIRECTOR_V2_ENABLED` | 1 |
| `DIRECTOR_V2_PERSISTENCE_ENABLED` | 1 |
| `DIRECTOR_V2_PAID_AI_ENABLED` | 1 |
| `DIRECTOR_V2_STORYBOARD_AI_ENABLED` | 1 |
| Marketing / Creative / Script / Art AI | **0** |
| Worker | **0** |
| Paid generation | **0** |

Ouverture (futur) :

```text
CONFIRM_PHASE_10F_VERCEL_FLAGS=1 node scripts/phase-10f-set-storyboard-flags.mjs on
# redeploy Production
# dry-run live must match canon (model/effort/maxOut/estimate)
```

Fermeture (obligatoire, même après erreur) :

```text
CONFIRM_PHASE_10F_VERCEL_FLAGS=1 node scripts/phase-10f-set-storyboard-flags.mjs off
# redeploy Production
node scripts/phase-10f-verify-flags-off.mjs
```

Runtime actuel (PREP) : `CURRENT_RUNTIME_REAL_AI=OFF`.

Si `PAID_GENERATION` ou Worker est ON → smoke interdit (gate procédurale + script smoke).

---

## Idempotence

Clé Storyboard dérivée de :

```text
stb:{projectId}:{brief}:{plan}:{concept}:{script}:{visual}:{model}:{promptVersion}:{schemaVersion}
```

(hash SHA-256 si longueur > 200). Prompt v2 ⇒ identité distincte de v1.

Replay post-execute : `phase-10f-replay-idempotence.mjs` (refusé si `CONFIRM_PHASE_10F_PREP=1`).  
Retry provider / fallback / route retry : **interdits**.

---

## Scripts livrés

- `phase-10f-verify-upstream-artifacts.mjs`
- `phase-10f-prep-storyboard-dry-run.mjs`
- `phase-10f-set-storyboard-flags.mjs` (refuse `on` si `CONFIRM_PHASE_10F_PREP=1`)
- `phase-10f-verify-flags-off.mjs`
- `smoke-phase-10f-storyboard-vercel.mjs` (dry-only par défaut)
- `phase-10f-replay-idempotence.mjs`
- Tests : `phase-10f-prep-guards.test.ts`

Preuves sous `studio/.tmp/` (gitignoré).

---

## Autorisation humaine exacte requise (futur 10F)

```text
J’autorise la Phase 10F : un seul appel Storyboard texte, modèle gpt-5.6,
estimate/réservation 13¢ (à confirmer dry-run live), plafond absolu 100¢,
écritures Production bornées (storyboard_project + provenance + ledger),
Marketing/Creative/Script/Art AI restent OFF,
PAID_GENERATION et worker restent OFF, fermeture immédiate des flags.
```

Confirmations :

```text
PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_100_CENTS
PHASE_10F_ALLOW_EXECUTE=1
PHASE_10F_DRY_ONLY=0
CONFIRM_PHASE_10F_VERCEL_FLAGS=1
```

---

## Validations PREP

| Check | Résultat |
|---|---|
| Unitaires | **1062/1062** |
| Typecheck | PASS |
| Lint | 0 erreur |
| Build | PASS |
| Syntax scripts | PASS |
| Secret scan (diff) | PASS |
| git diff --check | PASS |
| Provider calls | **0** |
| Remote writes | **0** |
| Push | **non** |
