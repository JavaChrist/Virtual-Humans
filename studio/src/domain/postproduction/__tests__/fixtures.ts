import { money } from "@/domain/cost";
import type { ScenePackage } from "@/domain/prompt";
import type {
  ProductionResult,
  ProductionResultV1,
  SceneProductionResult,
} from "@/domain/production";
import {
  PRODUCTION_RESULT_ARTIFACT_TYPE,
  PRODUCTION_RESULT_SCHEMA_VERSION_V1,
} from "@/domain/production";
import type { StoryboardProject } from "@/domain/storyboard";
import { makeMinimalPackage } from "@/domain/generation/__tests__/fixtures";

export const AT = "2026-08-02T12:00:00.000Z";
export const EXPIRES = "2026-12-01T00:00:00.000Z";

export function makeVideoAsset(
  id: string,
  over: Partial<import("@/domain/generation").GeneratedAsset> = {}
) {
  return {
    id,
    kind: "video" as const,
    mimeType: "video/mp4",
    source: {
      kind: "temporary_external" as const,
      url: `https://cdn.example.com/${id}.mp4`,
      expiresAt: EXPIRES,
    },
    durationSeconds: 5,
    width: 1080,
    height: 1920,
    sizeBytes: 1024,
    ...over,
  };
}

export function makeSceneResult(
  sceneId: string,
  order: number,
  over: Partial<SceneProductionResult> = {}
): SceneProductionResult {
  const asset = makeVideoAsset(`asset-${sceneId}`);
  return {
    sceneId,
    sceneOrder: order,
    status: "completed",
    steps: [
      {
        stepId: `step-${sceneId}`,
        order: 1,
        status: "completed",
        attempts: [
          {
            id: `att-${sceneId}`,
            stepId: `step-${sceneId}`,
            attemptNumber: 1,
            kind: "primary",
            providerId: "fal",
            modelId: "fal-ai/kling-video/v2/master/text-to-video",
            idempotencyKey: `proj-1:plan-1:${sceneId}:step-${sceneId}:1`,
            status: "completed",
            estimate: {
              id: "est",
              projectId: "proj-1",
              schemaVersion: "1.0.0",
              revision: 1,
              createdAt: AT,
              createdBy: "t",
              correlationId: "c",
              action: "video",
              quantity: 5,
              unit: "seconds",
              unitCost: money(10, "USD"),
              subtotal: money(50, "USD"),
              margin: money(0, "USD"),
              total: money(50, "USD"),
              confidence: "medium",
              pricingVersion: "t",
              assumptions: [],
            },
            output: asset,
            completedAt: AT,
          },
        ],
        outputAssets: [asset],
        estimatedCost: money(50, "USD"),
        committedCost: money(50, "USD"),
        warnings: [],
      },
    ],
    outputAssets: [asset],
    estimatedCost: money(50, "USD"),
    committedCost: money(50, "USD"),
    warnings: [],
    ...over,
  };
}

export function makeProductionResultV1(
  over: Partial<ProductionResultV1> = {}
): ProductionResultV1 {
  const scenes = over.scenes ?? [
    makeSceneResult("sc-hook", 1),
    makeSceneResult("sc-problem", 2),
    makeSceneResult("sc-proof", 3),
    makeSceneResult("sc-cta", 4),
  ];
  return {
    id: "pr-1",
    projectId: "proj-1",
    schemaVersion: PRODUCTION_RESULT_SCHEMA_VERSION_V1,
    revision: 1,
    createdAt: AT,
    createdBy: "tester",
    correlationId: "corr-1",
    artifactType: PRODUCTION_RESULT_ARTIFACT_TYPE,
    generationPlanRevisionId: "plan-1",
    status: "completed",
    scenes,
    estimatedCost: money(200, "USD"),
    committedCost: money(200, "USD"),
    releasedCost: money(0, "USD"),
    currency: "USD",
    startedAt: AT,
    completedAt: AT,
    manifest: {
      planRevisionId: "plan-1",
      runId: "run-1",
      policyVersion: "production-policy.v1",
      scenes: scenes.map((s) => ({
        sceneId: s.sceneId,
        sceneOrder: s.sceneOrder,
        status: s.status,
        stepIds: s.steps.map((st) => st.stepId),
        committedAmountMinor: s.committedCost.amountMinor,
        estimatedAmountMinor: s.estimatedCost.amountMinor,
      })),
      attempts: [],
      generatedAt: AT,
    },
    warnings: [],
    ...over,
  };
}

export function makeStoryboard(over: Partial<StoryboardProject> = {}): StoryboardProject {
  const scenes = [
    {
      id: "sc-hook",
      order: 1,
      title: "Hook",
      purpose: "hook" as const,
      durationSeconds: 5,
      scriptSegmentId: "seg-1",
      visualDirectionSegmentId: "vd-1",
      productionIntent: "b_roll" as const,
      spokenContent: { kind: "none" as const },
      references: [],
      transition: { type: "cut" as const, durationSeconds: 0 },
      continuityKeys: [],
    },
    {
      id: "sc-problem",
      order: 2,
      title: "Problem",
      purpose: "problem" as const,
      durationSeconds: 5,
      scriptSegmentId: "seg-2",
      visualDirectionSegmentId: "vd-2",
      productionIntent: "b_roll" as const,
      spokenContent: { kind: "none" as const },
      references: [],
      transition: { type: "cut" as const, durationSeconds: 0 },
      continuityKeys: [],
    },
    {
      id: "sc-proof",
      order: 3,
      title: "Proof",
      purpose: "proof" as const,
      durationSeconds: 5,
      scriptSegmentId: "seg-3",
      visualDirectionSegmentId: "vd-3",
      productionIntent: "b_roll" as const,
      spokenContent: { kind: "none" as const },
      references: [],
      transition: { type: "cut" as const, durationSeconds: 0 },
      continuityKeys: [],
    },
    {
      id: "sc-cta",
      order: 4,
      title: "CTA",
      purpose: "cta" as const,
      durationSeconds: 5,
      scriptSegmentId: "seg-4",
      visualDirectionSegmentId: "vd-4",
      productionIntent: "b_roll" as const,
      spokenContent: { kind: "none" as const },
      references: [],
      transition: { type: "none" as const, durationSeconds: 0 },
      continuityKeys: [],
    },
  ];
  return {
    id: "sb-1",
    projectId: "proj-1",
    schemaVersion: "1.0.0",
    revision: 1,
    createdAt: AT,
    createdBy: "tester",
    correlationId: "corr-1",
    artifactType: "storyboard_project",
    videoScriptRevisionId: "script-1",
    visualDirectionRevisionId: "vd-1",
    title: "Test",
    durationSeconds: 20,
    aspectRatio: "9:16",
    scenes,
    timing: {
      targetDurationSeconds: 20,
      totalSceneDurationSeconds: 20,
      differenceSeconds: 0,
      precisionSeconds: 0.01,
      status: "exact",
      sceneTimings: scenes.map((s) => ({
        sceneId: s.id,
        order: s.order,
        durationSeconds: s.durationSeconds,
        scriptSegmentId: s.scriptSegmentId,
        minimumSpokenSeconds: 0,
      })),
      warnings: [],
    },
    continuity: {
      projectedRuleIds: [],
      sceneKeys: scenes.map((s) => ({ sceneId: s.id, keys: s.continuityKeys })),
      intentionalBreaks: [],
      warnings: [],
    },
    assumptions: [],
    evidence: [],
    rationale: { summary: "t", decisions: [] },
    ...over,
  } as StoryboardProject;
}

export function makePackages(withPostText = false): ScenePackage[] {
  return ["sc-hook", "sc-problem", "sc-proof", "sc-cta"].map((id, i) =>
    makeMinimalPackage({
      sceneId: id,
      sceneOrder: i + 1,
      storyboardRevisionId: "sb-1",
      composition: {
        subjectPosition: "center",
        lookDirection: "camera",
        visualHierarchy: "subject",
        textSafeArea: "standard",
      },
      ...(withPostText && id === "sc-cta"
        ? {
            screenText: {
              text: "Achetez maintenant",
              renderMode: "post_production" as const,
              safeAreaRequired: true,
            },
          }
        : {}),
    })
  );
}

export type { ProductionResult };
