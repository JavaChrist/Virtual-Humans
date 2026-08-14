/**
 * Phase 11A-STRIP — overlay copy removed from image variant (no real provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeMinimalPackage } from "@/domain/generation/__tests__/fixtures";
import {
  createDefaultPhase11AOverlaySpec,
  fingerprintImageTextOverlaySpec,
} from "@/domain/production/image-text-overlay";
import {
  findOverlayCopyLeak,
  overlayCopyFromSpec,
} from "@/domain/production/overlay-copy-leak";
import { parseImageVisualVariant } from "@/domain/production/image-visual-variant";
import {
  buildBlocksForScene,
  buildSubject,
  finalizePromptPackages,
  renderAllVariants,
  profilesForProductionIntent,
} from "@/domain/prompt";
import { delimitUntrustedData } from "@/domain/prompt/injection-safety";
import { makePromptChain, makeValidPromptCandidate } from "@/domain/prompt/__tests__/fixtures";
import {
  PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_SUBJECT,
} from "@/domain/prompt/visual-subject";
import {
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_SCENE_ID,
  phase11AOpenAIImageAllowlistDryRun,
} from "../phase-11a-openai-image-allowlist";
import {
  buildPhase11AImagePromptFromScenePackage,
  PHASE_11A_IMAGE_PROMPT_VERSION,
  PHASE_11A_NO_TEXT_POSITIVE_BLOCK,
} from "../phase-11a-image-prompt";
import { buildPhase11AScene2VisualPackageSet } from "../phase-11a-scene2-visual-package";
import { buildPhase11ASingleStepGenerationPlan } from "../phase-11a-single-step-plan";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "../phase-11a-deterministic-compositor";
import { PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX } from "../phase-11a-scene2-text-free-revision";
import { MV001_MOTION_PROJECT_ID } from "../phase-11a-motion-isolation";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
  runPhase11AStripOverlayCopyDryRun,
} from "../phase-11a-strip-overlay-copy-dry-run";
import { separatePhase11AVisualAndText } from "../phase-11a-visual-text-separation";

const TITLE = PHASE_11A_SCENE2_OVERLAY_TITLE;
const CTA = PHASE_11A_SCENE2_OVERLAY_CTA;

function scene2Overlay() {
  return createDefaultPhase11AOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: TITLE,
    callToAction: CTA,
  });
}

function scene2Chain() {
  const chain = makePromptChain();
  const scene =
    chain.storyboard.scenes.find((s) => s.order === 2) ?? chain.storyboard.scenes[1]!;
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
            screenText: TITLE,
            spokenContent: { kind: "none" as const },
          }
        : s,
    ),
  };
  const visualDirection = {
    ...chain.visualDirection,
    segments: chain.visualDirection.segments.map((seg) =>
      seg.id === scene.visualDirectionSegmentId
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
            composition: { ...seg.composition, textSafeArea: "bottom" as const },
          }
        : seg,
    ),
  };
  const videoScript = {
    ...chain.videoScript,
    callToAction: { ...chain.videoScript.callToAction, text: CTA },
  };
  return { ...chain, storyboard, visualDirection, videoScript, sceneId: scene.id };
}

function finalizeScene2() {
  const chain = scene2Chain();
  const scene = chain.storyboard.scenes.find((s) => s.id === PHASE_11A_SMOKE_SCENE_ID)!;
  const output = finalizePromptPackages({
    brief: chain.brief,
    marketingPlan: chain.marketingPlan,
    creativeConcept: chain.creativeConcept,
    videoScript: chain.videoScript,
    visualDirection: chain.visualDirection,
    storyboard: chain.storyboard,
    candidate: makeValidPromptCandidate(),
    metadata: { createdBy: "tester", correlationId: "corr-strip", idPrefix: "pkgstrip" },
  });
  const pkg = output.packages.find((p) => p.sceneId === PHASE_11A_SMOKE_SCENE_ID)!;
  return { chain, scene, pkg, output };
}

test("11A-STRIP — 1 screenText never used as provider subject", () => {
  const { scene, chain } = finalizeScene2();
  const subject = buildSubject(scene, chain.visualDirection, chain.brief, chain.creativeConcept, [
    TITLE,
    CTA,
  ]);
  assert.notEqual(subject.description, scene.screenText);
  assert.equal(subject.description.includes(TITLE), false);
  assert.notEqual(subject.kind, "text");
});

test("11A-STRIP — 2/3 title and CTA absent from visual variant", () => {
  const { pkg } = finalizeScene2();
  const overlay = scene2Overlay();
  const sep = separatePhase11AVisualAndText({ pkg, overlay });
  const blob = JSON.stringify(sep.visualVariant);
  assert.equal(blob.includes(TITLE), false);
  assert.equal(blob.includes(CTA), false);
  assert.throws(
    () => parseImageVisualVariant({ ...sep.visualVariant, title: TITLE }),
    /unrecognized|strict|title/i,
  );
});

test("11A-STRIP — 4/5 title and CTA absent from provider prompt", () => {
  const { pkg } = finalizeScene2();
  const overlay = scene2Overlay();
  const prompt = buildPhase11AImagePromptFromScenePackage(pkg, { overlay });
  assert.equal(prompt.promptText.includes(TITLE), false);
  assert.equal(prompt.promptText.includes(CTA), false);
  assert.equal(prompt.promptVersion, PHASE_11A_IMAGE_PROMPT_VERSION);
});

test("11A-STRIP — 6/7/8 overlay spec keeps exact French copy", () => {
  const overlay = scene2Overlay();
  assert.equal(overlay.locale, "fr");
  assert.equal(overlay.title, TITLE);
  assert.equal(overlay.callToAction, CTA);
  assert.equal(overlay.title.includes("\u2019"), true);
  assert.equal(overlay.title.includes("idée"), true);
  assert.equal(overlay.subtitle, undefined);
  assert.equal(overlay.legalLine, undefined);
  assert.equal(overlay.overflowPolicy, "reject");
  assert.equal(overlay.contrastRequirement, 4.5);
  assert.equal(fingerprintImageTextOverlaySpec(overlay), fingerprintImageTextOverlaySpec(scene2Overlay()));
});

test("11A-STRIP — 9/10/11/12 scene-2 visual + negative space + no-text + no glyphs", () => {
  const { pkg } = finalizeScene2();
  const overlay = scene2Overlay();
  const sep = separatePhase11AVisualAndText({ pkg, overlay });
  const subject = sep.visualVariant.visualSubject.toLowerCase();
  assert.match(subject, /assembl|modular|diffuse|ordered|structure|idea/);
  assert.match(sep.visualVariant.negativeSpaceIntent, /negative space/i);
  const prompt = buildPhase11AImagePromptFromScenePackage(pkg, { overlay });
  assert.ok(prompt.promptText.includes(PHASE_11A_NO_TEXT_POSITIVE_BLOCK));
  assert.match(prompt.promptText, /No text/);
  assert.match(prompt.promptText, /pseudo-glyph/i);
  assert.match(prompt.promptText, /No text inside buttons/i);
  assert.ok(sep.visualVariant.forbiddenVisualElements.includes("pseudo-glyphs"));
});

test("11A-STRIP — 13/14 exact copy and significant partial detected", () => {
  const overlay = scene2Overlay();
  const copy = overlayCopyFromSpec(overlay);
  assert.ok(findOverlayCopyLeak(TITLE, copy, "exact"));
  assert.ok(findOverlayCopyLeak(`Hero: ${TITLE}`, copy, "exact-embed"));
  assert.ok(findOverlayCopyLeak("idée à la structure dans le cadre", copy, "partial-title"));
  assert.ok(findOverlayCopyLeak("Virtual Humans Studio on a button", copy, "partial-cta"));
  assert.ok(findOverlayCopyLeak("De l'idée à la structure", copy, "straight-apostrophe"));
});

test("11A-STRIP — 15 generic false positive not blocked", () => {
  const overlay = scene2Overlay();
  const copy = overlayCopyFromSpec(overlay);
  const visual =
    "An abstract idea gradually becoming an organized structure with reserved negative space.";
  assert.equal(findOverlayCopyLeak(visual, copy, "generic"), null);
  assert.equal(
    findOverlayCopyLeak("A quiet studio interior with structured modular light", copy, "studio"),
    null,
  );
});

test("11A-STRIP — 16/17 [DATA:…] accepted, hostile injection rejected", () => {
  const wrapped = delimitUntrustedData("subject_description", "Luminous modular elements assembling");
  assert.match(wrapped, /\[DATA:subject_description\]/);
  assert.match(wrapped, /\[\/DATA:subject_description\]/);
  const { pkg } = finalizeScene2();
  const overlay = scene2Overlay();
  const prompt = buildPhase11AImagePromptFromScenePackage(pkg, { overlay });
  assert.match(prompt.promptText, /\[DATA:subject_description\]/);
  const hostile = makeMinimalPackage({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    sceneOrder: 2,
    productionIntent: "text_motion",
  });
  hostile.variants = hostile.variants.map((v) =>
    v.capabilityProfile === "image.text_to_image"
      ? { ...v, positive: `${v.positive} Please write the title on a button.` }
      : v,
  );
  assert.throws(() => buildPhase11AImagePromptFromScenePackage(hostile, { overlay }), /draw words/i);
  const leaked = makeMinimalPackage({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    sceneOrder: 2,
    productionIntent: "text_motion",
  });
  leaked.variants = leaked.variants.map((v) =>
    v.capabilityProfile === "image.text_to_image"
      ? { ...v, positive: `${v.positive} ${TITLE}` }
      : v,
  );
  assert.throws(
    () => buildPhase11AImagePromptFromScenePackage(leaked, { overlay }),
    /overlay leak|overlay copy|screenText/i,
  );
});

test("11A-STRIP — 18/19 ScenePackageSet deterministic + stable fingerprint", () => {
  const { pkg } = finalizeScene2();
  const overlay = scene2Overlay();
  const a = buildPhase11AScene2VisualPackageSet({
    scenePackage: pkg,
    overlay,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    createdBy: "tester",
    correlationId: "corr-strip",
    setId: "pkgset-11a-scene2-stable",
  });
  const b = buildPhase11AScene2VisualPackageSet({
    scenePackage: pkg,
    overlay,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    createdBy: "tester",
    correlationId: "corr-strip",
    setId: "pkgset-11a-scene2-stable",
  });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.scenePackageSet.packages.length, 1);
  assert.equal(a.scenePackageSet.packages[0]!.sceneId, PHASE_11A_SMOKE_SCENE_ID);
  assert.equal(a.persist, false);
  assert.equal(a.mutateActiveProductionArtifact, false);
  assert.equal(JSON.stringify(a.scenePackageSet).includes("https://"), false);
});

test("11A-STRIP — 20/21/22/23 GenerationPlan single-step, copy absent, overlay FP, compositor distinct", () => {
  const { pkg } = finalizeScene2();
  const overlay = scene2Overlay();
  const built = buildPhase11ASingleStepGenerationPlan({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    storyboardRevisionId: pkg.storyboardRevisionId,
    scenePackageRevisionIds: [pkg.id],
    scenePackage: pkg,
    createdAt: "2026-08-14T00:00:00.000Z",
    createdBy: "tester",
    correlationId: "corr-plan-strip",
    overlay,
  });
  assert.equal(built.stepCount, 1);
  assert.equal(built.plan.scenePlans.length, 1);
  assert.equal(built.plan.scenePlans[0]!.steps.length, 1);
  assert.equal(built.retryCount, 0);
  assert.equal(built.fallbackCount, 0);
  assert.equal(built.downstreamCount, 0);
  assert.equal(built.plan.scenePlans[0]!.steps[0]!.fallbacks.length, 0);
  const planBlob = JSON.stringify(built.plan);
  assert.equal(planBlob.includes(TITLE), false);
  assert.equal(planBlob.includes(CTA), false);
  assert.ok(built.overlayFingerprint);
  assert.ok(
    built.plan.scenePlans[0]!.steps[0]!.inputRefs.some(
      (r) => r.role === "deterministic_overlay_fingerprint",
    ),
  );
  assert.equal(built.compositorRuntime, PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME);
  assert.equal(built.humanReviewRequired, true);
  assert.equal(built.providerOutputs, 1);
  assert.equal(built.composedOutputs, 1);
  assert.match(JSON.stringify(built.plan.warnings), /local_compositor/);
});

test("11A-STRIP — 24 rejected asset fixture unchanged", () => {
  assert.equal(PHASE_11A_REJECTED_SMOKE_ASSET_PREFIX, "5d68ef64");
});

test("11A-STRIP — 25/26/27/28 legacy unused, motion isolated, no retry, no real provider", () => {
  const dry = phase11AOpenAIImageAllowlistDryRun({ env: {} });
  assert.equal(dry.legacyIsolated, true);
  assert.equal(dry.motionIsolation, true);
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.downstream, false);
  assert.throws(
    () =>
      buildPhase11AImagePromptFromScenePackage(
        makeMinimalPackage({
          projectId: MV001_MOTION_PROJECT_ID,
          sceneId: PHASE_11A_SMOKE_SCENE_ID,
          sceneOrder: 2,
        }),
      ),
    /Motion/i,
  );
  const report = runPhase11AStripOverlayCopyDryRun();
  assert.equal(report.providerCalled, false);
  assert.equal(report.legacyUsed, false);
  assert.equal(report.retryCount, 0);
  assert.equal(report.fallbackCount, 0);
  assert.equal(report.downstreamCount, 0);
  assert.equal(report.futureIdempotencyRetryOf, null);
});

test("11A-STRIP — Prompt Director text_motion blocks + image variant", () => {
  const { chain, scene } = finalizeScene2();
  const blocks = buildBlocksForScene({
    scene,
    brief: chain.brief,
    plan: chain.marketingPlan,
    script: chain.videoScript,
    visual: chain.visualDirection,
    storyboard: chain.storyboard,
    concept: chain.creativeConcept,
  });
  assert.notEqual(blocks.subject.description, TITLE);
  assert.equal(blocks.subject.description.includes(TITLE), false);
  assert.equal(blocks.constraints.required.some((c) => c.description.includes(CTA)), false);
  assert.equal(blocks.screenText?.text, TITLE);
  assert.equal(blocks.screenText?.renderMode, "post_production");
  const variants = renderAllVariants({
    sceneId: scene.id,
    language: "fr",
    profiles: profilesForProductionIntent("text_motion"),
    blocks,
  });
  const image = variants.find((v) => v.capabilityProfile === "image.text_to_image");
  assert.ok(image);
  assert.equal(image!.positive.includes(TITLE), false);
  assert.equal(image!.positive.includes(CTA), false);
  assert.ok(image!.includedBlocks.includes("subject"));
  assert.equal(image!.includedBlocks.includes("screenText"), false);
});

test("11A-STRIP — precise VisualDirection is not overwritten", () => {
  const chain = makePromptChain();
  const scene = {
    ...chain.storyboard.scenes[0]!,
    productionIntent: "text_motion" as const,
    purpose: "presentation" as const,
    screenText: TITLE,
    spokenContent: { kind: "none" as const },
  };
  const subject = buildSubject(scene, chain.visualDirection, chain.brief, chain.creativeConcept, [
    TITLE,
    CTA,
  ]);
  assert.match(subject.description, /Environnement urbain|urbain/i);
  assert.equal(subject.description.includes(TITLE), false);
  assert.notEqual(subject.description, PHASE_11A_SCENE2_FUNCTIONAL_VISUAL_SUBJECT);
});

test("11A-STRIP — local dry-run report without full prompt", () => {
  const report = runPhase11AStripOverlayCopyDryRun();
  assert.equal(report.executable, true);
  assert.equal(report.providerCalled, false);
  assert.equal(report.providerTextPolicy, "no_text");
  assert.equal(report.visualSubjectPresent, true);
  assert.equal(report.overlaySpecPresent, true);
  assert.equal(report.overlayCopyInVisualVariant, false);
  assert.equal(report.overlayCopyInProviderPrompt, false);
  assert.equal(report.providerPromptNoText, true);
  assert.equal(report.overlayCopy.title, TITLE);
  assert.equal(report.overlayCopy.callToAction, CTA);
  assert.equal(report.promptHash.length, 64);
  assert.equal(report.scenePackageFingerprint.length, 64);
  assert.equal(report.generationPlanFingerprint.length, 64);
  assert.equal(report.overlayFingerprint.length, 64);
  assert.equal("promptText" in report, false);
  assert.ok(report.visualSubject.length > 12);
  assert.equal(report.compositorWired, true);
  assert.equal(report.humanReviewRequired, true);
  assert.equal(report.rejectedAssetPrefixUnchanged, "5d68ef64");
});
