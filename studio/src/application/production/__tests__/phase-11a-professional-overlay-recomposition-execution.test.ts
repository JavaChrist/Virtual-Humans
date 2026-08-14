/**
 * Phase 11A professional overlay recomposition execution — local guards only.
 * No Production media. No provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createPhase11AProfessionalOverlaySpec } from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "../phase-11a-strip-overlay-copy-dry-run";
import { PHASE_11A_COMPOSITOR_VERSION } from "../phase-11a-deterministic-compositor";
import { PHASE_11A_VECTOR_COMPOSITOR_VERSION } from "../phase-11a-vector-compositor";
import {
  PHASE_11A_VECTOR_FONT_FAMILY,
  PHASE_11A_VECTOR_FONT_ID,
  PHASE_11A_VECTOR_FONT_LICENSE,
} from "../phase-11a-overlay-latin-vector";
import {
  PHASE_11A_CONTRAST_PANEL_VERSION,
  PHASE_11A_LAYOUT_VERSION,
} from "../phase-11a-overlay-layout-1-2";
import { fingerprintImageTextOverlaySpec } from "@/domain/production/image-text-overlay";
import {
  composedAssetIdFromFingerprint,
  fingerprintPhase11AComposedAsset,
} from "../phase-11a-composed-ingest";
import {
  buildPhase11AComposedProductionResult,
  buildPhase11AComposedQualityReport,
  buildPhase11AComposedReviewRequestId,
} from "../phase-11a-composed-execution-scaffold";
import { assertPhase11APayloadHasNoMediaLeak } from "../phase-11a-human-review-reject";
import { assertPhase11AOverlayPipelineGuards } from "../phase-11a-overlay-review";
import { PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME } from "../phase-11a-deterministic-compositor";
import {
  assertPhase11AProfessionalExecutionReportRedacted,
  assertPhase11AProfessionalExpectedRender,
  assertPhase11AProfessionalRecompositionConfirm,
  assertPhase11AProfessionalRuntimeVersions,
  PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT_SHORT,
  PHASE_11A_PROFESSIONAL_EXPECTED_ASSET_PREFIX,
  PHASE_11A_PROFESSIONAL_EXPECTED_BYTES,
  PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM,
  PHASE_11A_PROFESSIONAL_EXPECTED_CONTRAST,
  PHASE_11A_PROFESSIONAL_EXPECTED_FINGERPRINT_PREFIX,
  PHASE_11A_PROFESSIONAL_EXPECTED_OVERLAY_FP_PREFIX,
  PHASE_11A_PROFESSIONAL_PREFLIGHT_DOCS_COMMIT_SHORT,
  PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION,
  PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
  PHASE_11A_PROFESSIONAL_RECOMPOSITION_CONFIRM_ENV,
} from "../phase-11a-professional-overlay-recomposition-execution";

test("11A-1.2.0 execution — source versions isolated from 1.1.0 and docs commit", () => {
  assertPhase11AProfessionalRuntimeVersions({
    fontFamily: PHASE_11A_VECTOR_FONT_FAMILY,
    fontId: PHASE_11A_VECTOR_FONT_ID,
    fontLicense: PHASE_11A_VECTOR_FONT_LICENSE,
    compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
    layoutVersion: PHASE_11A_LAYOUT_VERSION,
    panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
    bitmapCompositorVersion: PHASE_11A_COMPOSITOR_VERSION,
  });
  assert.equal(PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT_SHORT, "d395ec7");
  assert.equal(PHASE_11A_PROFESSIONAL_PREFLIGHT_DOCS_COMMIT_SHORT, "e94850c");
  assert.equal(PHASE_11A_COMPOSITOR_VERSION, "phase-11a-bitmap-compositor-1.1.0");
  assert.notEqual(PHASE_11A_VECTOR_COMPOSITOR_VERSION, PHASE_11A_COMPOSITOR_VERSION);
});

test("11A-1.2.0 execution — copy exact, confirm gate, expected render, redaction", () => {
  const spec = createPhase11AProfessionalOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: PHASE_11A_SCENE2_OVERLAY_TITLE,
    callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
  });
  assert.equal(spec.title, "De l’idée à la structure");
  assert.equal(spec.title.includes("\u2019"), true);
  assert.equal(spec.callToAction, "Découvrir Virtual Humans Studio");
  assert.equal(spec.fontFamily, "vhs-overlay-latin-vector-v1");
  assert.equal(spec.fontSize, 40);
  const overlayFp = fingerprintImageTextOverlaySpec(spec);
  assert.equal(overlayFp.startsWith(PHASE_11A_PROFESSIONAL_EXPECTED_OVERLAY_FP_PREFIX), true);
  assert.throws(() => assertPhase11AProfessionalRecompositionConfirm({}), /CONFIRM_PHASE_11A_PROFESSIONAL/);
  assert.throws(
    () =>
      assertPhase11AProfessionalRecompositionConfirm({
        [PHASE_11A_PROFESSIONAL_RECOMPOSITION_CONFIRM_ENV]: "1",
        PHASE_11A_ALLOW_EXECUTE: "1",
      }),
    /PHASE_11A_ALLOW_EXECUTE/,
  );
  assertPhase11AProfessionalRecompositionConfirm({
    [PHASE_11A_PROFESSIONAL_RECOMPOSITION_CONFIRM_ENV]: "1",
  });
  assertPhase11AProfessionalExpectedRender({
    checksumSha256: PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM,
    byteLength: PHASE_11A_PROFESSIONAL_EXPECTED_BYTES,
    width: 1024,
    height: 1024,
    fingerprint: `${PHASE_11A_PROFESSIONAL_EXPECTED_FINGERPRINT_PREFIX}${"0".repeat(48)}`,
    assetId: `${PHASE_11A_PROFESSIONAL_EXPECTED_ASSET_PREFIX}-aaaa-4bbb-8ccc-dddddddddddd`,
    overlayFingerprint: overlayFp,
    contrastRatio: PHASE_11A_PROFESSIONAL_EXPECTED_CONTRAST,
    titleFontSize: 40,
    ctaFontSize: 22,
    titleLineCount: 1,
    ctaLineCount: 1,
  });
  assert.throws(
    () =>
      assertPhase11AProfessionalExpectedRender({
        checksumSha256: "0".repeat(64),
        byteLength: PHASE_11A_PROFESSIONAL_EXPECTED_BYTES,
        width: 1024,
        height: 1024,
        fingerprint: `${PHASE_11A_PROFESSIONAL_EXPECTED_FINGERPRINT_PREFIX}${"0".repeat(48)}`,
        assetId: `${PHASE_11A_PROFESSIONAL_EXPECTED_ASSET_PREFIX}-aaaa-4bbb-8ccc-dddddddddddd`,
        overlayFingerprint: overlayFp,
        contrastRatio: PHASE_11A_PROFESSIONAL_EXPECTED_CONTRAST,
        titleFontSize: 40,
        ctaFontSize: 22,
        titleLineCount: 1,
        ctaLineCount: 1,
      }),
    /checksum/,
  );
  assert.throws(
    () => assertPhase11AProfessionalExecutionReportRedacted("see https://example.com"),
    /leak/,
  );
  assertPhase11AProfessionalExecutionReportRedacted(
    JSON.stringify({ checksum: PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM, path: "{workspaceId}/{projectId}" }),
  );
});

test("11A-1.2.0 execution — professional QC/PR seed has no decision and distinct HR id", () => {
  const facts = {
    qualityReportId: "33333333-3333-4333-8333-333333333333",
    productionResultId: "44444444-4444-4444-8444-444444444444",
    projectId: "984507af-a89e-4644-8ea3-344797baa974",
    createdBy: "phase-11a-professional-recomposition",
    correlationId: "corr-11a-professional-recomposition",
    nowIso: "2026-08-14T19:40:00.000Z",
    runId: "39329a01-aaaa-4bbb-8ccc-dddddddddddd",
    jobId: "edc6e84a-aaaa-4bbb-8ccc-dddddddddddd",
    parentAssetId: "7832765d-aaaa-4bbb-8ccc-dddddddddddd",
    composedAssetId: "49284892-aaaa-4bbb-8ccc-dddddddddddd",
    composedChecksumSha256: PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM,
    composedByteLength: PHASE_11A_PROFESSIONAL_EXPECTED_BYTES,
    overlayFingerprint: `${PHASE_11A_PROFESSIONAL_EXPECTED_OVERLAY_FP_PREFIX}${"0".repeat(48)}`,
    compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
    generationPlanArtifactId: "a55bd426-aaaa-4bbb-8ccc-dddddddddddd",
    estimatedCostMinor: 1,
    committedCostMinor: 1,
    typographicStatus: "accepted" as const,
    contrastRatio: PHASE_11A_PROFESSIONAL_EXPECTED_CONTRAST,
    fontFamily: PHASE_11A_VECTOR_FONT_FAMILY,
    fontId: PHASE_11A_VECTOR_FONT_ID,
    layoutVersion: PHASE_11A_LAYOUT_VERSION,
    panelVersion: PHASE_11A_CONTRAST_PANEL_VERSION,
    titleFontSize: 40,
    ctaFontSize: 22,
    titleLineCount: 1,
    ctaLineCount: 1,
    preflightVisualDecision: PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION,
    reviewAuth: PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
  };
  const qr = buildPhase11AComposedQualityReport(facts);
  const pr = buildPhase11AComposedProductionResult(facts);
  assert.equal(qr.humanReviewDecision, null);
  assert.equal(qr.ocr, "unavailable_humanOnly");
  assert.equal((pr as { phase11a?: { humanReviewDecision: null } }).phase11a?.humanReviewDecision, null);
  assert.equal(
    (pr as { phase11a?: { preflightVisualDecision?: string } }).phase11a?.preflightVisualDecision,
    "ACCEPT_PREFLIGHT_VISUAL",
  );
  const checks = qr.typographicChecks as Array<{ code: string; passed: boolean }>;
  assert.equal(checks.some((c) => c.code === "font_family" && c.passed), true);
  assert.equal(checks.some((c) => c.code === "title_one_line" && c.passed), true);
  assert.equal(checks.some((c) => c.code === "preflight_visual_context" && c.passed), true);
  const a = buildPhase11AComposedReviewRequestId({
    projectId: facts.projectId,
    composedAssetId: facts.composedAssetId,
    auth: PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH,
  });
  const legacy = buildPhase11AComposedReviewRequestId({
    projectId: facts.projectId,
    composedAssetId: facts.composedAssetId,
  });
  assert.notEqual(a, legacy);
  assert.match(a, /^11a-compose-hr-[a-f0-9]{24}$/);
  assertPhase11APayloadHasNoMediaLeak(qr);
  assertPhase11APayloadHasNoMediaLeak(pr);
});

test("11A-1.2.0 execution — compositor version changes identity vs 1.1.0", () => {
  const spec = createPhase11AProfessionalOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: PHASE_11A_SCENE2_OVERLAY_TITLE,
    callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
  });
  const parent = "1ac51f484420ef88".padEnd(64, "0");
  const fp12 = fingerprintPhase11AComposedAsset({
    parentChecksumSha256: parent,
    overlay: spec,
    compositorVersion: PHASE_11A_VECTOR_COMPOSITOR_VERSION,
  });
  const fp11 = fingerprintPhase11AComposedAsset({
    parentChecksumSha256: parent,
    overlay: spec,
    compositorVersion: PHASE_11A_COMPOSITOR_VERSION,
  });
  assert.notEqual(fp12, fp11);
  const id12 = composedAssetIdFromFingerprint(fp12);
  const id11 = composedAssetIdFromFingerprint(fp11);
  assert.notEqual(id12.slice(0, 8), id11.slice(0, 8));
  assert.notEqual(id12.slice(0, 8), "4429654f");
  assert.notEqual(id12.slice(0, 8), "6a2beca9");
  assertPhase11AOverlayPipelineGuards({
    overlayRuntime: PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
    legacyEndpoint: false,
    motionReferenced: false,
    downstreamRequested: false,
    humanReviewPresent: true,
    providerCalls: 0,
  });
});
