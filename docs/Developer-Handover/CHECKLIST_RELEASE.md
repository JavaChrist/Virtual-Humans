# Checklist de release V2

## Préparation

- [x] portée locale figée (Phases 1–9) ;
- [x] changelog, migrations locales, flags et runbooks relus ;
- [ ] sauvegarde récente et restauration testée **(distant — autorisation humaine)** ;
- [ ] quotas/providers confirmés **(distant)** — Marketing (10B), Creative (10C), Script (10D) et Art texte (10E-V3) validés ; Storyboard V3 execute **BLOCKED** (`52_…`, lighting continuity) ; budget 115/107/8 ; média restent à autoriser ;
- [ ] support et fenêtre de déploiement informés **(distant)**.

## Qualité (locale — Phase 9)

- [x] build, lint (0 erreur), typecheck au vert ;
- [x] tests unitaires **785/785**, intégration DB **30/30**, pgTAP **276/276** ;
- [x] E2E locaux Playwright `/director` (fake + barrière réseau) **15/15 × 2 cycles** ;
- [x] dry-run de bout en bout (fake) ;
- [ ] test staging contrôlé ;
- [x] non-régression routes historiques (build inventaire + page `/storyboard` préservée).

## Sécurité et coûts

- [x] `APP_PASSWORD` + `APP_SESSION_SECRET` fail-closed — jamais dans le dépôt ;
- [x] secrets absents des bundles/logs / settings JSON ;
- [x] cookie session HttpOnly + SameSite + Secure (prod) + TTL ;
- [x] logout POST ; CSRF Origin ; rate-limit best-effort ;
- [x] worker : secret dédié ; cookie insuffisant ; flags off ;
- [x] store fake-merge gated (local/E2E only — Phase 9) ;
- [x] logs : data URLs redacted ;
- [ ] RLS et URLs signées **distantes** vérifiées ;
- [ ] alertes coût/erreur actives **(prod)**.

## Déploiement (nécessite autorisation humaine)

- [ ] migrations additives appliquées **distantes** ;
- [ ] app et workers compatibles déployés ;
- [x] flags désactivés par défaut (code) ;
- [ ] smoke tests providers bornés — Marketing / Creative / Script / Art texte : **PASS** ; Storyboard : execute v3 BLOCKED → DIAG lighting ; budget 115/107/8 ; média : à faire ;
- [ ] canary puis montée progressive ;
- [ ] métriques et logs surveillés.

## Validation post-release (distant)

- [ ] création et reprise d'un projet ;
- [ ] génération d'une scène et export réels ;
- [ ] coûts rapprochés ;
- [ ] aucun pic d'erreur/latence ;
- [ ] décision go/rollback enregistrée ;
- [ ] exceptions reportées au backlog.

## Verdict local Phase 9

```text
Virtual Humans Studio V2 — implémentation locale terminée, validée avec providers fakes, aucune opération distante
```

**Pas** : production distante validée.
