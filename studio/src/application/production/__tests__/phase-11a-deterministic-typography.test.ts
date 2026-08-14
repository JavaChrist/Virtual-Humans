/**
 * Phase 11A-HARDEN — deterministic typography / text-free generation (no real provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeMinimalPackage } from "@/domain/generation/__tests__/fixtures";
import {
  createDefaultPhase11AOverlaySpec,
  fingerprintImageTextOverlaySpec,
  parseImageTextOverlaySpec,
  PHASE_11A_PROVIDER_TEXT_POLICY,
  PHASE_11A_TEXT_OVERLAY_MODE,
} from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_SCENE_ID,
} from "../phase-11a-openai-image-allowlist";
import {
  assertOverlayStringsNotInProviderPrompt,
  buildPhase11AImagePromptFromScenePackage,
  PHASE_11A_IMAGE_PROMPT_VERSION,
  PHASE_11A_NO_TEXT_POSITIVE_BLOCK,
} from "../phase-11a-image-prompt";
import {
  composePhase11ADeterministicOverlay,
  PHASE_11A_COMPOSITOR_VERSION,
  PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
} from "../phase-11a-deterministic-compositor";
import {
  createFakeImageOcrPort,
  createUnavailableImageOcrPort,
  inspectProviderImageText,
  PHASE_11A_OCR_UNAVAILABLE_MEASURE,
  PHASE_11A_PROVIDER_IMAGE_TEXT_DETECTED,
} from "../phase-11a-ocr-gate";
import { solidRgbPng } from "../phase-11a-png-rgb";
import { validatePhase11ATypographicQc } from "../phase-11a-typographic-qc";
import {
  createMemoryPhase11ARoleAssetContentPort,
  fingerprintPhase11AComposedAsset,
  ingestPhase11AComposedOverlay,
} from "../phase-11a-composed-ingest";
import { createMemoryAssetRepository } from "../phase-11a-image-storage-ingest";
import {
  buildPhase11ARoleImageStoragePath,
} from "../phase-11a-image-role-storage";
import { MV001_MOTION_PROJECT_ID } from "../phase-11a-motion-isolation";
import {
  assertPhase11AActivationAllowed,
  assertPhase11AOutputNotAutoActive,
  assertPhase11ARetryIsIntentOnly,
} from "../phase-11a-human-review-gate";
import {
  assertPhase11AOverlayDecisionDoesNotExecute,
  assertPhase11AOverlayPipelineGuards,
  assertPhase11AOverlayRetryIntentOnly,
  buildPhase11AOverlayReviewCard,
} from "../phase-11a-overlay-review";
import { preparePhase11AScene2TextFreeRevision } from "../phase-11a-scene2-text-free-revision";
import { separatePhase11AVisualAndText } from "../phase-11a-visual-text-separation";
import { checksumSha256Bytes } from "../phase-11a-image-technical-qc";

const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PARENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NOW = "2026-08-14T00:00:00.000Z";

function smokePkg() {
  return makeMinimalPackage({
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    sceneOrder: 2,
    productionIntent: "text_motion",
    environment: {
      kind: "interior",
      description: "Bright modern office",
      timeOfDay: "day",
      weather: "clear",
      continuityKey: "office-1",
      mood: "calm",
    },
    camera: {
      shotSize: "wide",
      angle: "eye_level",
      movement: "static",
      depthOfField: "medium",
      intent: "establish",
    },
    lighting: {
      source: "soft window",
      quality: "soft",
      temperature: "neutral",
      contrast: "medium",
      intent: "natural",
    },
    style: {
      style: "photoreal",
      realism: "high",
      colorIntent: "neutral",
      brandAlignment: "clean",
      paletteRoles: ["primary"],
    },
    composition: {
      subjectPosition: "center",
      lookDirection: "camera",
      visualHierarchy: "subject-first",
      textSafeArea: "bottom",
    },
  });
}

function frOverlay() {
  return createDefaultPhase11AOverlaySpec({
    locale: "fr-FR",
    title: "Épargnez l'énergie",
    subtitle: "Moins de friction, plus d’impact",
    callToAction: "S'inscrire",
  });
}

function providerPng(): Uint8Array {
  return solidRgbPng({ width: 1024, height: 1024, r: 40, g: 48, b: 62 });
}

function assertNoUrlOrBase64(blob: string): void {
  assert.equal(/https?:\/\//i.test(blob), false);
  assert.equal(/data:image\/|base64,/i.test(blob), false);
}

test("11A-HARDEN — overlay spec strict + fingerprint + guards", () => {
  const spec = frOverlay();
  assert.equal(spec.locale, "fr-FR");
  assert.equal(fingerprintImageTextOverlaySpec(spec), fingerprintImageTextOverlaySpec(frOverlay()));
  assert.throws(() => parseImageTextOverlaySpec({ ...spec, locale: undefined }), /locale|required/i);
  assert.throws(
    () => parseImageTextOverlaySpec({ ...spec, fontFamily: "Arial" }),
    /fontFamily|Invalid|literal/i,
  );
  assert.throws(
    () => parseImageTextOverlaySpec({ ...spec, title: "x".repeat(81) }),
    /title|too_big|max/i,
  );
  assert.throws(
    () => parseImageTextOverlaySpec({ ...spec, title: "<b>Hi</b>" }),
    /HTML|script/i,
  );
  assert.throws(
    () => parseImageTextOverlaySpec({ ...spec, title: "See https://example.com" }),
    /URL/i,
  );
  assert.throws(
    () => parseImageTextOverlaySpec({ ...spec, title: "Please draw the text on the button" }),
    /provider/i,
  );
});

test("11A-HARDEN — prompt provider no-text and overlay copy excluded", () => {
  const pkg = smokePkg();
  const overlay = frOverlay();
  const prompt = buildPhase11AImagePromptFromScenePackage(pkg, { overlay });
  assert.equal(prompt.promptVersion, PHASE_11A_IMAGE_PROMPT_VERSION);
  assert.equal(prompt.redactedMetadata.providerTextPolicy, PHASE_11A_PROVIDER_TEXT_POLICY);
  assert.equal(prompt.redactedMetadata.textOverlayMode, PHASE_11A_TEXT_OVERLAY_MODE);
  assert.ok(prompt.promptText.includes(PHASE_11A_NO_TEXT_POSITIVE_BLOCK));
  assertOverlayStringsNotInProviderPrompt(prompt.promptText, overlay);
  assert.equal(prompt.promptText.includes(overlay.title), false);
  assert.equal(prompt.promptText.includes(overlay.callToAction ?? "___"), false);
  assertNoUrlOrBase64(JSON.stringify(prompt.redactedMetadata));
  assert.equal("promptText" in prompt.redactedMetadata, false);

  const withCopy = smokePkg();
  withCopy.variants = withCopy.variants.map((v) =>
    v.capabilityProfile === "image.text_to_image"
      ? { ...v, positive: `${v.positive} ${overlay.title}` }
      : v,
  );
  assert.throws(
    () => buildPhase11AImagePromptFromScenePackage(withCopy, { overlay }),
    /overlay leak|overlay copy|screenText copy/i,
  );

  const drawWords = smokePkg();
  drawWords.variants = drawWords.variants.map((v) =>
    v.capabilityProfile === "image.text_to_image"
      ? { ...v, positive: "A still. Please write the title on a button." }
      : v,
  );
  assert.throws(() => buildPhase11AImagePromptFromScenePackage(drawWords), /draw words/i);

  const modelGen = smokePkg();
  modelGen.screenText = { text: overlay.title, renderMode: "model_generated", safeAreaRequired: true };
  assert.throws(() => buildPhase11AImagePromptFromScenePackage(modelGen), /model_generated/i);
});

test("11A-HARDEN — visual/text separation", () => {
  const pkg = smokePkg();
  pkg.screenText = {
    text: "Épargnez l'énergie",
    renderMode: "post_production",
    safeAreaRequired: true,
  };
  const overlay = frOverlay();
  const sep = separatePhase11AVisualAndText({ pkg, overlay });
  assert.equal(sep.screenTextRenderMode, "post_production");
  assert.equal(sep.overlay.title, overlay.title);
  assert.equal(sep.visualDescription.environment.includes("office"), true);
});

test("11A-HARDEN — OCR fake + unavailable_humanOnly", async () => {
  const bytes = providerPng();
  const unavailable = await inspectProviderImageText({
    bytes,
    ocr: createUnavailableImageOcrPort(),
  });
  assert.equal(unavailable.status, "unavailable_humanOnly");
  assert.equal(unavailable.measure, PHASE_11A_OCR_UNAVAILABLE_MEASURE);

  const detected = await inspectProviderImageText({
    bytes,
    ocr: createFakeImageOcrPort({ detected: true, score: 0.9, snippets: ["BTN"] }),
  });
  assert.equal(detected.status, "fail");
  assert.equal(detected.measure, PHASE_11A_PROVIDER_IMAGE_TEXT_DETECTED);

  const clear = await inspectProviderImageText({
    bytes,
    ocr: createFakeImageOcrPort({ detected: false, score: 0 }),
  });
  assert.equal(clear.status, "pass");
});

test("11A-HARDEN — compositor accents, CTA, unicode, determinism, QC", () => {
  const spec = frOverlay();
  const png = providerPng();
  const a = composePhase11ADeterministicOverlay({ providerPng: png, spec });
  const b = composePhase11ADeterministicOverlay({ providerPng: png, spec });
  assert.equal(a.checksumSha256, b.checksumSha256);
  assert.equal(a.checksumSha256, checksumSha256Bytes(a.png));
  assert.deepEqual(a.renderedStrings, [spec.title, spec.subtitle, spec.callToAction]);
  assert.equal(a.renderedStrings.join(" "), spec.title + " " + spec.subtitle + " " + spec.callToAction);
  assert.ok(a.lineBoxes.some((l) => l.role === "title"));
  assert.ok(a.lineBoxes.some((l) => l.role === "callToAction"));
  const qc = validatePhase11ATypographicQc({ spec, composed: a });
  assert.equal(qc.status, "accepted");
  assert.equal(qc.humanOnlyResidual, true);
  assertNoUrlOrBase64(JSON.stringify(a.redactedMetadata));

  const multiline = createDefaultPhase11AOverlaySpec({
    locale: "fr-FR",
    title: "Un titre volontairement long pour forcer deux lignes overlay",
    callToAction: "S'inscrire",
  });
  multiline.fontSize = 40;
  const composedMulti = composePhase11ADeterministicOverlay({
    providerPng: png,
    spec: multiline,
  });
  assert.ok(composedMulti.lineBoxes.filter((l) => l.role === "title").length >= 2);
  assert.equal(composedMulti.renderedStrings[0], multiline.title);
  assert.equal(validatePhase11ATypographicQc({ spec: multiline, composed: composedMulti }).status, "accepted");

  const withApostrophe = createDefaultPhase11AOverlaySpec({
    locale: "fr",
    title: "L’épargne n’attend pas",
    callToAction: "Go",
  });
  const composedApos = composePhase11ADeterministicOverlay({
    providerPng: png,
    spec: withApostrophe,
  });
  assert.equal(composedApos.renderedStrings[0], "L’épargne n’attend pas");

  assert.throws(
    () =>
      composePhase11ADeterministicOverlay({
        providerPng: png,
        spec: createDefaultPhase11AOverlaySpec({ locale: "fr", title: "你好世界测试" }),
      }),
    /glyph_unsupported/i,
  );
});

test("11A-HARDEN — overflow, contrast, clipping, no silent mutation", () => {
  const png = providerPng();
  const overflow = createDefaultPhase11AOverlaySpec({
    locale: "fr",
    title: "Un titre beaucoup trop long pour une seule ligne autorisée vraiment",
  });
  overflow.maxLines = 1;
  overflow.fontSize = 64;
  assert.throws(
    () => composePhase11ADeterministicOverlay({ providerPng: png, spec: overflow }),
    /overlay_overflow/,
  );

  const contrast = createDefaultPhase11AOverlaySpec({ locale: "fr", title: "Contraste" });
  contrast.textColor = "#777777";
  contrast.backgroundColor = "#888888";
  assert.throws(
    () => composePhase11ADeterministicOverlay({ providerPng: png, spec: contrast }),
    /overlay_contrast_insufficient/,
  );

  const clip = createDefaultPhase11AOverlaySpec({ locale: "fr", title: "Clip" });
  clip.safeArea = { top: 1020, right: 8, bottom: 0, left: 8 };
  clip.fontSize = 32;
  clip.maxLines = 1;
  assert.throws(
    () => composePhase11ADeterministicOverlay({ providerPng: png, spec: clip }),
    /overlay_overflow|overlay_clipping|safe_area/,
  );
});

test("11A-HARDEN — parent/child assets, replay, no auto-active, no URL", async () => {
  const spec = frOverlay();
  const png = providerPng();
  const composed = composePhase11ADeterministicOverlay({ providerPng: png, spec });
  const content = createMemoryPhase11ARoleAssetContentPort();
  const assets = createMemoryAssetRepository();
  const providerPath = buildPhase11ARoleImageStoragePath({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: PARENT_ID,
    role: "provider",
  });
  await content.put({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: PARENT_ID,
    mimeType: "image/png",
    bytes: png,
    storagePath: providerPath,
  });
  const parentWrites = content.writeCount;

  const first = await ingestPhase11AComposedOverlay({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step-image",
    parentAssetId: PARENT_ID,
    parentChecksumSha256: checksumSha256Bytes(png),
    parentStoragePath: providerPath,
    composed,
    overlay: spec,
    content,
    assets,
    nowIso: NOW,
  });
  assert.equal(first.wrote, true);
  assert.equal(first.active, false);
  assert.match(first.storagePath, /\/media\/image\/composed\//);
  assert.equal(first.parentAssetId, PARENT_ID);
  assert.notEqual(first.assetId, PARENT_ID);

  const replay = await ingestPhase11AComposedOverlay({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    runId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    sceneId: PHASE_11A_SMOKE_SCENE_ID,
    stepId: "step-image",
    parentAssetId: PARENT_ID,
    parentChecksumSha256: checksumSha256Bytes(png),
    parentStoragePath: providerPath,
    composed,
    overlay: spec,
    content,
    assets,
    nowIso: NOW,
  });
  assert.equal(replay.wrote, false);
  assert.equal(replay.assetId, first.assetId);
  assert.equal(content.writeCount, parentWrites + 1);

  const parentObj = await content.get({
    workspaceId: WS,
    projectId: PHASE_11A_SMOKE_PROJECT_ID,
    assetId: PARENT_ID,
    storagePath: providerPath,
  });
  assert.equal(parentObj?.checksumSha256, checksumSha256Bytes(png));
  await assert.rejects(
    () =>
      content.put({
        workspaceId: WS,
        projectId: PHASE_11A_SMOKE_PROJECT_ID,
        assetId: PARENT_ID,
        mimeType: "image/png",
        bytes: solidRgbPng({ width: 1024, height: 1024, r: 9, g: 9, b: 9 }),
        storagePath: providerPath,
      }),
    /Collision|différent/i,
  );

  const row = await assets.load(first.assetId);
  assert.equal(row?.status, "pending_review");
  const provenance = JSON.stringify(row?.provenance ?? {});
  assertNoUrlOrBase64(provenance);
  assert.match(provenance, /composed_overlay_image/);
  assert.equal(JSON.stringify(first).includes("data:image"), false);

  assertPhase11AOutputNotAutoActive({
    active: first.active,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
  });
  assert.throws(
    () =>
      assertPhase11AActivationAllowed({
        technicalQcStatus: "needs_review",
        reviews: [],
      }),
    /Human Review/,
  );
  assert.equal(
    fingerprintPhase11AComposedAsset({
      parentChecksumSha256: checksumSha256Bytes(png),
      overlay: spec,
    }).length,
    64,
  );
});

test("11A-HARDEN — Human Review card + scene-2 future revision + guards", () => {
  const spec = frOverlay();
  const png = providerPng();
  const composed = composePhase11ADeterministicOverlay({ providerPng: png, spec });
  const qc = validatePhase11ATypographicQc({ spec, composed });
  const card = buildPhase11AOverlayReviewCard({
    providerAssetId: PARENT_ID,
    composedAssetId: "cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    spec,
    typographicQc: qc,
    ocrGate: {
      status: "unavailable_humanOnly",
      measure: PHASE_11A_OCR_UNAVAILABLE_MEASURE,
      detected: false,
    },
    overlayFingerprint: composed.overlayFingerprint,
    overlayVersion: composed.overlayVersion,
    compositorVersion: PHASE_11A_COMPOSITOR_VERSION,
    providerCostMinorAlreadySettled: 1,
  });
  assert.equal(card.humanReviewRequired, true);
  assert.equal(card.autoActive, false);
  assert.equal(card.retryCreatesJob, false);
  assert.deepEqual(card.expectedStrings, composed.renderedStrings);
  assertNoUrlOrBase64(JSON.stringify(card));

  assertPhase11AOverlayRetryIntentOnly("RETRY_WITH_UPDATED_CONSTRAINTS");
  assertPhase11ARetryIsIntentOnly("retry_intent_only");
  assertPhase11AOverlayDecisionDoesNotExecute({
    decision: "RETRY_WITH_UPDATED_CONSTRAINTS",
    providerCalls: 0,
    jobsCreated: 0,
    storageWrites: 0,
  });
  assertPhase11AOverlayPipelineGuards({
    overlayRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    legacyEndpoint: false,
    motionReferenced: false,
    downstreamRequested: false,
    humanReviewPresent: true,
    providerCalls: 0,
  });
  assert.throws(
    () =>
      assertPhase11AOverlayPipelineGuards({
        overlayRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
        legacyEndpoint: true,
        motionReferenced: false,
        downstreamRequested: false,
        humanReviewPresent: true,
        providerCalls: 0,
      }),
    /legacy/i,
  );
  assert.throws(
    () =>
      buildPhase11ARoleImageStoragePath({
        workspaceId: WS,
        projectId: MV001_MOTION_PROJECT_ID,
        assetId: PARENT_ID,
        role: "composed",
      }),
    /Motion/,
  );

  const prep = preparePhase11AScene2TextFreeRevision({
    locale: "fr-FR",
    title: "Épargnez l'énergie",
    callToAction: "S'inscrire",
  });
  assert.equal(prep.execute, false);
  assert.equal(prep.reuseRejectedAsFinal, false);
  assert.equal(prep.automaticRetryFromReject, false);
  assert.equal(prep.newProviderAuthRequired, true);
  assert.equal(prep.rejectedAssetIdPrefix, "5d68ef64");
  assert.equal(prep.overlayRuntime, "WIRED_DISABLED");
});
