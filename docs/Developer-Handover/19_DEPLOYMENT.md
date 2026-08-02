# 19 — Déploiement et exploitation

## Environnements

Local, preview par changement, staging isolé, production. Bases, buckets, clés, webhooks et quotas séparés. Aucune donnée de production dans preview.

## Configuration

Valider au démarrage les variables serveur. Catégories : Supabase, storage, queue, providers, chiffrement, télémétrie, URLs de callback et feature flags. Aucun secret avec préfixe public.

## Pipeline

1. tests et scans ;
2. build reproductible ;
3. preview ;
4. migration additive staging ;
5. smoke/dry-run ;
6. approbation ;
7. migration production ;
8. déploiement applicatif/workers ;
9. canary et vérification ;
10. généralisation ou rollback.

## Feature flags

`director_enabled`, `paid_generation_enabled`, stratégies et adapters individuellement activables, limite pilote et kill switch global. Les flags ont propriétaire et date d'expiration.

## Observabilité

Logs structurés avec `correlationId`, `projectId`, `sceneId`, `stepId`, sans contenu sensible. Métriques : succès, latence, queue lag, erreurs par classe, taux fallback, coût estimé/réel, écart budgétaire, export et saturation. Traces à travers API, queue, worker et provider.

## SLO initiaux à valider

Disponibilité du parcours de planification, taux de jobs durablement enregistrés, délai de prise en charge, taux de réussite hors rejet contenu, précision d'estimation et temps de récupération. Les valeurs sont fixées après baseline et pilote.

## Rollback

Revenir à la version applicative précédente, désactiver les flags, conserver les workers compatibles et ne jamais rollback destructivement une migration. Les jobs en cours sont drainés ou annulés suivant runbook.

## Incidents

Runbooks : fuite de secret, dépenses anormales, provider indisponible, queue bloquée, webhook compromis, stockage saturé, corruption de projet et merge en panne. Chaque incident produit chronologie, impact, mitigation et actions.

## Sauvegarde

Sauvegardes de base et restauration testée, versioning/rétention des assets critiques, export des manifests. La présence d'une sauvegarde n'est pas considérée comme preuve tant qu'une restauration n'a pas réussi.

