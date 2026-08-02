# Checklist de release V2

## Préparation

- [ ] portée, commit et responsables figés ;
- [ ] changelog, migrations, flags et runbooks relus ;
- [ ] sauvegarde récente et restauration testée ;
- [ ] quotas/providers confirmés ;
- [ ] support et fenêtre de déploiement informés.

## Qualité

- [ ] build, lint, typecheck et CI au vert ;
- [ ] tests unitaires, intégration, contrats et E2E critiques ;
- [ ] dry-run de bout en bout ;
- [ ] test staging contrôlé ;
- [ ] accessibilité et non-régression studios.

## Sécurité et coûts

- [ ] secrets absents des bundles/logs ;
- [ ] RLS et URLs signées vérifiées ;
- [ ] rate limit, permissions et webhooks ;
- [ ] estimation, plafond dur et kill switch ;
- [ ] alertes coût/erreur actives.

## Déploiement

- [ ] migrations additives appliquées ;
- [ ] app et workers compatibles déployés ;
- [ ] flags désactivés par défaut ;
- [ ] smoke tests ;
- [ ] canary pilote puis montée progressive ;
- [ ] métriques et logs surveillés.

## Validation post-release

- [ ] création et reprise d'un projet ;
- [ ] génération d'une scène et export ;
- [ ] coûts rapprochés ;
- [ ] aucun pic d'erreur/latence ;
- [ ] décision go/rollback enregistrée ;
- [ ] exceptions reportées au backlog.

