# 15 — Generation Engine

**Classe :** `CURRENT`

### État opérationnel (11 août 2026)

| | |
|---|---|
| Ports / adapters | Code réel OpenAI image, fal, ElevenLabs **présent** |
| Wiring `/director` | **fakes** par défaut (VHS-124) ; allowlist OpenAI image **WIRED_DISABLED** (`102_`) ; prompt image **no-text** v2 (`111_`) ; variant image sans copy overlay (`113_`) |
| Legacy | `/api/generate/*` hors pipeline Director (ne prouve pas `production_jobs`) |
| Kill switches | `PAID_GENERATION` ∧ `WORKER` requis pour exécution payante |
| Motion Transfer | Dry-run Engine **MT-004** (`63_`) … fal adapter **MT-007B** (`67_`) + worker polling **MT-008** (`68_`, fake E2E, flags OFF) — paid execution unavailable |

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

Le chemin image 11A n’envoie pas les chaînes overlay au provider (`phase-11a-image-prompt-v2`). Le variant image est uniquement visuel (`113_`). La typographie est un dérivé déterministe post-ingest (`111_`). Runtime Production **`245bea2`** (1.1.0). Preuve composeur **1.2.0** = `d395ec7`. Execution (`126_`) / HR (`127_`) : composed 1.2.0 `49284892…` **HUMAN_APPROVED** inactif · checksum `9ac484b7…`. Execution (`118_`) : composed `6a2beca9…` REJECT glyphes. Execution (`122_`) / HR (`123_`) : composé 1.1.0 `4429654f…` REJECT layout · parent `7832765d…` conservé.

## Taxonomie d'erreurs

`invalid_input`, `unauthorized`, `quota_exceeded`, `rate_limited`, `provider_unavailable`, `timeout`, `content_rejected`, `output_invalid`, `cancelled`, `unknown`. Chaque erreur indique `retryable` et conserve un message public séparé du diagnostic interne.

## Registre de capacités

Versionné et configurable : types d'entrée/sortie, ratios, durées, audio, dialogue, références, nombre de personnages, régions, limites, disponibilité, prix, latence et scores observés. Un adaptateur ne s'annonce prêt qu'après self-check.

## Dry-run

Valide transformation, assets, estimation, capacité, autorisation et sortie simulée sans soumettre de job payant. Le dry-run doit traverser la même logique hors appel externe.

## Tests de contrat

Chaque adaptateur passe la même suite : mapping, estimate, submit, polling, webhook, idempotence, timeout, erreur normalisée, annulation, output corrompu et redaction des logs.

