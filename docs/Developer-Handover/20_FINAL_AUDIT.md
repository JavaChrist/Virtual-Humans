# 20 — Audit final V2

## Décision

La release est `GO`, `GO WITH EXCEPTIONS` ou `NO-GO`. Toute exception indique propriétaire, échéance et risque accepté. Un P0 ouvert impose `NO-GO`.

## Architecture

- [ ] pipeline et noms conformes au freeze ;
- [ ] aucun appel entre Directeurs ;
- [ ] objets métier validés et versionnés ;
- [ ] aucun provider dans domaine/UI ;
- [ ] Production Director seul orchestrateur ;
- [ ] une seule source storyboard.

## Fonctionnel

- [ ] brief → export fonctionne ;
- [ ] approbations et révisions persistent ;
- [ ] scène régénérable seule ;
- [ ] reprise après interruption ;
- [ ] merge/export et manifeste valides ;
- [ ] studios existants non régressés.

## Budget et fiabilité

- [ ] estimation avant appel ;
- [ ] plafond dur et réservation atomique ;
- [ ] idempotence/webhooks dédupliqués ;
- [ ] retry et fallbacks bornés ;
- [ ] coûts réels rapprochés ;
- [ ] annulation testée.

## Sécurité et données

- [ ] secrets serveur et rotation possible ;
- [ ] RLS/buckets privés testés ;
- [ ] rate limits et permissions ;
- [ ] logs redacted ;
- [ ] rétention, export et purge ;
- [ ] dépendances et images scannées.

## Qualité

- [ ] CI au vert et aucun flaky critique ;
- [ ] tests de contrats adapters ;
- [ ] E2E principal, erreurs et accessibilité ;
- [ ] charge et reprise ;
- [ ] observabilité et alertes vérifiées ;
- [ ] rollback/restauration démontrés.

## Documentation

- [ ] contrats correspondent au code ;
- [ ] migrations et runbooks documentés ;
- [ ] changelog et backlog à jour ;
- [ ] variables et flags inventoriés ;
- [ ] propriétaires opérationnels identifiés.

## Rapport final

Inclure version/commit, environnement, période d'audit, preuves, écarts, risques résiduels, décision et signatures produit/tech/opérations. Archiver le rapport avec les artefacts de release.

