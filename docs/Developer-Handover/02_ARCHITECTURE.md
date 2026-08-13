# 02 — Architecture V2 figée

**Classe :** `CURRENT`

> Contrats et frontières toujours normatifs. Chemins applicatifs sous `studio/src/…`.
> Maturité ops : texte Marketing→Storyboard prouvé réel ; Prompt→média = fakes / 11A.
> Extension majeure planifiée : capability `video.motion_transfer` —
> `ARCHITECTURE_READY_FOR_IMPLEMENTATION` (`59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md`) ;
> `RUNTIME_NOT_IMPLEMENTED_YET` · `PROVIDER_NOT_SELECTED_YET`.
> État courant : `00_README.md`, `BACKLOG_V2.md`.

## Vue d'ensemble

```text
Presentation          /director + studios avancés
Application           workflow, commandes, projections, permissions
Domain                objets métier + Directeurs + règles
Orchestration         Model Router + Production Director
Execution             Generation Engine + adapters
Infrastructure        Providers + Supabase + storage + queue + telemetry
```

Les dépendances pointent vers le domaine. Le domaine ne dépend ni de React, ni de Supabase, ni d'un SDK fournisseur.

### Extension Motion / Performance Transfer

- Architecture : [`59_…`](./59_MOTION_PERFORMANCE_TRANSFER_ARCHITECTURE.md)
- **MT-001 IMPLEMENTED** — contrats domaine `studio/src/domain/motion/` ([`60_…`](./60_MT001_MOTION_TRANSFER_DOMAIN_CONTRACTS.md)) · Gate MT-1 **PASS**
- MT-002+ (Registry/Router/Engine/adapter) : **NOT STARTED**
- Runtime capability : **still OFF / unavailable** · `PROVIDER_NOT_SELECTED_YET`

## Chaîne contractuelle

| Étape | Consomme | Produit | Ne fait jamais |
|---|---|---|---|
| Marketing | `VideoProjectBrief` | `MarketingPlan` | écrire le script |
| Creative | `MarketingPlan` | `CreativeConcept` | choisir un modèle |
| Script | `CreativeConcept` | `VideoScript` | mettre en scène |
| Art | `VideoScript` | `VisualDirection` | écrire des prompts |
| Storyboard | `VisualDirection` | `StoryboardProject` | appeler un provider |
| Prompt | `StoryboardProject` | `ScenePackage[]` | router |
| Router | `ScenePackage[]` | `GenerationPlan` | exécuter |
| Production | `GenerationPlan` | `ProductionResult` | inventer le contenu |

Chaque commande peut également recevoir le contexte déjà produit, mais sa décision reste limitée à sa responsabilité. Les objets précédents ne sont jamais mutés : une correction crée une nouvelle révision.

## Identité et versionnement

Tous les objets persistés contiennent `id`, `projectId`, `schemaVersion`, `revision`, `createdAt`, `createdBy` et `correlationId`. Les identifiants sont stables ; les sorties générées sont append-only, puis désignées comme révision active.

## Ports principaux

```ts
interface Director<I, O> { run(input: I, ctx: RunContext): Promise<O> }
interface ProjectRepository { load(id: string): Promise<VideoProject>; saveRevision(value: DomainArtifact): Promise<void> }
interface JobQueue { enqueue(command: ProductionCommand): Promise<JobRef> }
interface ProviderAdapter { capabilities(): ModelCapabilities; execute(step: GenerationStep): Promise<ProviderResult> }
```

## États

Projet : `draft → planning → awaiting_approval → approved → producing → completed`, avec `failed`, `cancelled`, `archived` comme sorties contrôlées.

Scène : `pending → ready → queued → generating → validating → completed`, avec `retryable_failed`, `failed`, `cancelled`, `skipped`.

Les transitions sont atomiques, autorisées explicitement et protégées contre les mises à jour concurrentes.

## Idempotence et reprise

Chaque étape utilise une clé `projectId:revision:sceneId:stepId:attempt`. Relancer la même commande retourne le résultat connu ou reprend l'étape incomplète. Les webhooks sont authentifiés, dédupliqués et stockés avant traitement.

## Architecture événementielle

Événements minimaux : `artifact.created`, `plan.approved`, `scene.queued`, `step.started`, `step.completed`, `step.failed`, `budget.exceeded`, `project.completed`. Ils servent à l'UI et à l'observabilité, jamais à contourner les invariants du domaine.

## Sécurité

- validation serveur de toutes les entrées ;
- RLS Supabase par propriétaire/espace ;
- URLs signées à durée courte ;
- secrets uniquement côté serveur ;
- quotas et rate limits ;
- redaction des prompts, PII et clés dans les logs ;
- vérification de signature des callbacks.

## Média image 11A (ops)

Le provider image produit un visuel **sans texte**. Le copy marketing (title / subtitle / CTA / legal) est un `ImageTextOverlaySpec` composé déterministement après ingest privé (`111_`). Runtime overlay **WIRED_DISABLED**. Human Review obligatoire. L’asset smoke rejeté n’est pas recyclé comme final.

## Arborescence cible indicative

```text
src/domain/{brief,marketing,creative,script,art,storyboard,prompt,routing,production}
src/application/{workflows,commands,queries}
src/infrastructure/{db,storage,queue,providers,telemetry}
src/app/director
src/app/api
```

L'audit du dépôt peut adapter les chemins, jamais les frontières.

