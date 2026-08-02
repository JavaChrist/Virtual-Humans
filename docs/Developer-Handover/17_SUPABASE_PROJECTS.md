# 17 — Projets Supabase

## Objectif

Persister projets, révisions métier, scènes, plans, jobs, assets, coûts et audit tout en garantissant séparation des utilisateurs et reprise de production.

## Tables minimales

| Table | Rôle |
|---|---|
| `video_projects` | racine, propriétaire, statut, révision active |
| `project_members` | rôles et accès futurs |
| `project_artifacts` | sorties versionnées des Directeurs en JSONB validé |
| `storyboard_scenes` | projection requêtable des scènes |
| `generation_plans` | plan approuvé, registre et politique |
| `production_jobs` | état interne et référence provider |
| `generation_attempts` | tentative, erreur, coût et timings |
| `assets` | métadonnées, bucket, chemin, checksum, provenance |
| `cost_ledger` | réservations, estimations, dépenses, remboursements |
| `domain_events` | outbox et événements dédupliqués |
| `audit_log` | actions sensibles append-only |

## Colonnes communes

UUID, `project_id`, `created_at`, `updated_at`, `created_by`, `schema_version`, `revision`, `correlation_id`. Montants en unité mineure et devise ISO. `provider_job_id` unique avec le provider quand présent.

## RLS

Refus par défaut. Lecture/écriture seulement si l'utilisateur possède le projet ou a un rôle explicite. Les workers utilisent un rôle serveur séparé et vérifient le `project_id`. Les buckets privés suivent le même modèle ; accès par URL signée courte.

## Cohérence

- transaction pour révision active + artifact ;
- contrainte unique sur idempotency key ;
- optimistic locking via `revision` ;
- outbox écrite dans la même transaction que l'état ;
- ledger append-only, jamais de réécriture d'un coût historique.

## Stockage

Chemin : `{ownerId}/{projectId}/{sceneId?}/{assetId}`. Conserver type MIME, taille, checksum, dimensions/durée, source, licences, expiration et statut de scan. Ne jamais rendre un bucket de production public.

## Rétention et suppression

Soft delete du projet, délai de récupération configurable, puis purge en cascade par job audité. Conserver uniquement ce que la loi, la facturation ou le consentement autorisent. Export de données disponible avant purge.

## Migrations

Créer migrations additives, backfill idempotent, lecture compatible ancien/nouveau, bascule, puis retrait différé. Tester sur copie anonymisée et documenter rollback. Ne jamais modifier une migration déployée.

