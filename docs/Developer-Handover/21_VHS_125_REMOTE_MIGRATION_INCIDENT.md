# 21 — Incident VHS-125 : historique de migration Production (Porte 3)

**Date UTC incident :** 2026-08-04 (apply ≈ 13:43–14:04Z)  
**Date UTC réconciliation locale :** 2026-08-04  
**Cible :** Virtual Humans Studio / `ejdbksxaswhdtsudnmvi` / `eu-west-3` / PostgreSQL 17  
**Statut :** schéma Production inchangé et vert ; historique local réconcilié (correctif Porte 3)

## 1. Résumé

Lors de l’application contrôlée des migrations V2 via MCP `apply_migration` (sans `supabase link`), le payload de `vhs_125_postproduction_delivery` a été **tronqué**. La version distante a néanmoins été enregistrée comme appliquée. Le SQL manquant a été complété par trois migrations remainder. Le schéma final Production est correct ; le dépôt local devait expliquer et aligner les **22** versions distantes.

## 2. Cause

- Outil : MCP Supabase `apply_migration` (timestamps générés à l’apply, distincts des préfixes locaux d’origine `20260802*` / `20260803*`).
- Cause immédiate : payload SQL de `vhs_125_postproduction_delivery` coupé après `persist_production_result`, terminé par le marqueur artificiel `-- PLACEHOLDER_CONTINUE`.
- Conséquence : objets quality / merge / export absents jusqu’aux remainder ; historique Production à **22** entrées (2 legacy + 17 V2 + 3 remainder).

## 3. Versions distantes exactes (ordre)

| # | Version | Nom |
|---:|---|---|
| 1 | `20260723203021` | `vh_studio_init_spend_products_storage` |
| 2 | `20260728210808` | `create_vh_scenes` |
| 3 | `20260804134311` | `vhs_113_v2_core` |
| 4 | `20260804134410` | `vhs_113_v2_production_queue` |
| 5 | `20260804134443` | `vhs_113_v2_ledger_events_assets` |
| 6 | `20260804134500` | `vhs_113_v2_rls_grants` |
| 7 | `20260804134537` | `vhs_114_reschedule_payload` |
| 8 | `20260804134814` | `vhs_116_create_project_with_brief` |
| 9 | `20260804135019` | `vhs_117b_director_runs` |
| 10 | `20260804135045` | `vhs_118b_creative_director_runs` |
| 11 | `20260804135120` | `vhs_119b_script_director_runs` |
| 12 | `20260804135149` | `vhs_120b_art_director_runs` |
| 13 | `20260804135227` | `vhs_121b_storyboard_director_runs` |
| 14 | `20260804135342` | `vhs_122_prompt_director_runs` |
| 15 | `20260804135608` | `vhs_123_routing_director_runs` |
| 16 | `20260804135702` | `vhs_124_production_director` |
| 17 | `20260804135742` | `vhs_125_postproduction_delivery` *(partiel distant)* |
| 18 | `20260804140056` | `vhs_125_remainder_part1` |
| 19 | `20260804140143` | `vhs_125_remainder_part2` |
| 20 | `20260804140225` | `vhs_125_remainder_part3` |
| 21 | `20260804140309` | `vhs_126_brief_revisions_stale` |
| 22 | `20260804140422` | `vhs_127_director_final_assets_bucket` |

## 4. Payloads VHS-125 / remainder (hashes)

| Version | Nom | Octets | SHA-256 du SQL exécuté |
|---|---|---:|---|
| `20260804135742` | `vhs_125_postproduction_delivery` | 8671 | `0e1c713efbf0ad68d49439b104cc318475b7cbeb5f2ad0b8f884015205dcf063` |
| `20260804140056` | `vhs_125_remainder_part1` | 9391 | `dbb453bb427c79a80c58515719bd87783bfdedca6cd24d01f33afdf568778826` |
| `20260804140143` | `vhs_125_remainder_part2` | 15891 | `14291668c6adfdb98039eebbb575d7ab7eff0fd8f4958bce89407a5cdf1d2dbe` |
| `20260804140225` | `vhs_125_remainder_part3` | 12828 | `8c6610b44cefc280e4f310d63603592bdf2afc12a1f9f2a44c332e31de72ea78` |

Copies d’audit hors Git (ne pas committer) :

`C:\Users\JavaChrist\Backups\virtual-humans\supabase\2026-08-04\vhs125-incident-audit\`

## 5. Frontière de troncature

Le payload partiel est un préfixe du SQL canonique jusqu’à la fin de :

`CREATE OR REPLACE FUNCTION public.persist_production_result(...) ... END; $$;`

puis se termine par :

```text
-- PLACEHOLDER_CONTINUE
```

Le SQL canonique local continue immédiatement après par :

`CREATE OR REPLACE FUNCTION public.begin_or_get_quality_director_run(...)`

Offset approximatif dans le fichier canonique : début de `begin_or_get_quality_director_run` ≈ octet **9389**.

### Objets par morceau distant

| Morceau | Objets |
|---|---|
| Partiel `vhs_125` | contraintes artifact/director étendues ; table `human_review_decisions` + trigger append-only + RLS/grants table ; `persist_production_result` |
| Remainder part1 | `begin_or_get_quality_director_run`, `persist_quality_report` |
| Remainder part2 | `persist_human_review_decision`, `begin_or_get_merge_director_run`, `persist_merge_outcome` |
| Remainder part3 | `begin_or_get_export_director_run`, `persist_export_package`, `REVOKE`/`GRANT EXECUTE` delivery |

## 6. Équivalence avec le canonique local

Fichier canonique (contenu conservé, version renommée pour alignement Production) :

`studio/supabase/migrations/20260804135742_vhs_125_postproduction_delivery.sql`

| Critère | Résultat |
|---|---|
| Égalité octet-à-octet concaténation vs canonique | **non** (commentaires omis dans les parts, absence de `COMMIT` sur la concat, marqueur `PLACEHOLDER_CONTINUE`) |
| Corps des 9 fonctions (whitespace normalisé) | **identiques** |
| Tables / contraintes / GRANT / REVOKE EXECUTE | **identiques** |
| Strip commentaires + `BEGIN`/`COMMIT` + whitespace | **égal** |
| Classification | **équivalent sémantique démontré** |

Aucun SQL canonique manquant en Production. Aucun SQL supplémentaire non prévu (hors marqueur de troncature non mutatif).

## 7. État final Production (contrôles Porte 3, inchangé par ce correctif)

- Legacy : `vh_spend` / `vh_products` / `vh_scenes` = 4 / 2 / 1
- `product-screens` : 10 objets, bucket privé
- `director-final-assets` : présent, privé, 50 MiB, 0 objet
- Jobs / réservations / `cost_ledger` / workspaces V2 : 0
- RLS V2 actif ; `anon` refusé sur tables/RPC critiques

**Ce correctif n’effectue aucune écriture distante.**

## 8. Décision de réconciliation locale

1. Renommer les 17 fichiers V2 locaux pour porter les **versions numériques Production** (MCP), sans modifier le SQL mutatif canonique.
2. Conserver le SQL VHS-125 **complet** sous `20260804135742_vhs_125_postproduction_delivery.sql` (rebuild local en une seule passe).
3. Ajouter trois fichiers marqueurs no-op aux versions/noms remainder distants (hashes documentés, `DO $$ BEGIN NULL; END $$`).
4. Documenter l’incident ici ; interdiction de supprimer les remainder de l’historique Production.

### Comportement attendu

| Opération | Attendu |
|---|---|
| `supabase db reset` local | 22 migrations ; VHS-125 plein une fois ; remainder no-op ; schéma final = canonique |
| Dry-run / list vs Production | 22/22 versions alignées ; 0 manquante ; 0 supplémentaire |
| Nouvel apply Production | **interdit** sans nouvelle autorisation ; ne pas rejouer les remainder mutatifs |
| `migration repair` | **interdit** pour « corriger » cet incident |
| Suppression remainder distants | **interdite** |

## 9. Procédure opérateur futur

1. Ne jamais réécrire silencieusement l’historique Production.
2. Pour un nouvel environnement local : `db reset` depuis ce dépôt suffit.
3. Pour comparer à Production : `list_migrations` lecture seule — les 22 versions doivent matcher.
4. Si un écart de schéma apparaît : arrêter, ne pas inventer de repair ; ouvrir une nouvelle autorisation.
5. Ne pas concaténer les remainder dans un apply distant « de rattrapage » sur une base déjà complète.

## 10. Interdictions permanentes (rappel)

- pas de `supabase link` / `db push` / `migration repair` sans autorisation écrite ;
- pas de suppression d’entrées `schema_migrations` Production ;
- pas de restauration / `db reset` distant ;
- pas d’affichage de secrets.
