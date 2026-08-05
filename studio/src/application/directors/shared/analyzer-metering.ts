/**
 * Shared analyzer metering contract for text Directors (Marketing / Creative / …).
 * Never invents amounts; never carries prompts or raw provider bodies.
 */

export type AnalyzerUsage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export type AnalyzerMetering = {
  usage?: AnalyzerUsage;
  cost:
    | {
        status: "known";
        amountMinor: number;
        currency: "USD";
        pricingVersion?: string;
      }
    | { status: "unknown"; reason?: string };
};

export type AnalyzerOutcome<TCandidate> = {
  candidate: TCandidate;
  metering?: AnalyzerMetering;
};

export function meteringKnownCostMinor(
  metering: AnalyzerMetering | undefined
): number | undefined {
  return metering?.cost.status === "known"
    ? metering.cost.amountMinor
    : undefined;
}

export function meteringUsageRecord(
  metering: AnalyzerMetering | undefined
): Record<string, unknown> | undefined {
  return metering?.usage ? { ...metering.usage } : undefined;
}

export function meteringCostStatusForFail(
  metering: AnalyzerMetering | undefined
): string | undefined {
  const known = meteringKnownCostMinor(metering);
  if (known != null) return "committed";
  if (metering?.usage) return "unknown";
  return undefined;
}
