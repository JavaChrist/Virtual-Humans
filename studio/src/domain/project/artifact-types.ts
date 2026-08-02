/** Canonical artifact types for the V2 director pipeline. */
export const ArtifactTypeValues = [
  "video_project_brief",
  "marketing_plan",
  "creative_concept",
  "video_script",
  "visual_direction",
  "storyboard_project",
  "scene_package",
  "generation_plan",
  "production_result",
] as const;

export type ArtifactType = (typeof ArtifactTypeValues)[number];

export function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === "string" && (ArtifactTypeValues as readonly string[]).includes(value);
}

/** Artifacts that must be approved before production can start. */
export const REQUIRED_FOR_PRODUCTION: readonly ArtifactType[] = [
  "video_project_brief",
  "storyboard_project",
  "generation_plan",
] as const;
