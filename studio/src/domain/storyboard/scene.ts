/**
 * Production scene contracts (VHS-105).
 * Distinct from narrative script segments and from historical Shot UI types.
 */

export const ScenePurposeValues = [
  "hook",
  "problem",
  "presentation",
  "proof",
  "product",
  "transition",
  "cta",
  "outro",
] as const;
export type ScenePurpose = (typeof ScenePurposeValues)[number];

/**
 * Maps script segment purpose → default storyboard scene purpose.
 * Storyboard may refine to product/outro when splitting, never invent narration.
 */
export const SCRIPT_PURPOSE_TO_SCENE: Record<
  "hook" | "problem" | "presentation" | "proof" | "transition" | "cta",
  ScenePurpose
> = {
  hook: "hook",
  problem: "problem",
  presentation: "presentation",
  proof: "proof",
  transition: "transition",
  cta: "cta",
};

export const ProductionIntentValues = [
  "talking_head",
  "image_to_video",
  "b_roll",
  "product_demo",
  "carousel",
  "tutorial",
  "voice_over_visual",
  "text_motion",
  "transition",
] as const;
export type ProductionIntent = (typeof ProductionIntentValues)[number];

export const SceneReferenceKindValues = [
  "character",
  "outfit",
  "expression",
  "pose",
  "product",
  "background",
  "brand",
  "screen",
  "voice",
] as const;
export type SceneReferenceKind = (typeof SceneReferenceKindValues)[number];

export type SceneSpokenContent =
  | {
      kind: "dialogue";
      sourceText: string;
      characterId?: string;
    }
  | {
      kind: "voice_over";
      sourceText: string;
    }
  | {
      kind: "none";
    };

export type SceneReference = {
  id: string;
  kind: SceneReferenceKind;
  sourceId: string;
  role: string;
  required: boolean;
};

export type StoryboardScene = {
  id: string;
  order: number;
  title: string;
  purpose: ScenePurpose;
  durationSeconds: number;
  scriptSegmentId: string;
  visualDirectionSegmentId: string;
  productionIntent: ProductionIntent;
  spokenContent: SceneSpokenContent;
  screenText?: string;
  references: SceneReference[];
  transition: import("./transitions").StoryboardTransition;
  continuityKeys: string[];
};
