# 06 — Roadmap V2

## Principe

Chaque phase produit un incrément déployable derrière un feature flag. Une phase ne commence que lorsque ses dépendances et critères de sortie sont satisfaits.

| Phase | Résultat | Dépend de | Critère de sortie |
|---:|---|---|---|
| 0 | audit et baseline | — | écarts et risques validés |
| 1 | sécurité/observabilité | 0 | RLS, secrets, corrélation, alertes |
| 2 | objets métier et schemas | 0 | contrats versionnés testés |
| 3 | workflow `/director` minimal | 2 | reprise et autosave |
| 4 | Marketing + Creative | 2 | sorties déterministes validées |
| 5 | Script + Art | 4 | durée et cohérence visuelle |
| 6 | Storyboard + Prompt | 5 | packages de scène complets |
| 7 | Capability Registry + Router | 6 | plans expliqués et budgétés |
| 8 | Generation Engine adapters | 1,7 | dry-run et contrats providers |
| 9 | Production Director | 8 | reprise, fallback, annulation |
| 10 | merge, validation, export | 9 | export traçable |
| 11 | persistance Supabase complète | 3–10 | RLS et migrations vérifiés |
| 12 | E2E, charge, accessibilité | 11 | gates de release au vert |
| 13 | pilote puis généralisation | 12 | SLO et budget observés |

## Priorités

P0 : sécurité, contrats, budget, idempotence et récupération.  
P1 : parcours complet, qualité du routage, observabilité et UX d'erreur.  
P2 : stratégies supplémentaires, analytics et optimisation.  
P3 : apprentissage et automatisations futures.

## Stratégie de livraison

Activer successivement : équipe interne, projets de test, petit groupe pilote, puis tous les utilisateurs. Conserver un kill switch pour la production payante et la possibilité de revenir aux studios avancés.

