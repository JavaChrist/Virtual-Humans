/**
 * Persistence ports for Phase 5 delivery directors (quality/merge/export) (VHS-125).
 * Reads of production_result / quality_report / merge_plan / export_package artifacts
 * go through the generic ArtifactRepository (VHS-113) — these ports cover writes only.
 */

import type { HumanReviewDecision } from "@/domain/postproduction";

export type BeginDeliveryRunResult =
  | { status: "created"; directorRunId: string; revision: number }
  | { status: "existing"; directorRunId: string; revision: number; outputArtifactId: string }
  | {
      status: "already_running";
      directorRunId: string;
      revision: number;
      outputArtifactId?: string | null;
    };

export type PersistProductionResultInput = {
  workspaceId: string;
  projectId: string;
  artifactId: string;
  productionRunId: string;
  result: Record<string, unknown>;
  schemaVersion: string;
  correlationId: string;
  createdBy: string;
  actorType: string;
  actorId: string;
  /** Optional optimistic check against the currently active production_result revision (0 = none). */
  expectedActiveRevision?: number;
};

export type PersistArtifactResult = {
  status: "created" | "existing";
  artifactId: string;
  revision: number;
};

export type BeginQualityRunInput = {
  id: string;
  workspaceId: string;
  projectId: string;
  productionResultArtifactId: string;
  productionResultRevision: number;
  idempotencyKey: string;
  commandFingerprint: string;
  correlationId: string;
};

export type PersistQualityReportInput = {
  directorRunId: string;
  workspaceId: string;
  projectId: string;
  artifactId: string;
  productionResultArtifactId: string;
  productionResultRevision: number;
  report: Record<string, unknown>;
  schemaVersion: string;
  updatedProductionResult: Record<string, unknown>;
  productionResultNewId: string;
  correlationId: string;
  createdBy: string;
  actorType: string;
  actorId: string;
  expectedRunRevision: number;
};

export type PersistWithProductionResultResult = {
  status: "created" | "existing";
  artifactId: string;
  revision: number;
  productionResultArtifactId: string;
  productionResultRevision: number;
};

export type PersistHumanReviewDecisionInput = {
  id: string;
  workspaceId: string;
  projectId: string;
  qualityReportArtifactId: string;
  qualityReportRevision: number;
  productionResultArtifactId: string;
  productionResultRevision: number;
  decision: "approved" | "rejected";
  comment?: string;
  reviewedIssueCodes: string[];
  idempotencyKey?: string;
  correlationId: string;
  actorType: string;
  actorId: string;
  updatedProductionResult: Record<string, unknown>;
  productionResultNewId: string;
  expectedProductionResultRevision: number;
};

export type PersistHumanReviewDecisionResult = {
  status: "created" | "existing";
  decisionId: string;
  productionResultArtifactId: string;
  productionResultRevision: number;
};

export type BeginMergeRunInput = {
  id: string;
  workspaceId: string;
  projectId: string;
  qualityReportArtifactId: string;
  qualityReportRevision: number;
  productionResultArtifactId: string;
  productionResultRevision: number;
  idempotencyKey: string;
  commandFingerprint: string;
  correlationId: string;
};

export type MergeOutcomeStatus = "prepared" | "blocked" | "completed" | "failed";

export type PersistMergeOutcomeInput = {
  directorRunId: string;
  workspaceId: string;
  projectId: string;
  artifactId: string;
  productionResultArtifactId: string;
  productionResultRevision: number;
  mergeOutcome: Record<string, unknown>;
  schemaVersion: string;
  mergeStatus: MergeOutcomeStatus;
  updatedProductionResult: Record<string, unknown>;
  productionResultNewId: string;
  correlationId: string;
  createdBy: string;
  actorType: string;
  actorId: string;
  expectedRunRevision: number;
};

export type BeginExportRunInput = {
  id: string;
  workspaceId: string;
  projectId: string;
  mergePlanArtifactId: string;
  mergePlanRevision: number;
  productionResultArtifactId: string;
  productionResultRevision: number;
  idempotencyKey: string;
  commandFingerprint: string;
  correlationId: string;
};

export type PersistExportPackageInput = {
  directorRunId: string;
  workspaceId: string;
  projectId: string;
  artifactId: string;
  productionResultArtifactId: string;
  productionResultRevision: number;
  exportPackage: Record<string, unknown>;
  schemaVersion: string;
  destinationId: "download" | "aiccos";
  updatedProductionResult: Record<string, unknown>;
  productionResultNewId: string;
  correlationId: string;
  createdBy: string;
  actorType: string;
  actorId: string;
  expectedRunRevision: number;
};

export type FailDeliveryRunInput = {
  directorRunId: string;
  workspaceId: string;
  expectedRevision: number;
  errorCode: string;
  status: "failed" | "needs_input" | "cancelled";
  correlationId: string;
};

export type DeliveryDirectorRunPort = {
  persistProductionResult(input: PersistProductionResultInput): Promise<PersistArtifactResult>;

  /** Latest append-only decision for a given quality_report revision, if any. */
  loadLatestHumanReview(
    projectId: string,
    qualityReportArtifactId: string,
    qualityReportRevision: number,
  ): Promise<HumanReviewDecision | null>;

  beginOrGetQualityRun(input: BeginQualityRunInput): Promise<BeginDeliveryRunResult>;
  persistQualityReport(
    input: PersistQualityReportInput,
  ): Promise<PersistWithProductionResultResult>;

  persistHumanReviewDecision(
    input: PersistHumanReviewDecisionInput,
  ): Promise<PersistHumanReviewDecisionResult>;

  beginOrGetMergeRun(input: BeginMergeRunInput): Promise<BeginDeliveryRunResult>;
  persistMergeOutcome(input: PersistMergeOutcomeInput): Promise<PersistWithProductionResultResult>;

  beginOrGetExportRun(input: BeginExportRunInput): Promise<BeginDeliveryRunResult>;
  persistExportPackage(
    input: PersistExportPackageInput,
  ): Promise<PersistWithProductionResultResult>;

  failRun(input: FailDeliveryRunInput): Promise<void>;
};
