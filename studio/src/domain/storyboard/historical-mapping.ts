/**
 * Future mapping notes: domain StoryboardProject ↔ historical Storyboard UI.
 *
 * IMPORTANT — single engine rule (VHS-105):
 * - `app/storyboard/page.tsx` remains the only product Storyboard surface.
 * - This domain is the extraction target; it must NOT spawn `/storyboard-v2`
 *   or a parallel orchestrator.
 * - No runtime adapter in this increment (types/docs only).
 */

/**
 * Historical Shot fields (page.tsx) that may later map into domain concepts.
 * Reusable conceptually — not imported from React.
 */
export const HISTORICAL_SHOT_REUSABLE_CONCEPTS = [
  "title",
  "seconds → durationSeconds",
  "line → spokenContent (dialogue fragment)",
  "kind: carousel → productionIntent: carousel",
  "kind: video → productionIntent: image_to_video | talking_head",
  "order in array → order",
] as const;

/**
 * Historical fields incompatible with the domain contract (must stay out of domain).
 */
export const HISTORICAL_SHOT_INCOMPATIBLE_FIELDS = [
  "prompt",
  "model",
  "requestId",
  "videoUrl",
  "audioUrl",
  "syncedUrl",
  "status / syncStatus",
  "startImageUrl (execution asset URL)",
  "error / voiceError / syncError",
] as const;

/**
 * Extraction strategy (future, not implemented here):
 * 1. Keep historical page as UI shell.
 * 2. Persist/approve StoryboardProject revisions via VHS-113.
 * 3. Map StoryboardScene → UI Shot view-model in application layer only.
 * 4. Prompt Director consumes StoryboardScene — never historical Shot prompts.
 * 5. Retire localStorage shot drafts once projections exist — one source of truth.
 */
export const STORYBOARD_EXTRACTION_STRATEGY = {
  singleEngine: true,
  domainOwnsContract: true,
  historicalPageOwnsUiUntilExtracted: true,
  forbidParallelRoute: "/storyboard-v2",
} as const;
