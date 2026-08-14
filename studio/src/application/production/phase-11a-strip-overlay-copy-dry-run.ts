/**
 * Local dry-run: strip overlay copy from the image variant.
 * No provider, no Production write, no flag change.
 */

import { finalizePromptPackages } from "@/domain/prompt";
import {
  createDefaultPhase11AOverlaySpec,
  fingerprintImageTextOverlaySpec,
  PHASE_11A_PROVIDER_TEXT_POLICY,
} from "@/domain/production/image-text-overlay";
import { overlayCopyFromSpec } from "@/domain/production/overlay-copy-leak";
import { makePromptChain, makeValidPromptCandidate } from "@/domain/prompt/__tests__/fixtures";
import {
  PHASE_11A_IMAGE_PROMPT_VERSION,
  buildPhase11AImagePromptFromScenePackage,
} from "./phase-11a-image-prompt";
import { buildPhase11AScene2VisualPackageSet } from "./phase-11a-scene2-visual-package";
import { buildPhase11ASingleStepGenerationPlan } from "./phase-11a-single-step-plan";
import {
  PHASE_11A_SMOKE_MODEL,
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_PROVIDER,
  PHASE_11A_SMOKE_QUALITY,
  PHASE_11A_SMOKE_SCENE_ID,
  PHASE_11A_SMOKE_SIZE,
  phase11AOpenAIImageAllowlistDryRun,
} from "./phase-11a-openai-image-allowlist";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "./phase-11a-deterministic-compositor";
import { PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX } from "./phase-11a-scene2-text-free-revision";

export const PHASE_11A_SCENE2_OVERLAY_TITLE = "De l\u2019idée à la structure" as const;
export const PHASE_11A_SCENE2_OVERLAY_CTA = "Découvrir Virtual Humans Studio" as const;
export const PHASE_11A_SCENE2_OVERLAY_LOCALE = "fr" as const;

export type Phase11AStripOverlayCopyDryRun = {
  providerCalled: false;
  executable: true;
  providerTextPolicy: typeof PHASE_11A_PROVIDER_TEXT_POLICY;
  visualSubjectPresent: true;
  overlaySpecPresent: true;
  overlayCopyInVisualVariant: false;
  overlayCopyInProviderPrompt: false;
  providerPromptNoText: true;
  promptVersion: typeof PHASE_11A_IMAGE_PROMPT_VERSION;
  promptHash: string;
  scenePackageFingerprint: string;
  generationPlanFingerprint: string;
  overlayFingerprint: string;
  visualSubject: string;
  overlayCopy: {
    locale: typeof PHASE_11A_SCENE2_OVERLAY_LOCALE;
    title: typeof PHASE_11A_SCENE2_OVERLAY_TITLE;
    callToAction: typeof PHASE_11A_SCENE2_OVERLAY_CTA;
    subtitle: null;
    legalLine: null;
  };
  provider: typeof PHASE_11A_SMOKE_PROVIDER;
  model: typeof PHASE_11A_SMOKE_MODEL;
  quality: typeof PHASE_11A_SMOKE_QUALITY;
  size: typeof PHASE_11A_SMOKE_SIZE;
  estimateMinor: number;
  reservationMinor: number;
  compositorWired: true;
  compositorRuntime: typeof PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME;
  humanReviewRequired: true;
  retryCount: 0;
  fallbackCount: 0;
  downstreamCount: 0;
  legacyUsed: false;
  motionIsolation: true;
  rejectedAssetPrefixUnchanged: typeof PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX;
  futureIdempotencyRetryOf: null;
};

function makeScene2TextMotionChain() {
  const chain = makePromptChain();
  const scene =
    chain.storyboard.scenes.find((s) => s.order === 2) ?? chain.storyboard.scenes[1] ?? chain.storyboard.scenes[0]!;
  const vd = chain.visualDirection.segments.find((s) => s.id === scene.visualDirectionSegmentId);
  const storyboard = {
    ...chain.storyboard,
    scenes: chain.storyboard.scenes.map((s) =>
      s.id === scene.id
        ? {
            ...s,
            id: PHASE_11A_SMOKE_SCENE_ID,
            order: 2,
            purpose: "problem" as const,
            title: "problem",
            productionIntent: "text_motion" as const,
            screenText: PHASE_11A_SCENE2_OVERLAY_TITLE,
            spokenContent: { kind: "none" as const },
          }
        : s,
    ),
  };
  const visualDirection = vd
    ? {
        ...chain.visualDirection,
        segments: chain.visualDirection.segments.map((seg) =>
          seg.id === vd.id
            ? {
                ...seg,
                environment: {
                  ...seg.environment,
                  description:
                    "Luminous modular elements assembling from a diffuse field into an ordered structure.",
                },
                location: {
                  ...seg.location,
                  kind: "abstract" as const,
                  description: "Abstract studio void with reserved lower-third negative space.",
                },
                composition: {
                  ...seg.composition,
                  textSafeArea: "bottom" as const,
                },
              }
            : seg,
        ),
      }
    : chain.visualDirection;
  return { ...chain, storyboard, visualDirection, sceneId: PHASE_11A_SMOKE_SCENE_ID };
}

export function runPhase11AStripOverlayCopyDryRun(): Phase11AStripOverlayCopyDryRun {
  const allow = phase11AOpenAIImageAllowlistDryRun({ env: {} });
  const chain = makeScene2TextMotionChain();
  const output = finalizePromptPackages({
    brief: chain.brief,
    marketingPlan: chain.marketingPlan,
    creativeConcept: chain.creativeConcept,
    videoScript: { ...chain.videoScript, callToAction: { ...chain.videoScript.callToAction, text: PHASE_11A_SCENE2_OVERLAY_CTA } },
    visualDirection: chain.visualDirection,
    storyboard: chain.storyboard,
    candidate: makeValidPromptCandidate(),
    metadata: {
      createdBy: "tester",
      correlationId: "corr-11a-strip-overlay",
      idPrefix: "pkg11a",
    },
  });
  const pkg = output.packages.find((p) => p.sceneId === PHASE_11A_SMOKE_SCENE_ID);
  if (!pkg) throw new Error("scene-2 package missing from dry-run finalize.");

  const overlay = createDefaultPhase11AOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: PHASE_11A_SCENE2_OVERLAY_TITLE,
    callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
  });
  const set = buildPhase11AScene2VisualPackageSet({
    scenePackage: pkg,
    overlay,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    createdBy: "tester",
    correlationId: "corr-11a-strip-overlay",
  });
  const prompt = buildPhase11AImagePromptFromScenePackage(set.scenePackageSet.packages[0]!, {
    overlay,
  });
  const plan = buildPhase11ASingleStepGenerationPlan({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    storyboardRevisionId: pkg.storyboardRevisionId,
    scenePackageRevisionIds: [set.scenePackageSet.id],
    scenePackage: set.scenePackageSet.packages[0]!,
    createdAt: "2026-08-14T00:00:00.000Z",
    createdBy: "tester",
    correlationId: "corr-11a-strip-overlay",
    overlay,
  });

  const copy = overlayCopyFromSpec(overlay);
  const visualBlob = JSON.stringify({
    subject: pkg.subject,
    visualVariant: set.visualVariant,
    variants: pkg.variants,
  });
  for (const s of copy) {
    if (visualBlob.includes(s) || prompt.promptText.includes(s)) {
      throw new Error("Dry-run leaked overlay copy into visual or provider prompt.");
    }
  }
  if (!/no text|no letters|no words|no numbers|pseudo-glyph/i.test(prompt.promptText)) {
    throw new Error("Dry-run provider prompt missing no-text policy.");
  }

  return {
    providerCalled: false,
    executable: true,
    providerTextPolicy: PHASE_11A_PROVIDER_TEXT_POLICY,
    visualSubjectPresent: true,
    overlaySpecPresent: true,
    overlayCopyInVisualVariant: false,
    overlayCopyInProviderPrompt: false,
    providerPromptNoText: true,
    promptVersion: PHASE_11A_IMAGE_PROMPT_VERSION,
    promptHash: prompt.promptHash,
    scenePackageFingerprint: set.fingerprint,
    generationPlanFingerprint: plan.fingerprint,
    overlayFingerprint: fingerprintImageTextOverlaySpec(overlay),
    visualSubject: set.visualVariant.visualSubject,
    overlayCopy: {
      locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
      title: PHASE_11A_SCENE2_OVERLAY_TITLE,
      callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
      subtitle: null,
      legalLine: null,
    },
    provider: PHASE_11A_SMOKE_PROVIDER,
    model: PHASE_11A_SMOKE_MODEL,
    quality: PHASE_11A_SMOKE_QUALITY,
    size: PHASE_11A_SMOKE_SIZE,
    estimateMinor: plan.estimateMinor,
    reservationMinor: plan.reservationMinor,
    compositorWired: true,
    compositorRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    humanReviewRequired: true,
    retryCount: 0,
    fallbackCount: 0,
    downstreamCount: 0,
    legacyUsed: false,
    motionIsolation: allow.motionIsolation,
    rejectedAssetPrefixUnchanged: PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX,
    futureIdempotencyRetryOf: null,
  };
}
