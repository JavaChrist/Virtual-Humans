import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPhase11AComposedProductionResult,
  buildPhase11AComposedQualityReport,
  buildPhase11AComposedReviewRequestId,
  PHASE_11A_COMPOSED_QUALITY_REPORT_KIND,
  PHASE_11A_COMPOSITION_EXECUTION_AUTH,
} from "../phase-11a-composed-execution-scaffold";
import { assertPhase11APayloadHasNoMediaLeak } from "../phase-11a-human-review-reject";
import { fingerprintPhase11AComposedAsset } from "../phase-11a-composed-ingest";
import { createDefaultPhase11AOverlaySpec } from "@/domain/production/image-text-overlay";
import {
  PHASE_11A_SCENE2_OVERLAY_CTA,
  PHASE_11A_SCENE2_OVERLAY_LOCALE,
  PHASE_11A_SCENE2_OVERLAY_TITLE,
} from "../phase-11a-strip-overlay-copy-dry-run";

const facts = {
  qualityReportId: "11111111-1111-4111-8111-111111111111",
  productionResultId: "22222222-2222-4222-8222-222222222222",
  projectId: "984507af-a89e-4644-8ea3-344797baa974",
  createdBy: "phase-11a-compose-execution",
  correlationId: "corr-11a-compose-execution",
  nowIso: "2026-08-14T13:30:00.000Z",
  runId: "39329a01-aaaa-4bbb-8ccc-dddddddddddd",
  jobId: "edc6e84a-aaaa-4bbb-8ccc-dddddddddddd",
  parentAssetId: "7832765d-aaaa-4bbb-8ccc-dddddddddddd",
  composedAssetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  composedChecksumSha256: "d056b85aa4f9452d0123456789abcdef0123456789abcdef0123456789abcdef",
  composedByteLength: 1_310_249,
  overlayFingerprint: "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9",
  compositorVersion: "phase-11a-bitmap-compositor-1.0.0",
  generationPlanArtifactId: "a55bd426-aaaa-4bbb-8ccc-dddddddddddd",
  estimatedCostMinor: 1,
  committedCostMinor: 1,
  typographicStatus: "accepted" as const,
  contrastRatio: 15.006,
};

test("11A-COMPOSE-EXEC — QC and PR scaffolds have no media leak and no decision", () => {
  const qr = buildPhase11AComposedQualityReport(facts);
  const pr = buildPhase11AComposedProductionResult(facts);
  assert.equal(qr.kind, PHASE_11A_COMPOSED_QUALITY_REPORT_KIND);
  assert.equal(qr.humanReviewDecision, null);
  assert.equal(qr.technicalStatus, "pass");
  assert.equal(qr.typographicStatus, "pass");
  assert.equal(qr.ocr, "unavailable_humanOnly");
  assert.equal(pr.delivery?.status, "quality_review");
  assert.equal((pr as { phase11a?: { humanReviewDecision: null } }).phase11a?.humanReviewDecision, null);
  assertPhase11APayloadHasNoMediaLeak(qr);
  assertPhase11APayloadHasNoMediaLeak(pr);
  const blob = JSON.stringify({ qr, pr });
  assert.equal(/https?:\/\//i.test(blob), false);
  assert.equal(/data:image\//i.test(blob), false);
});

test("11A-COMPOSE-EXEC — review request and composed identity are deterministic", () => {
  const a = buildPhase11AComposedReviewRequestId({
    projectId: facts.projectId,
    composedAssetId: facts.composedAssetId,
  });
  const b = buildPhase11AComposedReviewRequestId({
    projectId: facts.projectId,
    composedAssetId: facts.composedAssetId,
  });
  assert.equal(a, b);
  assert.match(a, /^11a-compose-hr-[a-f0-9]{24}$/);
  const spec = createDefaultPhase11AOverlaySpec({
    locale: PHASE_11A_SCENE2_OVERLAY_LOCALE,
    title: PHASE_11A_SCENE2_OVERLAY_TITLE,
    callToAction: PHASE_11A_SCENE2_OVERLAY_CTA,
  });
  const fp1 = fingerprintPhase11AComposedAsset({
    parentChecksumSha256: "1ac51f484420ef88".padEnd(64, "0"),
    overlay: spec,
    compositorVersion: "phase-11a-bitmap-compositor-1.0.0",
  });
  const fp2 = fingerprintPhase11AComposedAsset({
    parentChecksumSha256: "1ac51f484420ef88".padEnd(64, "0"),
    overlay: spec,
    compositorVersion: "phase-11a-bitmap-compositor-1.0.0",
  });
  assert.equal(fp1, fp2);
  assert.equal(PHASE_11A_COMPOSITION_EXECUTION_AUTH, "AUTH_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION");
});
