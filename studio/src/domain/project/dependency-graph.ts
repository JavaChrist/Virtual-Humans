/**
 * Canonical artifact dependency graph (VHS-126) — pure domain, single source of truth.
 * Downstream invalidation and restart points must use this module — not route-local copies.
 */

import { isArtifactType, type ArtifactType } from "./artifact-types";
import { ProjectDomainError } from "./errors";

/**
 * Direct children of each artifact type in the /director pipeline.
 * `scene_package` is omitted from the active chain (set is the atomic unit).
 */
export const ARTIFACT_CHILDREN: Readonly<Record<ArtifactType, readonly ArtifactType[]>> =
  Object.freeze({
    video_project_brief: ["marketing_plan"],
    marketing_plan: ["creative_concept"],
    creative_concept: ["video_script"],
    video_script: ["visual_direction"],
    visual_direction: ["storyboard_project"],
    storyboard_project: ["scene_package_set"],
    scene_package: [],
    scene_package_set: ["generation_plan"],
    generation_plan: ["production_result"],
    production_result: ["quality_report"],
    quality_report: ["merge_plan"],
    merge_plan: ["export_package"],
    export_package: [],
  });

/** Provenance JSON keys that link an artifact value to an upstream artifact id. */
export const PROVENANCE_KEYS: Readonly<
  Partial<Record<ArtifactType, readonly string[]>>
> = Object.freeze({
  marketing_plan: ["briefRevisionId"],
  creative_concept: ["marketingPlanRevisionId"],
  video_script: ["creativeConceptRevisionId", "marketingPlanRevisionId"],
  visual_direction: ["videoScriptRevisionId", "creativeConceptRevisionId"],
  storyboard_project: ["videoScriptRevisionId", "visualDirectionRevisionId"],
  scene_package_set: ["storyboardRevisionId"],
  generation_plan: ["storyboardRevisionId"],
  production_result: ["generationPlanRevisionId"],
  merge_plan: ["productionResultRevisionId", "storyboardRevisionId"],
  export_package: ["productionResultRevisionId"],
});

/** Pipeline order from root to leaf (for deterministic cascade). */
export const PIPELINE_ORDER: readonly ArtifactType[] = Object.freeze([
  "video_project_brief",
  "marketing_plan",
  "creative_concept",
  "video_script",
  "visual_direction",
  "storyboard_project",
  "scene_package_set",
  "generation_plan",
  "production_result",
  "quality_report",
  "merge_plan",
  "export_package",
]);

/** First director step to re-run after a given artifact type is revised. */
export const RESTART_DIRECTOR_BY_TYPE: Readonly<
  Partial<Record<ArtifactType, ArtifactType>>
> = Object.freeze({
  video_project_brief: "marketing_plan",
  marketing_plan: "creative_concept",
  creative_concept: "video_script",
  video_script: "visual_direction",
  visual_direction: "storyboard_project",
  storyboard_project: "scene_package_set",
  scene_package_set: "generation_plan",
  generation_plan: "generation_plan",
});

export function assertArtifactType(type: string): ArtifactType {
  if (!isArtifactType(type)) {
    throw new ProjectDomainError("incompatible_artifact", `Type d'artifact inconnu: ${type}`);
  }
  return type;
}

/** All transitive descendants of `root` (excluding root), deterministic pipeline order. */
export function descendantsOf(root: ArtifactType): ArtifactType[] {
  const out: ArtifactType[] = [];
  const seen = new Set<ArtifactType>();
  const queue: ArtifactType[] = [...ARTIFACT_CHILDREN[root]];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    queue.push(...ARTIFACT_CHILDREN[next]);
  }
  return PIPELINE_ORDER.filter((t) => seen.has(t));
}

/**
 * Determine restart artifact type after revising `changed`.
 * Brief revise → marketing_plan (relancer Marketing).
 */
export function determineRestartPoint(changed: ArtifactType): ArtifactType {
  const point = RESTART_DIRECTOR_BY_TYPE[changed];
  if (!point) {
    throw new ProjectDomainError(
      "invalid_argument",
      `Aucun point de reprise pour ${changed}.`,
    );
  }
  return point;
}

/**
 * Extract upstream artifact ids referenced by a persisted artifact value.
 * Supports nested packages[].storyboardRevisionId and scenePackageRevisionIds[].
 */
export function extractProvenanceIds(
  artifactType: ArtifactType,
  value: unknown,
): string[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as Record<string, unknown>;
  const ids = new Set<string>();
  const keys = PROVENANCE_KEYS[artifactType] ?? [];
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) ids.add(v);
  }
  if (artifactType === "generation_plan" && Array.isArray(obj.scenePackageRevisionIds)) {
    for (const id of obj.scenePackageRevisionIds) {
      if (typeof id === "string" && id.trim()) ids.add(id);
    }
  }
  if (artifactType === "scene_package_set" && Array.isArray(obj.packages)) {
    for (const pkg of obj.packages) {
      if (pkg && typeof pkg === "object") {
        const sid = (pkg as { storyboardRevisionId?: unknown }).storyboardRevisionId;
        if (typeof sid === "string" && sid.trim()) ids.add(sid);
      }
    }
  }
  if (artifactType === "export_package" && obj.manifest && typeof obj.manifest === "object") {
    const m = obj.manifest as Record<string, unknown>;
    for (const key of ["generationPlanRevisionId", "storyboardRevisionId", "productionRunId"]) {
      const v = m[key];
      if (typeof v === "string" && v.trim() && key !== "productionRunId") ids.add(v);
    }
  }
  return [...ids];
}

/**
 * Whether an artifact value depends on any of the given upstream artifact ids
 * (exact provenance match — independent branches are not marked).
 */
export function dependsOnAny(
  artifactType: ArtifactType,
  value: unknown,
  upstreamArtifactIds: ReadonlySet<string>,
): boolean {
  if (upstreamArtifactIds.size === 0) return false;
  // quality_report has no provenance keys — stale only via soft link from production_result delivery
  if (artifactType === "quality_report") return false;
  return extractProvenanceIds(artifactType, value).some((id) => upstreamArtifactIds.has(id));
}
