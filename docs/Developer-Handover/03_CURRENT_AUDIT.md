# 03 — Audit de l'existant

**Classe :** `HISTORICAL_SNAPSHOT` (protocole d’entrée pack V2)

> **Supersédé pour l’état du code** par `CURRENT_CODEBASE_AUDIT.md` (Phase 0→Porte 1),
> `20_FINAL_AUDIT.md` (Phase 9 fakes), puis rapports `23`–`58` (Phases 10–11A).
> Conserver ce fichier comme **protocole** de matrice reuse/wrap/refactor — ne pas le lire comme état 2026-08-11.

## Statut (historique)

À la rédaction du pack, le dépôt n’était pas joint. Le protocole ci-dessous a été exécuté ensuite (VHS-001). **Ne pas** présenter ce document comme inventaire courant.

## Inventaire

1. Cartographier routes, composants, hooks, services, types, API routes et tâches asynchrones.
2. Relever versions Next.js, React, TypeScript, Supabase et bibliothèques de test.
3. Identifier les appels directs aux providers et les secrets exposés.
4. Relever les schémas Supabase, migrations, buckets, RLS et fonctions.
5. Localiser Runtime SDK, registre de personnages, moteurs storyboard/merge/export.
6. Exécuter build, lint, typecheck et tests sans corriger immédiatement.

## Matrice de réutilisation

Pour chaque actif : nom, emplacement, propriétaire, responsabilité, consommateurs, couverture, dette, décision (`reuse`, `wrap`, `refactor`, `replace`, `retire`) et justification.

## Risques à rechercher

- logique métier dans React ;
- prompts ou noms de modèles codés en dur ;
- appels providers depuis l'UI ;
- duplication du storyboard ;
- couplage Tom/Mei ;
- jobs sans idempotence ;
- retry infini ou dépenses sans plafond ;
- tables sans RLS ;
- secrets `NEXT_PUBLIC_*` ;
- gros composants et routes API multifonctions ;
- absence de migrations ou de rollback.

## Livrables d'audit

- carte du dépôt ;
- diagramme des flux actuels ;
- registre des écarts face à V2 ;
- plan de migration par incréments ;
- baseline de tests et performances ;
- liste des décisions à confirmer.

## Critères de sortie

L'audit est terminé quand chaque module cible a un point d'intégration identifié, chaque donnée persistée a un propriétaire, les risques P0/P1 ont un plan, et aucune hypothèse critique ne reste confondue avec un fait.

