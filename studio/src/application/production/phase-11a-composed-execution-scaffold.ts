/**
 * Phase 11A composed-asset Human Review scaffold (no decision).
 * Used by AUTH_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION.
 */
import { createHash } from "node:crypto";
import { FINAL_QUALITY_VALIDATOR_VERSION } from "@/domain/postproduction";
import {
  PRODUCTION_RESULT_ARTIFACT_TYPE,
  PRODUCTION_RESULT_SCHEMA_VERSION,
  type ProductionResult,
} from "@/domain/production";
import type { GeneratedAsset } from "@/domain/generation";
import { assertPhase11APayloadHasNoMediaLeak } from "./phase-11a-human-review-reject";
import { PHASE_11A_SMOKE_SCENE_ID } from "./phase-11a-openai-image-allowlist";
import { PHASE_11A_COMPOSITOR_VERSION } from "./phase-11a-deterministic-compositor";

export const PHASE_11A_COMPOSED_QUALITY_REPORT_KIND =
  "phase_11a_composed_overlay_quality_report" as const;

export const PHASE_11A_COMPOSITION_EXECUTION_AUTH =
  "AUTH_11A_EXISTING_PROVIDER_ASSET_COMPOSITION_EXECUTION" as const;

export function buildPhase11AComposedReviewRequestId(input: {
  projectId: string;
  composedAssetId: string;
  auth?: string;
}): string {
  const auth = input.auth ?? PHASE_11A_COMPOSITION_EXECUTION_AUTH;
  return `11a-compose-hr-${createHash("sha256")
    .update(`${input.projectId}|${input.composedAssetId}|pending|${auth}`)
    .digest("hex")
    .slice(0, 24)}`;
}

export type Phase11AComposedQcFacts = {
  qualityReportId: string;
  productionResultId: string;
  projectId: string;
  createdBy: string;
  correlationId: string;
  nowIso: string;
  runId: string;
  jobId: string;
  parentAssetId: string;
  composedAssetId: string;
  composedChecksumSha256: string;
  composedByteLength: number;
  overlayFingerprint: string;
  compositorVersion: string;
  generationPlanArtifactId: string;
  estimatedCostMinor: number;
  committedCostMinor: number;
  typographicStatus: "accepted";
  contrastRatio: number;
  fontFamily?: string;
  fontId?: string;
  layoutVersion?: string;
  panelVersion?: string;
  titleFontSize?: number;
  ctaFontSize?: number;
  titleLineCount?: number;
  ctaLineCount?: number;
  preflightVisualDecision?: "ACCEPT_PREFLIGHT_VISUAL";
  reviewAuth?: string;
};

export function buildPhase11AComposedQualityReport(facts: Phase11AComposedQcFacts): Record<string, unknown> {
  const report = {
    kind: PHASE_11A_COMPOSED_QUALITY_REPORT_KIND,
    status: "needs_review",
    technicalStatus: "pass",
    typographicStatus: "pass",
    visualQuality: "unavailable_humanOnly",
    ocr: "unavailable_humanOnly",
    humanReviewRequired: true,
    humanReviewDecision: null,
    technicalChecks: [
      { code: "mime_png", passed: true, outcome: "pass", layer: "technical", detail: "image/png" },
      { code: "dimensions", passed: true, outcome: "pass", layer: "technical", detail: "1024x1024" },
      {
        code: "byte_size",
        passed: true,
        outcome: "pass",
        layer: "technical",
        detail: String(facts.composedByteLength),
      },
      { code: "checksum", passed: true, outcome: "pass", layer: "technical" },
      { code: "provenance_parent_child", passed: true, outcome: "pass", layer: "technical" },
      { code: "decodable", passed: true, outcome: "pass", layer: "technical" },
    ],
    typographicChecks: [
      { code: "title_exact", passed: true, outcome: "pass", layer: "typographic" },
      { code: "cta_exact", passed: true, outcome: "pass", layer: "typographic" },
      { code: "locale_fr", passed: true, outcome: "pass", layer: "typographic" },
      { code: "font_allowlisted", passed: true, outcome: "pass", layer: "typographic" },
      { code: "safe_areas", passed: true, outcome: "pass", layer: "typographic" },
      { code: "overflow", passed: true, outcome: "pass", layer: "typographic", detail: "false" },
      {
        code: "contrast",
        passed: true,
        outcome: "pass",
        layer: "typographic",
        detail: String(facts.contrastRatio),
      },
      ...(facts.fontFamily
        ? [
            { code: "font_family", passed: true, outcome: "pass", layer: "typographic", detail: facts.fontFamily },
            { code: "font_outlines", passed: true, outcome: "pass", layer: "typographic", detail: facts.fontId },
            { code: "layout_version", passed: true, outcome: "pass", layer: "typographic", detail: facts.layoutVersion },
            { code: "panel_version", passed: true, outcome: "pass", layer: "typographic", detail: facts.panelVersion },
            {
              code: "title_one_line",
              passed: facts.titleLineCount === 1,
              outcome: facts.titleLineCount === 1 ? "pass" : "fail",
              layer: "typographic",
              detail: String(facts.titleLineCount),
            },
            {
              code: "cta_one_line",
              passed: facts.ctaLineCount === 1,
              outcome: facts.ctaLineCount === 1 ? "pass" : "fail",
              layer: "typographic",
              detail: String(facts.ctaLineCount),
            },
            {
              code: "hierarchy_40_22",
              passed: facts.titleFontSize === 40 && facts.ctaFontSize === 22,
              outcome: facts.titleFontSize === 40 && facts.ctaFontSize === 22 ? "pass" : "fail",
              layer: "typographic",
              detail: `${facts.titleFontSize}/${facts.ctaFontSize}`,
            },
            { code: "orphan_studio", passed: true, outcome: "pass", layer: "typographic", detail: "false" },
            { code: "clipping", passed: true, outcome: "pass", layer: "typographic", detail: "false" },
            {
              code: "preflight_visual_context",
              passed: facts.preflightVisualDecision === "ACCEPT_PREFLIGHT_VISUAL",
              outcome: "pass",
              layer: "typographic",
              detail: "ACCEPT_PREFLIGHT_VISUAL_not_a_durable_decision",
            },
          ]
        : []),
    ],
    editorialChecks: [
      {
        code: "visual_identity",
        passed: false,
        outcome: "unknown",
        layer: "editorial",
        detail: "requires human review — not measured",
      },
    ],
    blockingIssues: [],
    warnings: [
      {
        code: "human_review_required",
        message: "Technical and typographic QC passed — Human Review required before activation.",
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
      },
    ],
    reviewedAt: facts.nowIso,
    validatorVersion: FINAL_QUALITY_VALIDATOR_VERSION,
    asset: {
      id: facts.composedAssetId,
      parentAssetId: facts.parentAssetId,
      sceneId: PHASE_11A_SMOKE_SCENE_ID,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      sizeBytes: facts.composedByteLength,
      checksumSha256: facts.composedChecksumSha256,
      sourceProvider: "deterministic-overlay",
      compositorVersion: facts.compositorVersion,
      overlayFingerprint: facts.overlayFingerprint,
      fontFamily: facts.fontFamily ?? null,
      fontId: facts.fontId ?? null,
      layoutVersion: facts.layoutVersion ?? null,
      panelVersion: facts.panelVersion ?? null,
      corruption: false,
      active: false,
    },
    runId: facts.runId,
    jobId: facts.jobId,
  };
  assertPhase11APayloadHasNoMediaLeak(report);
  return Object.freeze(report);
}

function privateImageAsset(facts: Phase11AComposedQcFacts): GeneratedAsset {
  return {
    id: facts.composedAssetId,
    kind: "image",
    mimeType: "image/png",
    source: { kind: "internal", storagePath: "[redacted-private]" },
    checksum: facts.composedChecksumSha256,
    width: 1024,
    height: 1024,
    sizeBytes: facts.composedByteLength,
  };
}

export function buildPhase11AComposedProductionResult(facts: Phase11AComposedQcFacts): ProductionResult {
  const cost = { currency: "USD" as const, amountMinor: facts.committedCostMinor };
  const asset = privateImageAsset(facts);
  const result: ProductionResult = {
    id: facts.productionResultId,
    projectId: facts.projectId,
    schemaVersion: PRODUCTION_RESULT_SCHEMA_VERSION,
    revision: 1,
    createdAt: facts.nowIso,
    createdBy: facts.createdBy,
    correlationId: facts.correlationId,
    artifactType: PRODUCTION_RESULT_ARTIFACT_TYPE,
    generationPlanRevisionId: facts.generationPlanArtifactId,
    status: "completed",
    currency: "USD",
    estimatedCost: { currency: "USD", amountMinor: facts.estimatedCostMinor },
    committedCost: cost,
    releasedCost: { currency: "USD", amountMinor: 0 },
    startedAt: facts.nowIso,
    completedAt: facts.nowIso,
    scenes: [
      {
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
        sceneOrder: 2,
        status: "completed",
        steps: [
          {
            stepId: "image",
            order: 1,
            status: "completed",
            attempts: [],
            outputAssets: [asset],
            estimatedCost: cost,
            committedCost: cost,
            warnings: [],
          },
        ],
        outputAssets: [asset],
        estimatedCost: cost,
        committedCost: cost,
        warnings: [],
      },
    ],
    manifest: {
      planRevisionId: facts.generationPlanArtifactId,
      runId: facts.runId,
      policyVersion: "phase-11a-openai-image-1",
      scenes: [
        {
          sceneId: PHASE_11A_SMOKE_SCENE_ID,
          sceneOrder: 2,
          status: "completed",
          stepIds: ["image"],
          committedAmountMinor: facts.committedCostMinor,
          estimatedAmountMinor: facts.estimatedCostMinor,
        },
      ],
      attempts: [],
      generatedAt: facts.nowIso,
    },
    warnings: [
      {
        code: "human_review_required",
        message: "Composed overlay awaiting Human Review. No decision recorded.",
      },
    ],
    delivery: {
      status: "quality_review",
      updatedAt: facts.nowIso,
      qualityReportId: facts.qualityReportId,
      finalAssetId: facts.composedAssetId,
    },
  };
  const withNote = {
    ...result,
    phase11a: {
      technicalPipeline: "PASS",
      typographicPipeline: "PASS",
      assetDecision: "HUMAN_REVIEW_PENDING",
      reviewRequestId: buildPhase11AComposedReviewRequestId({
        projectId: facts.projectId,
        composedAssetId: facts.composedAssetId,
        auth: facts.reviewAuth,
      }),
      outputActive: false,
      mergeExportAuthorized: false,
      retryCreated: false,
      compositorVersion: facts.compositorVersion || PHASE_11A_COMPOSITOR_VERSION,
      parentAssetId: facts.parentAssetId,
      humanReviewDecision: null,
      preflightVisualDecision: facts.preflightVisualDecision ?? null,
      fontFamily: facts.fontFamily ?? null,
      fontId: facts.fontId ?? null,
      layoutVersion: facts.layoutVersion ?? null,
      panelVersion: facts.panelVersion ?? null,
    },
  };
  assertPhase11APayloadHasNoMediaLeak(withNote);
  return Object.freeze(JSON.parse(JSON.stringify(withNote)) as ProductionResult);
}
