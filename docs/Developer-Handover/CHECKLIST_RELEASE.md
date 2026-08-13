# Checklist de release V2

## Préparation

- [x] portée locale figée (Phases 1–9) ;
- [x] changelog, migrations locales, flags et runbooks relus ;
- [ ] sauvegarde récente et restauration testée **(distant — P1 `BACKUP_PRESENT_RESTORE_UNPROVEN`)** ;
- [ ] quotas/providers confirmés **(distant)** — Marketing→Storyboard texte validés ; média : smoke image 1× (`108_`) ledger soldé (`109_`) · HR pending ; budget 274/248/0/26 ;
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
| Migrations | **29/29** |
| pgTAP | **378** |
| Intégration DB | **33/33** |
| Unitaires | **1536/1536** (dont needs_review ledger + worker counter) |
| Runtime AI | **OFF** |
| Media jobs Production | **1** image `needs_review` (HR pending, `109_`) |
| OpenAI image Production path | **WIRED_DISABLED** runtime OFF · smoke 1× soldé ledger |

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

- [x] schéma Production aligné **29** migrations (historique 10A / incident 21 — ne pas rejouer à l’aveugle) ;
- [ ] app et workers compatibles déployés (smokes texte déjà passés sous flags bornés) ;
- [x] flags désactivés par défaut (code) — runtime **OFF** hors Auth ;
- [ ] smoke tests providers bornés — texte : **PASS** ; média : smoke 1× consommée (`108_`) · ledger soldé (`109_`) · HR pending ; budget 274/248/0/26 ;
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
- [ ] Human Review décision image — Auth distincte · pas de regenerate ;
- [ ] Legacy `/api/generate/image` — **≠** PASS Production.

## Verdict

```text
Phase 9 locale fakes : GO WITH EXCEPTIONS (snapshot 20_)
Phases 10B–10F texte réel : PASS (runtime OFF après chaque smoke)
Phase 11A média : LEDGER RECONCILED (`109_`) — runtime OFF · HR pending
Motion : MV-001 PASS_WITH_HUMAN_APPROVAL · MV-002 DEFERRED
Registry Motion Production : DISABLED
```

**Pas** : HR décidé · asset activé · MV-002 exécuté · Registry Motion activé.
