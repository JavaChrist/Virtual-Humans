# 19 — Déploiement et exploitation

## Environnements

Local, preview par changement, staging isolé, production. Bases, buckets, clés, webhooks et quotas séparés. Aucune donnée de production dans preview.

## Configuration

Valider au démarrage les variables serveur. Catégories : Supabase, storage, queue, providers, chiffrement, télémétrie, URLs de callback et feature flags. Aucun secret avec préfixe public.

### Authentification fail-closed (VHS-002)

Obligatoires (accès protégé refusé sinon) :

```text
APP_PASSWORD=<≥12 chars, non placeholder>
APP_SESSION_SECRET=<≥32 chars, distinct, non placeholder>
```

Local (`.env.local` uniquement, jamais committer) :

```text
APP_PASSWORD=local-dev-password-ok
APP_SESSION_SECRET=local-dev-session-secret-32chars-min
```

Comportement :

- pages protégées sans session → redirect `/login?next=<chemin sûr>` ;
- API sans session → `401` JSON `Cache-Control: no-store` (jamais HTML) ;
- config invalide → API `503`, pages → login ;
- session HMAC TTL 12 h ; rotation password/secret invalide toutes les sessions ;
- HSTS : à activer au reverse-proxy / CDN production uniquement (pas en local) ;
- rate-limit mémoire : best-effort par instance Vercel — pas une garantie distribuée.

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

Flags serveur (off par défaut — voir `studio/.env.example`) :

```text
DIRECTOR_V2_ENABLED=0
DIRECTOR_V2_PERSISTENCE_ENABLED=0
DIRECTOR_V2_WORKER_ENABLED=0
DIRECTOR_V2_PAID_GENERATION_ENABLED=0
DIRECTOR_V2_*_AI_ENABLED=0
DIRECTOR_V2_PAID_AI_ENABLED=0
DIRECTOR_V2_E2E_FAKE_MODE=0
```

Kill switches : worker + paid generation ; AI text directors séparés. Les flags ont propriétaire et date d'expiration.

### Store mémoire fake-merge (Phase 9)

Le `AssetContentPort` process-local n’est **jamais** un stockage durable. Gate `local-fake-delivery` :

- refusé sur Vercel ;
- refusé en `NODE_ENV=production` sans `DIRECTOR_V2_E2E_HARNESS=1` ;
- refusé si `SUPABASE_URL` n’est pas localhost ;
- **incompatible multi-instance** — stockage durable requis avant prod distante.

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

