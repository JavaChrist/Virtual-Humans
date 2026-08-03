import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARTIFACT_CHILDREN,
  PIPELINE_ORDER,
  dependsOnAny,
  descendantsOf,
  determineRestartPoint,
  extractProvenanceIds,
} from "../dependency-graph";

test("descendantsOf brief covers full pipeline", () => {
  const d = descendantsOf("video_project_brief");
  assert.deepEqual(d, [
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
});

test("descendantsOf storyboard starts at scene_package_set", () => {
  assert.deepEqual(descendantsOf("storyboard_project"), [
    "scene_package_set",
    "generation_plan",
    "production_result",
    "quality_report",
    "merge_plan",
    "export_package",
  ]);
});

test("determineRestartPoint brief → marketing", () => {
  assert.equal(determineRestartPoint("video_project_brief"), "marketing_plan");
  assert.equal(determineRestartPoint("storyboard_project"), "scene_package_set");
  assert.equal(determineRestartPoint("scene_package_set"), "generation_plan");
});

test("children graph is acyclic and covers pipeline order", () => {
  for (const t of PIPELINE_ORDER) {
    assert.ok(ARTIFACT_CHILDREN[t] !== undefined);
  }
});

test("dependsOnAny — exact provenance only", () => {
  const marketing = { briefRevisionId: "brief-old" };
  assert.equal(dependsOnAny("marketing_plan", marketing, new Set(["brief-old"])), true);
  assert.equal(dependsOnAny("marketing_plan", marketing, new Set(["brief-new"])), false);
  assert.equal(
    dependsOnAny("creative_concept", { marketingPlanRevisionId: "mkt-1" }, new Set(["mkt-1"])),
    true,
  );
  // Independent branch
  assert.equal(
    dependsOnAny("marketing_plan", { briefRevisionId: "other-branch" }, new Set(["brief-old"])),
    false,
  );
});

test("extractProvenanceIds generation_plan scene packages", () => {
  const ids = extractProvenanceIds("generation_plan", {
    storyboardRevisionId: "sb-1",
    scenePackageRevisionIds: ["pkg-a", "pkg-b"],
  });
  assert.ok(ids.includes("sb-1"));
  assert.ok(ids.includes("pkg-a"));
  assert.ok(ids.includes("pkg-b"));
});

test("quality_report has no provenance keys — never dependsOnAny", () => {
  assert.equal(dependsOnAny("quality_report", { status: "accepted" }, new Set(["pr-1"])), false);
});
