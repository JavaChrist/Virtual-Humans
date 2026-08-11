# 15 — Generation Engine

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Ports / adapters | Code réel OpenAI image, fal, ElevenLabs **présent** |
| Wiring `/director` | **fakes only** (VHS-124) |
| Legacy | `/api/generate/*` hors pipeline Director (ne prouve pas `production_jobs`) |
| Kill switches | `PAID_GENERATION` ∧ `WORKER` requis pour exécution payante |
| Motion Transfer | Dry-run Engine **MT-004 IMPLEMENTED** (`63_`, `runMotionTransferGenerationDryRun`, `providerCalled=false`) ; provider port = MT-006 **NOT STARTED** — paid execution unavailable |

## Mission

Exécuter une `GenerationStep` technique via un adaptateur et retourner un résultat normalisé. Le moteur ne choisit ni provider, ni fallback, ni contenu.

## Port d'exécution

```ts
interface GenerationEngine {
  execute(step: GenerationStep, ctx: ExecutionContext): Promise<GenerationResult>;
  cancel(job: ExternalJobRef): Promise<CancelResult>;
  poll(job: ExternalJobRef): Promise<GenerationResult>;
}
interface ProviderAdapter {
  capabilities(): ModelCapabilities;
  estimate(input: ProviderInput): Promise<Estimate>;
  submit(input: ProviderInput, key: string): Promise<ExternalJobRef>;
  poll(ref: ExternalJobRef): Promise<ProviderResult>;
  cancel(ref: ExternalJobRef): Promise<void>;
  verifyWebhook(request: Request): Promise<VerifiedEvent>;
}
```

## Responsabilités

Résoudre l'adaptateur autorisé, transformer l'entrée canonique, transférer les assets par URLs signées, appliquer timeout, normaliser erreurs et résultats, persister références externes, émettre métriques et nettoyer les fichiers temporaires.

## Taxonomie d'erreurs

`invalid_input`, `unauthorized`, `quota_exceeded`, `rate_limited`, `provider_unavailable`, `timeout`, `content_rejected`, `output_invalid`, `cancelled`, `unknown`. Chaque erreur indique `retryable` et conserve un message public séparé du diagnostic interne.

## Registre de capacités

Versionné et configurable : types d'entrée/sortie, ratios, durées, audio, dialogue, références, nombre de personnages, régions, limites, disponibilité, prix, latence et scores observés. Un adaptateur ne s'annonce prêt qu'après self-check.

## Dry-run

Valide transformation, assets, estimation, capacité, autorisation et sortie simulée sans soumettre de job payant. Le dry-run doit traverser la même logique hors appel externe.

## Tests de contrat

Chaque adaptateur passe la même suite : mapping, estimate, submit, polling, webhook, idempotence, timeout, erreur normalisée, annulation, output corrompu et redaction des logs.

