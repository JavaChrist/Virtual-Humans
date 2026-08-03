/**
 * Narrative transition intents (VHS-105).
 * No provider params, no merge/execution semantics.
 */

export const TransitionTypeValues = [
  "cut",
  "fade",
  "cross_fade",
  "slide",
  "zoom",
  "match_cut",
  "none",
] as const;
export type TransitionType = (typeof TransitionTypeValues)[number];

/**
 * Timing convention (documented):
 * - Scene `durationSeconds` sum exactly to the project target.
 * - Optional `durationSeconds` on a transition is editorial metadata only
 *   (hold / overlap hint), bounded, and MUST NOT be added on top of the
 *   scene sum. Default 0. Last scene must use type `none`.
 */
export const TRANSITION_DURATION_MAX_SECONDS = 1;

export type StoryboardTransition = {
  type: TransitionType;
  /** Editorial hint only — not added to total scene duration. */
  durationSeconds?: number;
  justification?: string;
};

export function defaultTransitionForScene(isLast: boolean): StoryboardTransition {
  return isLast ? { type: "none", durationSeconds: 0 } : { type: "cut", durationSeconds: 0 };
}
