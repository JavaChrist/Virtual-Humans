import { money } from "@/domain/cost";
import type { ScenePackage } from "@/domain/prompt";
import type { GenerationStep } from "@/domain/routing/router";
import {
  buildIdempotencyKey,
  type GenerationCommand,
  type ResolvedGenerationInput,
} from "../index";

export const AT = "2026-08-02T12:00:00.000Z";

export function makeMinimalPackage(over: Partial<ScenePackage> = {}): ScenePackage {
  const base = {
    id: "pkg-1",
    projectId: "proj-1",
    schemaVersion: "1.0.0",
    revision: 1,
    createdAt: AT,
    createdBy: "tester",
    correlationId: "corr-1",
    artifactType: "scene_package" as const,
    storyboardRevisionId: "sb-1",
    sceneId: "sc-1",
    sceneOrder: 1,
    productionIntent: "b_roll" as const,
    subject: {
      kind: "environment" as const,
      description: "Office",
      identityRequirements: [],
    },
    action: {
      primaryAction: "pan",
      secondaryActions: [],
      motionIntensity: "low" as const,
    },
    environment: {
      location: "office",
      timeOfDay: "day",
      weather: "clear",
      ambiance: "calm",
      elements: [],
    },
    camera: {
      framing: "wide",
      angle: "eye_level",
      movement: "static",
      depthOfField: "medium",
      intention: "establish",
    },
    lighting: {
      key: "soft",
      contrast: "medium",
      colorTemperature: "neutral",
      notes: [],
    },
    style: {
      palette: ["#111111"],
      look: "photoreal",
      continuityNotes: [],
    },
    composition: {
      subjectPosition: "center",
      textSafeArea: true,
      notes: [],
    },
    references: [],
    constraints: { required: [], forbidden: [], continuity: [], safety: [] },
    variants: [
      {
        id: "var-t2v",
        capabilityProfile: "video.text_to_video" as const,
        mediaType: "video" as const,
        positive: "A calm office pan",
        rendererVersion: "prompt-renderer-v1",
        language: "fr",
        includedBlocks: ["subject" as const, "action" as const],
      },
      {
        id: "var-img",
        capabilityProfile: "image.text_to_image" as const,
        mediaType: "image" as const,
        positive: "A product still",
        rendererVersion: "prompt-renderer-v1",
        language: "fr",
        includedBlocks: ["subject" as const],
      },
      {
        id: "var-voice",
        capabilityProfile: "audio.voice" as const,
        mediaType: "audio" as const,
        positive: "Bonjour",
        rendererVersion: "prompt-renderer-v1",
        language: "fr",
        includedBlocks: ["dialogue" as const],
      },
    ],
    assumptions: [],
    evidence: [],
    rationale: { summary: "test", decisions: [] },
    ...over,
  };
  return base as ScenePackage;
}

export function makeStep(over: Partial<GenerationStep> = {}): GenerationStep {
  return {
    id: "step:sc-1:direct_video:1:video.text_to_video",
    order: 1,
    action: "video",
    capabilityProfile: "video.text_to_video",
    providerId: "fal",
    modelId: "fal-ai/kling-video/v2/master/text-to-video",
    promptVariantId: "var-t2v",
    inputRefs: [],
    dependsOnStepIds: [],
    expectedOutput: { mediaType: "video", durationSeconds: 5 },
    timeoutSeconds: 120,
    estimate: {
      id: "est-1",
      projectId: "proj-1",
      schemaVersion: "1.0.0",
      revision: 1,
      createdAt: AT,
      createdBy: "tester",
      correlationId: "corr-1",
      action: "video",
      quantity: 5,
      unit: "seconds",
      unitCost: money(10, "USD"),
      subtotal: money(50, "USD"),
      margin: money(0, "USD"),
      total: money(50, "USD"),
      confidence: "medium",
      pricingVersion: "test",
      assumptions: [],
    },
    fallbacks: [
      {
        order: 1,
        providerId: "fal",
        modelId: "other-should-be-ignored",
        estimate: {
          id: "est-fb",
          projectId: "proj-1",
          schemaVersion: "1.0.0",
          revision: 1,
          createdAt: AT,
          createdBy: "tester",
          correlationId: "corr-1",
          action: "video",
          quantity: 5,
          unit: "seconds",
          unitCost: money(20, "USD"),
          subtotal: money(100, "USD"),
          margin: money(0, "USD"),
          total: money(100, "USD"),
          confidence: "medium",
          pricingVersion: "test",
          assumptions: [],
        },
        reason: "test fallback",
        eligibilityEvidence: [],
      },
    ],
    selection: {
      selectedBecause: [{ code: "eligible", message: "ok" }],
      rejectedAlternatives: [],
      score: { total: 50, missingDimensions: [], contributions: [] },
      eligibilityEvidence: [],
      pricingEvidence: [],
      unknowns: [],
    },
    ...over,
  };
}

export function makeCommand(over: Partial<GenerationCommand> = {}): GenerationCommand {
  const step = over.step ?? makeStep();
  const scenePackage = over.scenePackage ?? makeMinimalPackage();
  const attempt = over.attempt ?? 1;
  const key =
    over.idempotencyKey ??
    buildIdempotencyKey({
      projectId: "proj-1",
      planRevisionId: "plan-1",
      sceneId: "sc-1",
      stepId: step.id,
      attempt,
    });
  return {
    projectId: "proj-1",
    planRevisionId: "plan-1",
    sceneId: "sc-1",
    step,
    scenePackage,
    resolvedInputs: over.resolvedInputs ?? [],
    idempotencyKey: key,
    requestedAt: AT,
    attempt,
    ...over,
  };
}

export function makeResolved(
  over: Partial<ResolvedGenerationInput> & { assetId?: string } = {},
): ResolvedGenerationInput {
  return {
    role: over.role ?? "ref",
    fromStepId: over.fromStepId,
    asset: {
      assetId: over.assetId ?? "asset-1",
      kind: over.asset?.kind ?? "image",
      access:
        over.asset?.access ??
        ({
          kind: "signed_url",
          url: "https://cdn.example.com/a.png",
          expiresAt: "2026-08-02T18:00:00.000Z",
        } as const),
      ...over.asset,
    },
  };
}
