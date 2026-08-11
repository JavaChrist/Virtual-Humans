/**
 * Motion Transfer human review orchestration (MT-010).
 * Records append-only decisions — no enqueue, provider, ledger, merge, or export.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  MotionTransferDomainError,
  deepFreeze,
  MOTION_HUMAN_REVIEW_INTENT,
  type MotionHumanReviewDecision,
  type MotionQcResult,
} from "@/domain/motion";
import {
  allowedHumanReviewDecisions,
  type MotionReviewGateState,
} from "@/domain/motion/review";
import {
  createSyntheticMotionQcPolicy,
  type MotionQcEvidenceDescriptor,
  type MotionQcPolicy,
} from "@/domain/motion/qc";
import type { MotionQcQualityReportValue } from "./motion-qc-report";
import {
  assertMotionReviewEventRedacted,
  type MotionReviewEvent,
  type MotionReviewEventSink,
} from "./motion-review-events";

export const MOTION_REVIEW_ORCHESTRATOR_VERSION = "mt010-1.0.0" as const;

export type MotionReviewSession = {
  workspaceId: string;
  projectId: string;
  runId: string;
  jobId: string;
  resultId: string;
  attemptId: string;
  revision: number;
  outcome: MotionReviewGateState["outcome"];
  lateQuarantined: boolean;
  reconciliationRequired: boolean;
  qualityReportStale: boolean;
  report: MotionQcQualityReportValue;
  evidence: readonly MotionQcEvidenceDescriptor[];
  policy: MotionQcPolicy;
  costSummary: {
    estimatedCostMinor?: number;
    reservedMinor?: number;
    actualCostMinor?: number;
    currency: string;
  };
  humanAttestationRequired: boolean;
};

export type MotionReviewDecisionRecord = {
  decisionId: string;
  workspaceId: string;
  projectId: string;
  runId: string;
  resultId: string;
  reviewRequestId: string;
  decision: MotionHumanReviewDecision;
  expectedRevision: number;
  commentFingerprint?: string;
  updatedConstraintsRef?: string;
  humanAttestation: boolean;
  actorId: string;
  correlationId: string;
  createdAt: string;
  /** Payload fingerprint for conflict detection. */
  payloadFingerprint: string;
};

export type MotionReviewDecisionStore = {
  append(record: MotionReviewDecisionRecord): Promise<"recorded" | "existing">;
  findByRequestId(
    projectId: string,
    reviewRequestId: string,
  ): Promise<MotionReviewDecisionRecord | null>;
  listForRun(projectId: string, runId: string): Promise<MotionReviewDecisionRecord[]>;
};

export function createMemoryMotionReviewDecisionStore(): MotionReviewDecisionStore & {
  records: MotionReviewDecisionRecord[];
} {
  const records: MotionReviewDecisionRecord[] = [];
  return {
    records,
    async append(record) {
      const existing = records.find(
        (r) =>
          r.projectId === record.projectId &&
          r.reviewRequestId === record.reviewRequestId,
      );
      if (existing) {
        if (existing.payloadFingerprint !== record.payloadFingerprint) {
          throw new MotionTransferDomainError(
            "qc_rejected",
            "Conflit reviewRequestId — payload différent.",
            { diagnostic: "review_payload_conflict" },
          );
        }
        return "existing";
      }
      records.push(deepFreeze({ ...record }) as MotionReviewDecisionRecord);
      return "recorded";
    },
    async findByRequestId(projectId, reviewRequestId) {
      return (
        records.find(
          (r) => r.projectId === projectId && r.reviewRequestId === reviewRequestId,
        ) ?? null
      );
    },
    async listForRun(projectId, runId) {
      return records.filter((r) => r.projectId === projectId && r.runId === runId);
    },
  };
}

export type MotionReviewSessionStore = {
  get(projectId: string, runId?: string): Promise<MotionReviewSession | null>;
  save(session: MotionReviewSession): Promise<void>;
  bumpRevision(projectId: string, runId: string): Promise<number>;
};

export function createMemoryMotionReviewSessionStore(): MotionReviewSessionStore & {
  sessions: Map<string, MotionReviewSession>;
} {
  const sessions = new Map<string, MotionReviewSession>();
  const key = (projectId: string, runId: string) => `${projectId}|${runId}`;
  return {
    sessions,
    async get(projectId, runId) {
      if (runId) return sessions.get(key(projectId, runId)) ?? null;
      for (const s of sessions.values()) {
        if (s.projectId === projectId) return s;
      }
      return null;
    },
    async save(session) {
      sessions.set(key(session.projectId, session.runId), deepFreeze({ ...session }) as MotionReviewSession);
    },
    async bumpRevision(projectId, runId) {
      const s = sessions.get(key(projectId, runId));
      if (!s) throw new MotionTransferDomainError("qc_rejected", "Session review absente.");
      const next = { ...s, revision: s.revision + 1 };
      sessions.set(key(projectId, runId), next);
      return next.revision;
    },
  };
}

/** Side-effect counters — must stay at 0 for retry decisions. */
export type MotionReviewSideEffectCounters = {
  productionJobsDelta: number;
  ledgerDelta: number;
  providerCalls: number;
  mergeCalls: number;
  exportCalls: number;
};

export type MotionReviewPublicContext = {
  runId: string;
  jobId: string;
  resultId: string;
  attemptId: string;
  revision: number;
  overallStatus: MotionQcResult["overallStatus"];
  humanValidationRequired: boolean;
  layerStatuses: {
    motionFidelity: string;
    identityFidelity: string;
    outfitFidelity: string;
    cameraCompliance: string;
    bodyIntegrity: string;
    temporalConsistency: string;
  };
  checkpointResults: MotionQcResult["checkpointResults"];
  issues: Array<{
    code: string;
    severity: string;
    message: string;
    layer?: string;
    requirementClass?: string;
    retryClass?: string;
  }>;
  evidence: Array<{
    evidenceId: string;
    role: string;
    mimeType: string;
    contentFingerprint: string;
    checksum?: string;
    timeRangeSeconds?: { start: number; end: number };
    frameRange?: { start: number; end: number };
    metricIds?: readonly string[];
    checkpointIds?: readonly string[];
    available: boolean;
  }>;
  allowedDecisions: readonly MotionHumanReviewDecision[];
  approveBlockedReasons: readonly string[];
  currentDecision: MotionHumanReviewDecision | null;
  costSummary: MotionReviewSession["costSummary"];
  provenance: {
    policyId: string;
    policyVersion: string;
    measurementVersion: string;
    correlationId: string;
    createdBy: string;
    outputRefFingerprint: string;
  };
  humanAttestationRequired: boolean;
};

export type MotionReviewRecordInput = {
  projectId: string;
  workspaceId: string;
  runId?: string;
  decision: MotionHumanReviewDecision;
  expectedRevision: number;
  reviewRequestId: string;
  comment?: string;
  updatedConstraintsRef?: string;
  humanAttestation?: boolean;
  confirmation: true;
  actorId: string;
  correlationId: string;
  nowIso: string;
};

export type MotionReviewRecordResult =
  | {
      status: "recorded" | "existing";
      decisionId: string;
      revision: number;
      decision: MotionHumanReviewDecision;
      nextAllowedState: "intent_recorded" | "approved_pending_ingest" | "rejected";
      sideEffects: MotionReviewSideEffectCounters;
    }
  | {
      status: "conflict";
      code: "revision_stale" | "payload_conflict" | "decision_not_allowed";
      publicMessage: string;
    }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      httpHint: 400 | 403 | 404 | 409 | 422;
    };

export type MotionReviewOrchestrator = {
  getContext(input: {
    projectId: string;
    workspaceId: string;
    runId?: string;
    correlationId: string;
  }): Promise<
    | { status: "ok"; context: MotionReviewPublicContext }
    | { status: "failed"; code: string; publicMessage: string; httpHint: 403 | 404 | 422 }
  >;
  recordDecision(input: MotionReviewRecordInput): Promise<MotionReviewRecordResult>;
  readonly sideEffects: MotionReviewSideEffectCounters;
};

export type CreateMotionReviewOrchestratorOptions = {
  sessions: MotionReviewSessionStore;
  decisions: MotionReviewDecisionStore;
  events?: MotionReviewEventSink;
  /** When false, GET/POST refuse (Production fail-closed). */
  capabilityEnabled?: boolean;
};

function emit(sink: MotionReviewEventSink | undefined, event: MotionReviewEvent): void {
  assertMotionReviewEventRedacted(event);
  sink?.emit(event);
}

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function commentFp(comment: string | undefined): string | undefined {
  if (!comment?.trim()) return undefined;
  return fingerprint(["c", comment.trim()]);
}

function gateFromSession(s: MotionReviewSession): MotionReviewGateState {
  return {
    outcome: s.outcome,
    humanValidationRequired: s.report.motionQc.humanValidationRequired,
    qualityReportPresent: true,
    qualityReportStale: s.qualityReportStale,
    lateQuarantined: s.lateQuarantined,
    reconciliationRequired: s.reconciliationRequired,
  };
}

function publicContext(
  s: MotionReviewSession,
  allowed: ReturnType<typeof allowedHumanReviewDecisions>,
  current: MotionHumanReviewDecision | null,
): MotionReviewPublicContext {
  const qc = s.report.motionQc;
  return deepFreeze({
    runId: s.runId,
    jobId: s.jobId,
    resultId: s.resultId,
    attemptId: s.attemptId,
    revision: s.revision,
    overallStatus: qc.overallStatus,
    humanValidationRequired: qc.humanValidationRequired,
    layerStatuses: {
      motionFidelity: qc.motionFidelity,
      identityFidelity: qc.identityFidelity,
      outfitFidelity: qc.outfitFidelity,
      cameraCompliance: qc.cameraCompliance,
      bodyIntegrity: qc.bodyIntegrity,
      temporalConsistency: qc.temporalConsistency,
    },
    checkpointResults: qc.checkpointResults,
    issues: qc.issues.map((i) => ({
      code: i.code,
      severity: i.severity,
      message: i.message,
      layer: i.layer,
      requirementClass: i.requirementClass,
      retryClass: i.retryClass,
    })),
    evidence: s.evidence.map((e) => ({
      evidenceId: e.evidenceId,
      role: e.role,
      mimeType: e.mimeType,
      contentFingerprint: e.contentFingerprint,
      checksum: e.checksum,
      timeRangeSeconds: e.timeRangeSeconds,
      frameRange: e.frameRange,
      metricIds: e.metricIds,
      checkpointIds: e.checkpointIds,
      available: true,
    })),
    allowedDecisions: allowed.allowed,
    approveBlockedReasons: allowed.approveBlockedReasons,
    currentDecision: current,
    costSummary: s.costSummary,
    provenance: {
      policyId: s.report.policyId,
      policyVersion: s.report.policyVersion,
      measurementVersion: s.report.measurementVersion,
      correlationId: s.report.correlationId,
      createdBy: s.report.createdBy,
      outputRefFingerprint: s.report.source.outputRefFingerprint,
    },
    humanAttestationRequired: s.humanAttestationRequired,
  }) as MotionReviewPublicContext;
}

export function createMotionReviewOrchestrator(
  options: CreateMotionReviewOrchestratorOptions,
): MotionReviewOrchestrator {
  const sideEffects: MotionReviewSideEffectCounters = {
    productionJobsDelta: 0,
    ledgerDelta: 0,
    providerCalls: 0,
    mergeCalls: 0,
    exportCalls: 0,
  };
  const capabilityEnabled = options.capabilityEnabled !== false;

  return {
    sideEffects,
    async getContext(input) {
      if (!capabilityEnabled) {
        return {
          status: "failed",
          code: "motion_review_unavailable",
          publicMessage: "Revue Motion indisponible.",
          httpHint: 404,
        };
      }
      const session = await options.sessions.get(input.projectId, input.runId);
      if (!session) {
        return {
          status: "failed",
          code: "review_context_absent",
          publicMessage: "Aucun contexte Motion à réviser.",
          httpHint: 404,
        };
      }
      if (
        session.workspaceId !== input.workspaceId ||
        session.projectId !== input.projectId
      ) {
        return {
          status: "failed",
          code: "scope_mismatch",
          publicMessage: "Accès projet refusé.",
          httpHint: 403,
        };
      }

      const allowed = allowedHumanReviewDecisions(
        session.report.motionQc,
        session.policy,
        gateFromSession(session),
      );
      const decisions = await options.decisions.listForRun(
        session.projectId,
        session.runId,
      );
      const current = decisions.length
        ? decisions[decisions.length - 1]!.decision
        : null;

      emit(options.events, {
        type: "motion.review.opened",
        correlationId: input.correlationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        runId: session.runId,
        resultId: session.resultId,
        revision: session.revision,
        policyVersion: session.policy.version,
      });

      return {
        status: "ok",
        context: publicContext(session, allowed, current),
      };
    },

    async recordDecision(input) {
      if (!capabilityEnabled) {
        return {
          status: "failed",
          code: "motion_review_unavailable",
          publicMessage: "Revue Motion indisponible.",
          httpHint: 404,
        };
      }
      if (input.confirmation !== true) {
        return {
          status: "failed",
          code: "confirmation_required",
          publicMessage: "Confirmation requise.",
          httpHint: 400,
        };
      }
      if (!input.reviewRequestId?.trim()) {
        return {
          status: "failed",
          code: "review_request_id_required",
          publicMessage: "reviewRequestId requis.",
          httpHint: 400,
        };
      }

      const session = await options.sessions.get(input.projectId, input.runId);
      if (!session) {
        return {
          status: "failed",
          code: "review_context_absent",
          publicMessage: "Aucun contexte Motion à réviser.",
          httpHint: 404,
        };
      }
      if (
        session.workspaceId !== input.workspaceId ||
        session.projectId !== input.projectId
      ) {
        return {
          status: "failed",
          code: "scope_mismatch",
          publicMessage: "Accès projet refusé.",
          httpHint: 403,
        };
      }

      const payloadFingerprint = fingerprint([
        input.decision,
        String(input.expectedRevision),
        input.comment?.trim() ?? "",
        input.updatedConstraintsRef?.trim() ?? "",
        String(input.humanAttestation === true),
      ]);

      // Idempotence before revision gate (double-click / retry same request)
      const prior = await options.decisions.findByRequestId(
        input.projectId,
        input.reviewRequestId,
      );
      if (prior) {
        if (prior.payloadFingerprint !== payloadFingerprint) {
          emit(options.events, {
            type: "motion.review.conflict",
            correlationId: input.correlationId,
            projectId: input.projectId,
            reviewRequestId: input.reviewRequestId,
          });
          return {
            status: "conflict",
            code: "payload_conflict",
            publicMessage: "Même reviewRequestId avec contenu différent.",
          };
        }
        emit(options.events, {
          type: "motion.review.decision.existing",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: session.runId,
          reviewRequestId: input.reviewRequestId,
          decisionId: prior.decisionId,
          decision: prior.decision,
          revision: session.revision,
        });
        const nextAllowedState =
          prior.decision === "approved"
            ? "approved_pending_ingest"
            : prior.decision === "rejected"
              ? "rejected"
              : "intent_recorded";
        return deepFreeze({
          status: "existing",
          decisionId: prior.decisionId,
          revision: session.revision,
          decision: prior.decision,
          nextAllowedState,
          sideEffects: { ...sideEffects },
        }) as Extract<MotionReviewRecordResult, { status: "existing" }>;
      }

      if (session.revision !== input.expectedRevision) {
        emit(options.events, {
          type: "motion.review.conflict",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: session.runId,
          reviewRequestId: input.reviewRequestId,
          revision: session.revision,
        });
        return {
          status: "conflict",
          code: "revision_stale",
          publicMessage: "Révision obsolète — recharger le contexte.",
        };
      }

      const allowed = allowedHumanReviewDecisions(
        session.report.motionQc,
        session.policy,
        gateFromSession(session),
      );
      if (!allowed.allowed.includes(input.decision)) {
        return {
          status: "conflict",
          code: "decision_not_allowed",
          publicMessage: "Décision non autorisée pour cet état QC.",
        };
      }

      if (input.decision === "rejected" && !input.comment?.trim()) {
        return {
          status: "failed",
          code: "justification_required",
          publicMessage: "Justification obligatoire pour REJECT.",
          httpHint: 422,
        };
      }
      if (
        input.decision === "request_new_reference" &&
        !input.comment?.trim()
      ) {
        return {
          status: "failed",
          code: "justification_required",
          publicMessage: "Justification obligatoire pour REQUEST_NEW_REFERENCE.",
          httpHint: 422,
        };
      }
      if (input.decision === "retry_updated_constraints") {
        if (!input.updatedConstraintsRef?.trim()) {
          return {
            status: "failed",
            code: "constraints_ref_required",
            publicMessage: "Référence de contraintes versionnée requise.",
            httpHint: 422,
          };
        }
        if (
          input.updatedConstraintsRef.includes("{") ||
          input.updatedConstraintsRef.includes("http")
        ) {
          return {
            status: "failed",
            code: "constraints_inline_forbidden",
            publicMessage: "Contraintes inline / URL interdites — fournir une ref versionnée.",
            httpHint: 422,
          };
        }
      }
      if (
        input.decision === "approved" &&
        session.humanAttestationRequired &&
        input.humanAttestation !== true
      ) {
        return {
          status: "failed",
          code: "attestation_required",
          publicMessage: "Attestation humaine requise pour APPROVE.",
          httpHint: 422,
        };
      }
      if (
        input.decision === "approved" &&
        allowed.approveBlockedReasons.length > 0
      ) {
        return {
          status: "conflict",
          code: "decision_not_allowed",
          publicMessage: "APPROVE interdit — invariants non satisfaits.",
        };
      }

      const decisionId = randomUUID();
      const record: MotionReviewDecisionRecord = {
        decisionId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        runId: session.runId,
        resultId: session.resultId,
        reviewRequestId: input.reviewRequestId,
        decision: input.decision,
        expectedRevision: input.expectedRevision,
        commentFingerprint: commentFp(input.comment),
        updatedConstraintsRef: input.updatedConstraintsRef?.trim(),
        humanAttestation: input.humanAttestation === true,
        actorId: input.actorId,
        correlationId: input.correlationId,
        createdAt: input.nowIso,
        payloadFingerprint,
      };

      let appendStatus: "recorded" | "existing";
      try {
        appendStatus = await options.decisions.append(record);
      } catch (e) {
        if (
          e instanceof MotionTransferDomainError &&
          e.message.includes("review_payload_conflict")
        ) {
          emit(options.events, {
            type: "motion.review.conflict",
            correlationId: input.correlationId,
            projectId: input.projectId,
            reviewRequestId: input.reviewRequestId,
          });
          return {
            status: "conflict",
            code: "payload_conflict",
            publicMessage: "Même reviewRequestId avec contenu différent.",
          };
        }
        throw e;
      }

      const existing = await options.decisions.findByRequestId(
        input.projectId,
        input.reviewRequestId,
      );
      const resolvedId = existing?.decisionId ?? decisionId;

      let revision = session.revision;
      if (appendStatus === "recorded") {
        revision = await options.sessions.bumpRevision(
          session.projectId,
          session.runId,
        );
      }

      // CRITICAL: never enqueue / ledger / provider / merge / export
      // sideEffects counters remain 0

      const nextAllowedState =
        input.decision === "approved"
          ? "approved_pending_ingest"
          : input.decision === "rejected"
            ? "rejected"
            : "intent_recorded";

      emit(options.events, {
        type:
          appendStatus === "existing"
            ? "motion.review.decision.existing"
            : "motion.review.decision.recorded",
        correlationId: input.correlationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        runId: session.runId,
        resultId: session.resultId,
        reviewRequestId: input.reviewRequestId,
        decisionId: resolvedId,
        actorId: input.actorId,
        decision: input.decision,
        revision,
        policyVersion: session.policy.version,
      });

      if (input.decision === "rejected") {
        emit(options.events, {
          type: "motion.review.rejected",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: session.runId,
          decisionId: resolvedId,
          decision: "rejected",
        });
      } else if (
        input.decision === "retry_same_reference" ||
        input.decision === "retry_updated_constraints"
      ) {
        emit(options.events, {
          type: "motion.review.retry_requested",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: session.runId,
          decision: input.decision,
        });
      } else if (input.decision === "request_new_reference") {
        emit(options.events, {
          type: "motion.review.new_reference_requested",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: session.runId,
          decision: "request_new_reference",
        });
      }

      return deepFreeze({
        status: appendStatus,
        decisionId: resolvedId,
        revision,
        decision: input.decision,
        nextAllowedState,
        sideEffects: { ...sideEffects },
      }) as Extract<MotionReviewRecordResult, { status: "recorded" | "existing" }>;
    },
  };
}

/** Seed a reviewable session for harness / tests (no Production writes). */
export function seedMotionReviewSession(
  store: MotionReviewSessionStore & { sessions?: Map<string, MotionReviewSession> },
  over: Partial<MotionReviewSession> & {
    report: MotionQcQualityReportValue;
    projectId: string;
    workspaceId: string;
  },
): MotionReviewSession {
  const policy = over.policy ?? createSyntheticMotionQcPolicy();
  const session: MotionReviewSession = {
    workspaceId: over.workspaceId,
    projectId: over.projectId,
    runId: over.runId ?? "run-mt010-1",
    jobId: over.jobId ?? "job-mt010-1",
    resultId: over.resultId ?? "result-mt010-1",
    attemptId: over.attemptId ?? "att-mt010-1",
    revision: over.revision ?? 1,
    outcome: over.outcome ?? "needs_review",
    lateQuarantined: over.lateQuarantined ?? false,
    reconciliationRequired: over.reconciliationRequired ?? false,
    qualityReportStale: over.qualityReportStale ?? false,
    report: over.report,
    evidence: over.evidence ?? [],
    policy,
    costSummary: over.costSummary ?? {
      estimatedCostMinor: 135,
      reservedMinor: 162,
      currency: "EUR",
    },
    humanAttestationRequired: over.humanAttestationRequired ?? true,
  };
  void store.save(session);
  return session;
}

export { MOTION_HUMAN_REVIEW_INTENT };
