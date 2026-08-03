import assert from "node:assert/strict";
import { test } from "node:test";
import { createArtifactMetadata } from "@/domain/shared";
import {
  buildProductionResult,
  createProductionRun,
  DEFAULT_PRODUCTION_POLICY,
  redactAsset,
  withRunUpdate,
} from "../index";
import { makePlan } from "./fixtures";

const AT = "2026-08-03T12:00:00.000Z";
const DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function runWithInlineAsset() {
  const plan = makePlan();
  let run = createProductionRun({
    id: "run-1",
    projectId: plan.projectId,
    plan,
    policy: DEFAULT_PRODUCTION_POLICY,
    createdAt: AT,
    correlationId: "c1",
  });
  const asset = {
    id: "a1",
    kind: "video" as const,
    mimeType: "video/mp4",
    source: { kind: "inline_data_url" as const, dataUrl: DATA_URL },
    durationSeconds: 5,
  };
  const scene = run.scenes[0]!;
  const step = scene.steps[0]!;
  run = withRunUpdate(
    run,
    {
      status: "completed",
      scenes: [
        {
          ...scene,
          status: "completed",
          outputAssets: [asset],
          steps: [
            {
              ...step,
              status: "completed",
              outputAssets: [asset],
            },
          ],
        },
        ...run.scenes.slice(1),
      ],
    },
    AT,
  );
  return run;
}

test("redactAsset — inline_data_url becomes [redacted]", () => {
  const redacted = redactAsset({
    id: "a1",
    kind: "video",
    mimeType: "video/mp4",
    source: { kind: "inline_data_url", dataUrl: DATA_URL },
  });
  assert.equal(redacted.source.kind, "inline_data_url");
  if (redacted.source.kind === "inline_data_url") {
    assert.equal(redacted.source.dataUrl, "[redacted]");
  }
});

test("buildProductionResult — default redactSources hides data URLs", () => {
  const meta = createArtifactMetadata({
    id: "pr-1",
    projectId: makePlan().projectId,
    createdBy: "tester",
    correlationId: "c1",
    createdAt: AT,
  });
  const result = buildProductionResult({
    run: runWithInlineAsset(),
    meta,
    completedAt: AT,
    status: "completed",
  });
  const src = result.scenes[0]!.outputAssets[0]!.source;
  assert.equal(src.kind, "inline_data_url");
  if (src.kind === "inline_data_url") {
    assert.equal(src.dataUrl, "[redacted]");
    assert.equal(src.dataUrl.includes("base64"), false);
  }
});

test("buildProductionResult — redactSources:false keeps data URL for server QC", () => {
  const meta = createArtifactMetadata({
    id: "pr-2",
    projectId: makePlan().projectId,
    createdBy: "tester",
    correlationId: "c1",
    createdAt: AT,
  });
  const result = buildProductionResult({
    run: runWithInlineAsset(),
    meta,
    completedAt: AT,
    status: "completed",
    redactSources: false,
  });
  const src = result.scenes[0]!.outputAssets[0]!.source;
  assert.equal(src.kind === "inline_data_url" && src.dataUrl === DATA_URL, true);
});
