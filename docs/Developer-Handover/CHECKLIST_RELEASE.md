# Checklist de release V2

## Préparation

- [x] portée locale figée (Phases 1–9) ;
- [x] changelog, migrations locales, flags et runbooks relus ;
- [x] living handover `CURRENT_STATE_AND_RESUME.md` à jour + script de fraîcheur ;
- [ ] sauvegarde récente et restauration testée **(distant — P1 `BACKUP_PRESENT_RESTORE_UNPROVEN`)** ;
- [ ] quotas/providers confirmés **(distant)** — Marketing→Storyboard texte validés ; média : 2× image · 3 REJECT (smoke + 1.0.0 + 1.1.0 `123_`) ; parent pending réutilisable ; budget 274/249/0/25 ;
- [ ] support et fenêtre de déploiement informés **(distant)**.

## Qualité

### Checkpoint Phase 9 (historique — 3 août 2026)

- [x] build, lint (0 erreur), typecheck au vert ;
- [x] tests unitaires **785/785**, intégration DB **30/30**, pgTAP **276/276** ;
- [x] E2E locaux Playwright `/director` (fake + barrière réseau) **15/15 × 2 cycles** ;
- [x] dry-run de bout en bout (fake) ;
- [x] non-régression routes historiques (build inventaire + page `/storyboard` préservée).

### Baseline courante (post-10A / Phase 11A PREP — 11 août 2026)

| Check | Valeur |
|---|---|
| Migrations | **30/30** (live 14 août · MT-005 incluse) |
| pgTAP | **378** |
| Intégration DB | **33/33** |
| Unitaires | **1604/1604** (dont glyphes bitmap `120_`) |
| Living handover | `CURRENT_STATE_AND_RESUME.md` + `check-current-state-freshness.mjs` |
| Runtime AI | **OFF** |
| Media jobs Production | **2** image `completed` (2 REJECT · parent pending, `119_`) |
| OpenAI image Production path | **WIRED_DISABLED** runtime **245bea2** OFF · composed 1.0.0 + 1.1.0 HUMAN_REJECTED · 1.2.0 HUMAN_APPROVED inactif (`127_`) · parent conservé |

- [ ] test staging contrôlé.

## Sécurité et coûts

- [x] `APP_PASSWORD` + `APP_SESSION_SECRET` fail-closed — jamais dans le dépôt ;
- [x] secrets absents des bundles/logs / settings JSON ;
- [x] cookie session HttpOnly + SameSite + Secure (prod) + TTL ;
- [x] logout POST ; CSRF Origin ; rate-limit best-effort ;
- [x] worker : secret dédié ; cookie insuffisant ; flags off ;
- [x] store fake-merge gated (local/E2E only — Phase 9) ;
- [x] logs : data URLs redacted ;
- [x] Supabase target guard fail-closed ;
- [ ] RLS et URLs signées **distantes** vérifiées ;
- [ ] alertes coût/erreur actives **(prod)**.

## Déploiement (nécessite autorisation humaine)

- [x] schéma Production aligné **30** migrations (29 historiques 10A + MT-005 · ne pas rejouer à l’aveugle) ;
- [ ] app et workers compatibles déployés (smokes texte déjà passés sous flags bornés) ;
- [x] flags désactivés par défaut (code) — runtime **OFF** hors Auth ;
- [ ] smoke tests providers bornés — texte : **PASS** ; média : smoke 1× consommée (`108_`) · ledger soldé (`109_`) · HR REJECT (`110_`) ; budget 274/248/0/26 ;
- [ ] canary puis montée progressive ;
- [ ] métriques et logs surveillés.

## Validation post-release (distant)

- [x] création et reprise d'un projet (smokes texte) ;
- [ ] génération d'une scène et export **média** réels ;
- [x] coûts rapprochés (ledger smokes texte) ;
- [ ] aucun pic d'erreur/latence (généralisation) ;
- [ ] décision go/rollback enregistrée ;
- [ ] exceptions reportées au backlog.

## Motion Transfer (benchmark)

- [x] MV-001 paid + HR APPROVE (`97_`) — capability Production **NOT** enabled ;
- [x] MT-014 eval `PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY` (`99_`) ;
- [x] MT-015A MV-002 **DESIGN_READY** + **DEFERRED** (`100_`) ;
- [ ] MV-002 — **non repris** (11A prioritaire).

## Phase 11A média `/director`

- [x] Prep `58_` · `101_` · wire `102_` · preflight `103_` · final `104_` (`9952380`) ;
- [x] Prompt-gate `[DATA:…]` validé live ; hostiles URL/Motion rejetés ;
- [x] Auth smoke once tentée (`105_`) → **BLOCKED_PRECONDITION** · provider non consommé ;
- [x] Wire Storage + strip base64 + plan single-step (`106_`) — **WIRED_DISABLED** ;
- [x] Live preflight no-provider (`107_`) · source **7a67c77** · FP `c532c400334f5b22` · `READY_FOR_11A_PAID_AUTH` ;
- [x] Smoke image réel (`108_`) · Auth consommée · **`RECONCILIATION_REQUIRED`** (reserve 1¢) ;
- [x] Ledger reconcile smoke 1¢ (`109_`) · **PASS** · reserved 0 · committed 248 ;
- [x] Human Review REJECT image (`110_`) · **PASS_TECHNICAL_ASSET_HUMAN_REJECTED** · pas de regenerate ;
- [x] Harden typographie déterministe / provider no-text (`111_`) · **WIRED_DISABLED** · 0 OpenAI ;
- [x] Preflight retry text-free (`112_`) · source **20e8783** · **BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT** ;
- [x] Strip overlay copy du variant image (`113_`) · **READY_FOR_NEW_TEXT_FREE_IMAGE_RETRY_PREFLIGHT** · 0 OpenAI ;
- [x] Preflight live text-free (`114_`) · source **e4c3de3** · **READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH** · 0 OpenAI ;
- [x] Paid text-free (`115_`) · **COMPOSITOR_FAILED_NO_RETRY** · 1 submit · 0 composed ;
- [x] Harden PNG decoder filtres 0–4 (`116_`) · **READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_PREFLIGHT** · 0 OpenAI ;
- [x] Preflight compose asset existant (`117_`) · **READY_FOR_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION** · 0 OpenAI · 0 write ;
- [x] Compose execution asset existant (`118_`) · **COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING** · 0 OpenAI · HR seedée ;
- [x] Composed HR REJECT (`119_`) · **PASS_PROVIDER_ASSET_COMPOSED_ASSET_HUMAN_REJECTED** · 0 OpenAI · parent inchangé ;
- [x] Diagnostic glyphes bitmap (`120_`) · **BITMAP_GLYPH_RENDERING_FIXED_READY_FOR_RECOMPOSITION_PREFLIGHT** · 0 OpenAI ;
- [x] Preflight recomposition 1.1.0 (`121_`) · **READY_FOR_CORRECTED_EXISTING_PROVIDER_ASSET_RECOMPOSITION_EXECUTION** · 0 write · 0 OpenAI ;
- [x] Execution recomposition 1.1.0 (`122_`) · **CORRECTED_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING** · 1 enfant privé · 0 OpenAI ;
- [x] HR composé 1.1.0 REJECT (`123_`) · **PASS_PROVIDER_AND_GLYPHS_TECHNICAL_COMPOSED_ASSET_HUMAN_REJECTED** · 0 OpenAI ;
- [x] Amélioration typo/layout 1.2.0 locale (`124_`) · **OVERLAY_TYPOGRAPHY_LAYOUT_IMPROVED_READY_FOR_REAL_PARENT_PREFLIGHT** · 0 OpenAI · 0 média Production ;
- [x] Preflight parent réel 1.2.0 (`125_`) · **PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_READY_FOR_HUMAN_VISUAL_DECISION** · 0 write · 0 OpenAI ;
- [x] Execution 1.2.0 (`126_`) · **PROFESSIONAL_COMPOSED_ASSET_PRIVATE_HUMAN_REVIEW_PENDING** · 1 enfant privé · HR seedée · 0 OpenAI ;
- [x] HR composé 1.2.0 APPROVE (`127_`) · **PHASE_11A_PASS_WITH_HUMAN_APPROVED_PROFESSIONAL_IMAGE** · `active=false` · 0 OpenAI ;
- [x] Clôture 11A + roadmap (`128_`) · **PHASE_11A_CLOSED_NEXT_MEDIA_GATE_DEFINED** · next = I2V wiring preflight ;
- [x] Wiring I2V `/director` (`129_`) · **I2V_PRODUCTION_PATH_WIRED_DISABLED_READY_FOR_LIVE_PREFLIGHT** · 0 fal ;
- [x] Live preflight I2V no provider (`130_`) · **I2V_LIVE_PREFLIGHT_NO_PROVIDER_READY_FOR_PAID_AUTH** · 0 fal ;
- [x] Hard limit I2V 437¢ (`131_`) · **I2V_BUDGET_HARD_LIMIT_437_APPLIED_PAID_EXECUTION_STILL_LOCKED** · 0 réserve · 0 fal ;
- [x] Paid smoke final preflight I2V (`132_`) · **I2V_PAID_SMOKE_FINAL_PREFLIGHT_READY_FOR_SINGLE_PAID_AUTH** · 0 fal ;
- [x] First paid I2V (`133_`) · **I2V_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING** · 1 fal · HR pending · flags OFF ;
- [x] HR I2V APPROVE (`134_`) · **I2V_FIRST_PAID_VIDEO_HUMAN_APPROVED_PRIVATE_INACTIVE** · `active=false` · 0 fal ;
- [ ] Legacy `/api/generate/image` — **≠** PASS Production.

## Verdict

```text
Phase 9 locale fakes : GO WITH EXCEPTIONS (snapshot 20_)
Phases 10B–10F texte réel : PASS (runtime OFF après chaque smoke)
Phase 11A média : **CLOSED** PASS_WITH_NOTES · 1.2.0 HUMAN_APPROVED inactif (`128_`) — applicatif `d395ec7`
I2V `/director` : HTTP **WIRED_DISABLED** · smoke réel HUMAN_APPROVED inactif (`134_`) · `1d75541` · 1 fal · flags OFF
Motion : MV-001 PASS_WITH_HUMAN_APPROVAL · MV-002 DEFERRED
Registry Motion Production : DISABLED
Registry I2V Production : DISABLED
```

**Pas** : asset activé · 2e OpenAI · MV-002 exécuté · Registry Motion activé.
