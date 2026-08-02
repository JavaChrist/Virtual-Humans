# 18 — Stratégie de tests

## Pyramide

- nombreux tests unitaires du domaine et des schemas ;
- tests d'intégration pour workflow, repository, queue et Supabase local ;
- tests de contrat uniformes pour providers ;
- E2E ciblés sur parcours critiques ;
- tests manuels exploratoires pour qualité audiovisuelle.

## Gates CI

Format, lint, TypeScript strict, tests unitaires/intégration, migrations, build, scan secrets/dépendances et tests E2E critiques. Aucun appel payant en CI.

## Fixtures canoniques

Application mobile, restaurant, photographe, service B2B, commerce et association ; formats 15/20/30/60 s ; plateformes supportées ; personnages génériques solo/duo ; médias présents/absents ; plusieurs langues.

## Tests par couche

Directeurs : invariants, traçabilité aux entrées, validation et absence de responsabilité interdite.  
Router : matrice de capacités figée, scoring, budget, explication et déterminisme.  
Production : machine d'état, idempotence, concurrence, retry/fallback, reprise et annulation.  
Engine : contrats, webhooks, erreurs, timeout et redaction.  
UI : accessibilité, autosave, conflits, erreurs et reprise.  
Data : RLS, migrations, contraintes, purge et URLs signées.

## IA non déterministe

Tester d'abord schémas et invariants, pas une formulation exacte. Enregistrer des réponses synthétiques représentatives. Pour les évaluations qualitatives, utiliser un jeu versionné, une grille explicite et une revue humaine sur les changements majeurs.

## Résilience

Injecter : timeout, 429, 5xx, callback tardif/dupliqué, sortie invalide, stockage indisponible, worker interrompu, concurrence, dépassement de budget et annulation pendant un appel.

## Performance

Mesurer temps d'interaction UI, temps de planification, débit workers, délai de reprise, charge de polling/webhook et mémoire du merge. Définir les seuils après baseline, puis empêcher toute régression significative.

## Critères release

Zéro test critique rouge ou flaky connu ; couverture des invariants à 100 % ; E2E principal et rollback démontrés ; suite RLS complète ; dry-run de bout en bout ; test payant contrôlé en préproduction si autorisé.

