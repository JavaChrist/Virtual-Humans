/**
 * Pure helpers for Creative paid-execute confirmation (VHS-8F-A).
 * Values must come from the current dry-run — never hard-coded model knobs.
 */

export type CreativeConfirmDryRun = {
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  estimatedCostMinor?: number;
  currency?: string;
  confidence?: string;
  briefRevision: number;
  marketingPlanRevision: number;
  promptVersion: string;
  schemaVersion?: string;
  durationSeconds?: number;
  maxBeats?: number;
};

export function buildCreativeExecuteConfirmMessage(dry: CreativeConfirmDryRun): string {
  const estimate =
    dry.estimatedCostMinor != null
      ? `Estimation : ${(dry.estimatedCostMinor / 100).toFixed(2)} ${dry.currency ?? "USD"} (confiance ${dry.confidence ?? "unknown"}).`
      : "Estimation : indisponible — l’exécution reste bloquée tant que la tarification n’est pas configurée.";

  const lines = [
    "Cet appel est payant.",
    `Modèle : ${dry.model}`,
    `Reasoning : ${dry.reasoningEffort}`,
    `max_output_tokens : ${dry.maxOutputTokens}`,
    estimate,
    `Prompt : ${dry.promptVersion}`,
  ];
  if (dry.schemaVersion) {
    lines.push(`Schema : ${dry.schemaVersion}`);
  }
  if (dry.durationSeconds != null && dry.maxBeats != null) {
    lines.push(`Durée : ${dry.durationSeconds}s · maxBeats : ${dry.maxBeats}`);
  }
  lines.push(
    `Inputs : Brief rev. ${dry.briefRevision} · Marketing Plan rev. ${dry.marketingPlanRevision}`,
    "Le brief et le Marketing Plan actifs ne seront pas modifiés.",
    "Aucun retry automatique.",
  );
  return lines.join("\n");
}
