/**
 * Deterministic IDs for router artifacts (VHS-108).
 * No timestamps, prompts, secrets, or random entropy.
 */

export function stepId(parts: {
  sceneId: string;
  strategyId: string;
  order: number;
  profile: string;
}): string {
  return `step:${parts.sceneId}:${parts.strategyId}:${parts.order}:${parts.profile}`;
}

export function fallbackId(parts: {
  stepId: string;
  order: 1 | 2;
  providerId: string;
  modelId: string;
}): string {
  return `fb:${parts.stepId}:${parts.order}:${parts.providerId}:${parts.modelId}`;
}

export function estimateId(parts: {
  stepId: string;
  providerId: string;
  modelId: string;
  role: "primary" | "fallback1" | "fallback2";
}): string {
  return `est:${parts.role}:${parts.stepId}:${parts.providerId}:${parts.modelId}`;
}

export function combinationKey(
  strategyId: string,
  picks: ReadonlyArray<{ providerId: string; modelId: string }>,
): string {
  return `${strategyId}|${picks.map((p) => `${p.providerId}::${p.modelId}`).join("+")}`;
}
