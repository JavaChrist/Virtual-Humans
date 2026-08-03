/**
 * Prompt references — storyboard-sourced only (VHS-106).
 */

import type { SceneReference } from "@/domain/storyboard";

export type PromptReference = {
  id: string;
  kind:
    | "character"
    | "outfit"
    | "expression"
    | "pose"
    | "product"
    | "background"
    | "brand"
    | "screen"
    | "voice";
  sourceId: string;
  role: string;
  required: boolean;
  checksum?: string;
};

export function mapStoryboardReferences(
  refs: SceneReference[],
): PromptReference[] {
  const seen = new Set<string>();
  const out: PromptReference[] = [];
  for (const r of refs) {
    const key = `${r.kind}:${r.sourceId}:${r.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (/[\\/](?:Users|home)|https?:\/\/|signed[=_]/i.test(r.sourceId + r.role)) {
      continue; // filtered; validation will flag if required
    }
    out.push({
      id: r.id,
      kind: r.kind,
      sourceId: r.sourceId,
      role: r.role,
      required: r.required,
    });
  }
  return out;
}
