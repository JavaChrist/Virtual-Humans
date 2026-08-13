/**
 * Phase 11A — persist Human Review REJECT without regeneration.
 * Scaffold + decision builders are pure; no provider / Storage / ledger writes here.
 */

import { createHash } from "node:crypto";
import {
  FINAL_QUALITY_VALIDATOR_VERSION,
  type FinalQualityReport,
} from "@/domain/postproduction";
import {
  assertDeliveryTransition,
  PRODUCTION_RESULT_ARTIFACT_TYPE,
  PRODUCTION_RESULT_SCHEMA_VERSION,
  withDeliveryUpdate,
  type ProductionResult,
} from "@/domain/production";
import type { GeneratedAsset } from "@/domain/generation";
import {
  PHASE_11A_SMOKE_MODEL,
  PHASE_11A_SMOKE_PROVIDER,
  PHASE_11A_SMOKE_QUALITY,
  PHASE_11A_SMOKE_SCENE_ID,
  PHASE_11A_SMOKE_SIZE,
} from "./phase-11a-openai-image-allowlist";
import { assertPhase11ARejectedBlocksActivationAndDownstream } from "./phase-11a-human-review-gate";

export const PHASE_11A_HR_REJECT_AUTH =
  "AUTH_11A_HUMAN_REVIEW_REJECT_ONCE_NO_REGENERATE" as const;

export const PHASE_11A_HR_REJECT_COMMENT =
  "Le titre principal et la composition sont corrects, mais le faux texte illisible dans le bouton inférieur rend l’image inutilisable. Pipeline techniquement validé, asset rejeté." as const;

export const PHASE_11A_HR_REJECT_ISSUE_CODE =
  "human.illegible_invented_button_text" as const;

export const PHASE_11A_QUALITY_REPORT_KIND =
  "phase_11a_openai_image_quality_report" as const;

export type Phase11ARequestedDecision = "rejected";

export type Phase11AScaffoldArtifact = {
  id: string;
  revision: number;
  value: Record<string, unknown>;
};

export type Phase11AScaffoldAuditInput = {
  qualityReports: Phase11AScaffoldArtifact[];
  productionResults: Phase11AScaffoldArtifact[];
  expectedRunId: string;
  expectedAssetId: string;
  expectedSceneId: string;
};

export type Phase11AScaffoldAudit =
  | { status: "create_both" }
  | { status: "create_qr"; productionResult: Phase11AScaffoldArtifact }
  | { status: "create_pr"; qualityReport: Phase11AScaffoldArtifact }
  | {
      status: "reuse";
      qualityReport: Phase11AScaffoldArtifact;
      productionResult: Phase11AScaffoldArtifact;
    }
  | { status: "inconsistent"; reason: string };

export type Phase11AQualityReportValue = FinalQualityReport & {
  kind: typeof PHASE_11A_QUALITY_REPORT_KIND;
  technicalStatus: "pass";
  visualQuality: "unavailable_humanOnly";
  humanReviewRequired: true;
  humanObservedDefect: {
    code: typeof PHASE_11A_HR_REJECT_ISSUE_CODE;
    layer: "editorial";
    measuredAutomatically: false;
    summary: string;
  };
  asset: {
    id: string;
    sceneId: string;
    mimeType: "image/png";
    width: 1024;
    height: 1024;
    sizeBytes: number;
    checksumSha256: string;
    sourceProvider: typeof PHASE_11A_SMOKE_PROVIDER;
    sourceModel: typeof PHASE_11A_SMOKE_MODEL;
    quality: typeof PHASE_11A_SMOKE_QUALITY;
    corruption: false;
    active: false;
  };
  runId: string;
  jobId: string;
  attemptId: string;
};

export type Phase11ARejectFacts = {
  qualityReportId: string;
  productionResultId: string;
  projectId: string;
  createdBy: string;
  correlationId: string;
  nowIso: string;
  runId: string;
  jobId: string;
  attemptId: string;
  assetId: string;
  generationPlanArtifactId: string;
  checksumSha256: string;
  sizeBytes: number;
  estimatedCostMinor: number;
  committedCostMinor: number;
};

export type Phase11ARejectMemoryStore = {
  qualityReports: Phase11AScaffoldArtifact[];
  productionResults: Phase11AScaffoldArtifact[];
  decisions: Array<{
    id: string;
    decision: string;
    idempotencyKey: string;
    reviewRequestId: string;
    productionResultRevision: number;
  }>;
  jobsCreated: number;
  retriesCreated: number;
  ledgerWrites: number;
  storageWrites: number;
  providerCalls: number;
  asset: { id: string; status: string; active: boolean };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertPhase11ARequestedDecisionIsReject(
  decision: string,
): asserts decision is Phase11ARequestedDecision {
  if (decision !== "rejected") {
    throw new Error(
      `BLOCKED_DECISION_CONFLICT: requested decision must be rejected, got ${decision}`,
    );
  }
}

export function buildPhase11ARejectReviewRequestId(input: {
  projectId: string;
  assetId: string;
}): string {
  const digest = createHash("sha256")
    .update(
      `${input.projectId}|${input.assetId}|rejected|${PHASE_11A_HR_REJECT_AUTH}`,
    )
    .digest("hex")
    .slice(0, 24);
  return `11a-hr-reject-${digest}`;
}

export function phase11ARejectIdempotencyKey(reviewRequestId: string): string {
  return `hr-decision:${reviewRequestId}`;
}

export function assertPhase11APayloadHasNoMediaLeak(value: unknown): void {
  const blob = JSON.stringify(value);
  if (/https:\/\//i.test(blob) || /X-Amz-/i.test(blob)) {
    throw new Error("Phase 11A: persisted payload must not contain URLs.");
  }
  if (/data:image\//i.test(blob) || /data:application\//i.test(blob)) {
    throw new Error("Phase 11A: persisted payload must not contain data URLs.");
  }
  if (/"dataUrl"\s*:/i.test(blob) && !/\[redacted\]/.test(blob)) {
    throw new Error("Phase 11A: persisted payload must not contain dataUrl.");
  }
  if (/(?:[A-Za-z0-9+/]{80,}={0,2})/.test(blob) && /base64/i.test(blob)) {
    throw new Error("Phase 11A: persisted payload must not contain base64.");
  }
}

function qrCompatible(
  artifact: Phase11AScaffoldArtifact,
  expectedAssetId: string,
): boolean {
  const v = artifact.value;
  if (v.kind !== PHASE_11A_QUALITY_REPORT_KIND) return false;
  if (v.status !== "needs_review") return false;
  if (v.technicalStatus !== "pass") return false;
  if (v.visualQuality !== "unavailable_humanOnly") return false;
  const asset = isRecord(v.asset) ? v.asset : null;
  if (!asset || asset.id !== expectedAssetId) return false;
  if (asset.active === true) return false;
  try {
    assertPhase11APayloadHasNoMediaLeak(v);
  } catch {
    return false;
  }
  return true;
}

function prCompatible(
  artifact: Phase11AScaffoldArtifact,
  expected: { runId: string; assetId: string; sceneId: string },
): boolean {
  const v = artifact.value;
  if (v.artifactType !== PRODUCTION_RESULT_ARTIFACT_TYPE) return false;
  const manifest = isRecord(v.manifest) ? v.manifest : null;
  if (!manifest || manifest.runId !== expected.runId) return false;
  const scenes = Array.isArray(v.scenes) ? v.scenes : [];
  const scene = isRecord(scenes[0]) ? scenes[0] : null;
  if (!scene || scene.sceneId !== expected.sceneId) return false;
  const delivery = isRecord(v.delivery) ? v.delivery : null;
  const deliveryStatus = typeof delivery?.status === "string" ? delivery.status : "";
  if (
    deliveryStatus === "merge_ready" ||
    deliveryStatus === "merged" ||
    deliveryStatus === "delivered" ||
    deliveryStatus === "export_ready"
  ) {
    return false;
  }
  const blob = JSON.stringify(v);
  if (!blob.includes(expected.assetId)) return false;
  try {
    assertPhase11APayloadHasNoMediaLeak(v);
  } catch {
    return false;
  }
  return true;
}

export function auditPhase11AReviewScaffold(
  input: Phase11AScaffoldAuditInput,
): Phase11AScaffoldAudit {
  if (input.qualityReports.length > 1 || input.productionResults.length > 1) {
    return { status: "inconsistent", reason: "duplicate_delivery_artifacts" };
  }
  const qr = input.qualityReports[0];
  const pr = input.productionResults[0];
  if (qr && !qrCompatible(qr, input.expectedAssetId)) {
    return { status: "inconsistent", reason: "quality_report_scope_mismatch" };
  }
  if (
    pr &&
    !prCompatible(pr, {
      runId: input.expectedRunId,
      assetId: input.expectedAssetId,
      sceneId: input.expectedSceneId,
    })
  ) {
    return { status: "inconsistent", reason: "production_result_scope_mismatch" };
  }
  if (!qr && !pr) return { status: "create_both" };
  if (!qr && pr) return { status: "create_qr", productionResult: pr };
  if (qr && !pr) return { status: "create_pr", qualityReport: qr };
  return { status: "reuse", qualityReport: qr!, productionResult: pr! };
}

export function buildPhase11AMinimalQualityReport(
  facts: Phase11ARejectFacts,
): Phase11AQualityReportValue {
  const report: Phase11AQualityReportValue = {
    kind: PHASE_11A_QUALITY_REPORT_KIND,
    status: "needs_review",
    technicalStatus: "pass",
    visualQuality: "unavailable_humanOnly",
    humanReviewRequired: true,
    humanObservedDefect: {
      code: PHASE_11A_HR_REJECT_ISSUE_CODE,
      layer: "editorial",
      measuredAutomatically: false,
      summary: "Illegible invented text on the lower button.",
    },
    technicalChecks: [
      { code: "mime_png", passed: true, outcome: "pass", layer: "technical", detail: "image/png" },
      {
        code: "dimensions",
        passed: true,
        outcome: "pass",
        layer: "technical",
        detail: PHASE_11A_SMOKE_SIZE,
      },
      {
        code: "byte_size",
        passed: true,
        outcome: "pass",
        layer: "technical",
        detail: String(facts.sizeBytes),
      },
      { code: "checksum", passed: true, outcome: "pass", layer: "technical" },
      { code: "provenance", passed: true, outcome: "pass", layer: "technical" },
      { code: "corruption", passed: true, outcome: "pass", layer: "technical", detail: "none" },
      {
        code: "visual_auto",
        passed: true,
        outcome: "needs_review",
        layer: "technical",
        detail: "unavailable_humanOnly",
      },
    ],
    contractualChecks: [
      { code: "execution_terminal", passed: true, outcome: "pass", layer: "contractual" },
      { code: "single_submit", passed: true, outcome: "pass", layer: "contractual", detail: "openai" },
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
        message: "Technical QC passed — Human Review required before activation.",
        sceneId: PHASE_11A_SMOKE_SCENE_ID,
      },
    ],
    reviewedAt: facts.nowIso,
    validatorVersion: FINAL_QUALITY_VALIDATOR_VERSION,
    asset: {
      id: facts.assetId,
      sceneId: PHASE_11A_SMOKE_SCENE_ID,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      sizeBytes: facts.sizeBytes,
      checksumSha256: facts.checksumSha256,
      sourceProvider: PHASE_11A_SMOKE_PROVIDER,
      sourceModel: PHASE_11A_SMOKE_MODEL,
      quality: PHASE_11A_SMOKE_QUALITY,
      corruption: false,
      active: false,
    },
    runId: facts.runId,
    jobId: facts.jobId,
    attemptId: facts.attemptId,
  };
  assertPhase11APayloadHasNoMediaLeak(report);
  return Object.freeze(report);
}

function privateImageAsset(facts: Phase11ARejectFacts): GeneratedAsset {
  return {
    id: facts.assetId,
    kind: "image",
    mimeType: "image/png",
    source: { kind: "internal", storagePath: "[redacted-private]" },
    checksum: facts.checksumSha256,
    width: 1024,
    height: 1024,
    sizeBytes: facts.sizeBytes,
  };
}

export function buildPhase11AMinimalProductionResult(
  facts: Phase11ARejectFacts,
): ProductionResult {
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
      attempts: [
        {
          attemptId: facts.attemptId,
          stepId: "image",
          sceneId: PHASE_11A_SMOKE_SCENE_ID,
          attemptNumber: 1,
          kind: "primary",
          providerId: PHASE_11A_SMOKE_PROVIDER,
          modelId: PHASE_11A_SMOKE_MODEL,
          status: "completed",
          estimatedAmountMinor: facts.estimatedCostMinor,
          actualAmountMinor: facts.committedCostMinor,
          costKind: "provisional",
          currency: "USD",
        },
      ],
      generatedAt: facts.nowIso,
    },
    warnings: [
      {
        code: "human_review_required",
        message: "Technical QC passed — Human Review required before activation.",
      },
    ],
    delivery: {
      status: "quality_review",
      updatedAt: facts.nowIso,
      qualityReportId: facts.qualityReportId,
      finalAssetId: facts.assetId,
    },
  };
  assertPhase11APayloadHasNoMediaLeak(result);
  return Object.freeze(JSON.parse(JSON.stringify(result)) as ProductionResult);
}

export function applyPhase11AHumanRejectToProductionResult(input: {
  productionResult: ProductionResult;
  decisionId: string;
  qualityReportId: string;
  reviewRequestId: string;
  nowIso: string;
}): ProductionResult {
  const current = input.productionResult.delivery ?? {
    status: "not_started" as const,
    updatedAt: input.nowIso,
  };
  assertDeliveryTransition(current.status, "blocked");
  const next = withDeliveryUpdate(input.productionResult, {
    ...current,
    status: "blocked",
    updatedAt: input.nowIso,
    qualityReportId: input.qualityReportId,
    humanReviewId: input.decisionId,
    finalAssetId: current.finalAssetId,
    blockingCodes: [PHASE_11A_HR_REJECT_ISSUE_CODE, "human_rejected"],
  });
  const withNote = {
    ...next,
    phase11a: {
      technicalPipeline: "PASS",
      assetDecision: "HUMAN_REJECTED",
      reviewRequestId: input.reviewRequestId,
      outputActive: false,
      mergeExportAuthorized: false,
      retryCreated: false,
    },
  };
  assertPhase11APayloadHasNoMediaLeak(withNote);
  return Object.freeze(JSON.parse(JSON.stringify(withNote)) as ProductionResult);
}

export type Phase11ARejectedProductionResult = ProductionResult & {
  phase11a: {
    technicalPipeline: "PASS";
    assetDecision: "HUMAN_REJECTED";
    reviewRequestId: string;
    outputActive: false;
    mergeExportAuthorized: false;
    retryCreated: false;
  };
};

export function applyPhase11ARejectToRunState(
  state: Record<string, unknown>,
  input: {
    nowIso: string;
    reviewRequestId: string;
    decisionId: string;
  },
): Record<string, unknown> {
  const next = { ...state };
  delete next.waitingReason;
  next.status = "completed";
  next.updatedAt = input.nowIso;
  next.humanReview = {
    decision: "rejected",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    technicalPipeline: "PASS",
    assetDecision: "HUMAN_REJECTED",
    decidedAt: input.nowIso,
    auth: PHASE_11A_HR_REJECT_AUTH,
  };
  assertPhase11APayloadHasNoMediaLeak(next);
  return next;
}

export function applyPhase11ARejectToAssetProvenance(
  provenance: Record<string, unknown>,
  input: { reviewRequestId: string; decisionId: string },
): Record<string, unknown> {
  return {
    ...provenance,
    active: false,
    lifecycle: "rejected",
    outputLifecycle: "rejected",
    humanDecision: "rejected",
    technicalPipeline: "PASS",
    assetDecision: "HUMAN_REJECTED",
    reviewRequestId: input.reviewRequestId,
    decisionId: input.decisionId,
    auth: PHASE_11A_HR_REJECT_AUTH,
  };
}

export function phase11ATechnicalVsHumanVerdict(): {
  technicalPipeline: "PASS";
  assetDecision: "HUMAN_REJECTED";
  phase: "PASS_TECHNICAL_ASSET_REJECTED";
} {
  return {
    technicalPipeline: "PASS",
    assetDecision: "HUMAN_REJECTED",
    phase: "PASS_TECHNICAL_ASSET_REJECTED",
  };
}

export type PersistPhase11ARejectInput = {
  requestedDecision: string;
  facts: Phase11ARejectFacts;
  reviewRequestId: string;
  decisionId: string;
  expectedProductionResultRevision?: number;
  idempotencyKey: string;
};

export type PersistPhase11ARejectResult =
  | {
      status: "created" | "existing";
      qualityReport: Phase11AScaffoldArtifact;
      productionResult: Phase11AScaffoldArtifact;
      decisionId: string;
      expectedRevision: number;
      reviewRequestId: string;
    }
  | { status: "conflict"; reason: string }
  | { status: "inconsistent"; reason: string };

export function persistPhase11AHumanRejectOnce(
  store: Phase11ARejectMemoryStore,
  input: PersistPhase11ARejectInput,
): PersistPhase11ARejectResult {
  assertPhase11ARequestedDecisionIsReject(input.requestedDecision);
  const existing = store.decisions.find((d) => d.idempotencyKey === input.idempotencyKey);
  if (existing) {
    const qr = store.qualityReports[0];
    const pr = store.productionResults[store.productionResults.length - 1];
    if (!qr || !pr) {
      return { status: "inconsistent", reason: "decision_without_scaffold" };
    }
    return {
      status: "existing",
      qualityReport: qr,
      productionResult: pr,
      decisionId: existing.id,
      expectedRevision: existing.productionResultRevision,
      reviewRequestId: existing.reviewRequestId,
    };
  }
  if (store.decisions.length > 0) {
    return { status: "conflict", reason: "distinct_decision_already_present" };
  }

  const audit = auditPhase11AReviewScaffold({
    qualityReports: store.qualityReports,
    productionResults: store.productionResults,
    expectedRunId: input.facts.runId,
    expectedAssetId: input.facts.assetId,
    expectedSceneId: PHASE_11A_SMOKE_SCENE_ID,
  });
  if (audit.status === "inconsistent") {
    return { status: "inconsistent", reason: audit.reason };
  }

  let qr: Phase11AScaffoldArtifact;
  if (audit.status === "reuse" || audit.status === "create_pr") {
    qr = audit.qualityReport;
  } else {
    qr = {
      id: input.facts.qualityReportId,
      revision: 1,
      value: buildPhase11AMinimalQualityReport(input.facts) as unknown as Record<string, unknown>,
    };
    store.qualityReports.push(qr);
  }

  let pr: Phase11AScaffoldArtifact;
  if (audit.status === "reuse" || audit.status === "create_qr") {
    pr = audit.productionResult;
  } else {
    pr = {
      id: input.facts.productionResultId,
      revision: 1,
      value: buildPhase11AMinimalProductionResult(input.facts) as unknown as Record<
        string,
        unknown
      >,
    };
    store.productionResults.push(pr);
  }

  const expected = input.expectedProductionResultRevision ?? pr.revision;
  if (expected !== pr.revision) {
    return { status: "conflict", reason: "optimistic_conflict" };
  }

  const updated = applyPhase11AHumanRejectToProductionResult({
    productionResult: pr.value as unknown as ProductionResult,
    decisionId: input.decisionId,
    qualityReportId: qr.id,
    reviewRequestId: input.reviewRequestId,
    nowIso: input.facts.nowIso,
  });
  const nextPr: Phase11AScaffoldArtifact = {
    id: `${pr.id}:rejected`,
    revision: pr.revision + 1,
    value: updated as unknown as Record<string, unknown>,
  };
  store.productionResults.push(nextPr);
  store.decisions.push({
    id: input.decisionId,
    decision: "rejected",
    idempotencyKey: input.idempotencyKey,
    reviewRequestId: input.reviewRequestId,
    productionResultRevision: pr.revision,
  });
  store.asset = { id: input.facts.assetId, status: "rejected", active: false };

  assertPhase11ARejectedBlocksActivationAndDownstream({
    decision: "rejected",
    active: store.asset.active,
    mergeRequested: false,
    exportRequested: false,
    retryJobCreated: store.retriesCreated > 0,
    providerCalls: store.providerCalls,
  });

  return {
    status: "created",
    qualityReport: qr,
    productionResult: nextPr,
    decisionId: input.decisionId,
    expectedRevision: pr.revision,
    reviewRequestId: input.reviewRequestId,
  };
}

export function emptyPhase11ARejectStore(assetId: string): Phase11ARejectMemoryStore {
  return {
    qualityReports: [],
    productionResults: [],
    decisions: [],
    jobsCreated: 0,
    retriesCreated: 0,
    ledgerWrites: 0,
    storageWrites: 0,
    providerCalls: 0,
    asset: { id: assetId, status: "pending_review", active: false },
  };
}
