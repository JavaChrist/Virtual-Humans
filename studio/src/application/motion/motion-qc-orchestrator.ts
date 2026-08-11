/**
 * Motion QC orchestration (MT-009).
 * Consumes qc_pending handoff — no provider submit, no auto-approval, no merge/export.
 */

import { createHash } from "node:crypto";
import {
  MotionTransferDomainError,
  deepFreeze,
  type MotionFidelity,
  type MotionQcResult,
  type MotionTransferInput,
  type MotionTransferProviderOutputDescriptor,
} from "@/domain/motion";
import {
  aggregateMotionQcResult,
  assertMeasurementSetValid,
  createSyntheticMotionQcPolicy,
  evaluateMotionTechnicalQc,
  motionQcHandoffFromResult,
  type MotionQcEvidenceDescriptor,
  type MotionQcPolicy,
  assertMotionQcEvidenceSafe,
} from "@/domain/motion/qc";
import type { MotionQcMeasurementPort } from "./motion-qc-measurement-port";
import {
  assertMotionQcEventRedacted,
  type MotionQcEventSink,
} from "./motion-qc-events";
import {
  buildMotionQcQualityReport,
  type MotionQcQualityReportValue,
  type MotionQcReportStore,
} from "./motion-qc-report";
import type { MotionTransferAttemptRecord } from "./motion-transfer-worker-orchestrator";

export const MOTION_QC_ORCHESTRATOR_VERSION = "mt009-1.0.0" as const;

export type MotionQcEvaluateInput = {
  attempt: MotionTransferAttemptRecord;
  output: MotionTransferProviderOutputDescriptor;
  motionInput: MotionTransferInput;
  fidelity?: MotionFidelity;
  policy?: MotionQcPolicy;
  workspaceId?: string;
  projectId: string;
  correlationId: string;
  actorId: string;
  nowIso: string;
};

export type MotionQcEvaluateResult = {
  result: MotionQcResult;
  report: MotionQcQualityReportValue;
  handoff: ReturnType<typeof motionQcHandoffFromResult>;
  evidence: readonly MotionQcEvidenceDescriptor[];
  idempotentReplay: boolean;
};

export type MotionQcOrchestrator = {
  evaluate(input: MotionQcEvaluateInput): Promise<MotionQcEvaluateResult>;
};

export type CreateMotionQcOrchestratorOptions = {
  measurements: MotionQcMeasurementPort;
  reports: MotionQcReportStore;
  events?: MotionQcEventSink;
  /**
   * Default synthetic policy when none supplied.
   * Pass `null` to require an explicit policy (absent → reject, never PASS).
   */
  defaultPolicy?: MotionQcPolicy | null;
};

function emit(
  sink: MotionQcEventSink | undefined,
  event: Parameters<MotionQcEventSink["emit"]>[0],
): void {
  assertMotionQcEventRedacted(event);
  sink?.emit(event);
}

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

/**
 * Create Motion QC orchestrator (fake measurements only in MT-009 tests).
 */
export function createMotionQcOrchestrator(
  options: CreateMotionQcOrchestratorOptions,
): MotionQcOrchestrator {
  const defaultPolicy =
    options.defaultPolicy === null
      ? undefined
      : (options.defaultPolicy ?? createSyntheticMotionQcPolicy());

  return {
    async evaluate(input) {
      const policy = input.policy ?? defaultPolicy;
      if (!policy) {
        throw new MotionTransferDomainError(
          "qc_rejected",
          "Policy QC absente — PASS interdit.",
        );
      }
      const attempt = input.attempt;

      if (attempt.phase !== "qc_pending" && attempt.phase !== "qc_passed") {
        // Allow idempotent replay only when already QC-terminal with report
        if (
          attempt.phase === "qc_rejected" ||
          attempt.phase === "retry_recommended"
        ) {
          const existing = await options.reports.getActive(
            input.projectId,
            attempt.runId,
          );
          if (existing) {
            return {
              result: existing.value.motionQc,
              report: existing.value,
              handoff: motionQcHandoffFromResult(existing.value.motionQc),
              evidence: [],
              idempotentReplay: true,
            };
          }
        }
        throw new MotionTransferDomainError(
          "qc_rejected",
          "QC refuse — run non qc_pending.",
          { diagnostic: `phase=${attempt.phase}` },
        );
      }

      const evalFingerprint = fingerprint([
        attempt.runId,
        attempt.attemptId,
        input.output.providerOutputRef,
        policy.version,
      ]);

      // Idempotent: existing active report with same fingerprint
      const prior = await options.reports.getActive(
        input.projectId,
        attempt.runId,
      );
      if (prior && prior.fingerprint === evalFingerprint) {
        return {
          result: prior.value.motionQc,
          report: prior.value,
          handoff: motionQcHandoffFromResult(prior.value.motionQc),
          evidence: [],
          idempotentReplay: true,
        };
      }

      emit(options.events, {
        type: "motion.qc.started",
        correlationId: input.correlationId,
        projectId: input.projectId,
        runId: attempt.runId,
        jobId: attempt.jobId,
        policyId: policy.policyId,
        policyVersion: policy.version,
      });

      const technical = evaluateMotionTechnicalQc({
        output: input.output,
        outputConstraints: input.motionInput.output,
        sourceDurationSeconds:
          input.motionInput.sourceVideo.durationSeconds ??
          input.motionInput.output.durationSeconds,
        policy,
      });

      emit(options.events, {
        type: "motion.qc.technical.completed",
        correlationId: input.correlationId,
        projectId: input.projectId,
        runId: attempt.runId,
        jobId: attempt.jobId,
        overallStatus: technical.status,
        failCount: technical.issues.length,
      });

      let measurements;
      try {
        measurements = await options.measurements.measure(
          {
            sourceDurationSeconds: input.motionInput.sourceVideo.durationSeconds,
            output: input.output,
            motionInput: input.motionInput,
            referenceSpec: input.motionInput.referenceSpec,
          },
          {
            correlationId: input.correlationId,
            workspaceId: input.workspaceId ?? "ws-motion",
            projectId: input.projectId,
            runId: attempt.runId,
            jobId: attempt.jobId,
            attemptId: attempt.attemptId,
            nowIso: input.nowIso,
          },
        );
        measurements = assertMeasurementSetValid(measurements);
      } catch (err) {
        if (err instanceof MotionTransferDomainError) throw err;
        throw new MotionTransferDomainError(
          "qc_rejected",
          "Mesures QC indisponibles.",
        );
      }

      if (
        !policy.acceptedMeasurementVersions.includes(
          measurements.measurementVersion,
        )
      ) {
        throw new MotionTransferDomainError(
          "qc_rejected",
          "measurementVersion inconnue — PASS interdit.",
          { diagnostic: measurements.measurementVersion },
        );
      }

      emit(options.events, {
        type: "motion.qc.measurements.completed",
        correlationId: input.correlationId,
        projectId: input.projectId,
        runId: attempt.runId,
        measurementVersion: measurements.measurementVersion,
        passCount: measurements.measurements.filter(
          (m) => m.available && (m.value ?? 0) >= 0.7,
        ).length,
        unavailableCount: measurements.measurements.filter((m) => !m.available)
          .length,
      });

      const fidelity =
        input.fidelity ??
        input.motionInput.motion.fidelity ??
        policy.fidelityLevel;

      const result = aggregateMotionQcResult({
        technical,
        measurements,
        policy,
        fidelity,
        referenceSpec: input.motionInput.referenceSpec,
        qcRequirements: [
          ...input.motionInput.qcRequirements,
          ...(input.motionInput.referenceSpec?.qcRequirements ?? []),
        ],
      });

      if (result.checkpointResults.some((c) => c.status === "fail")) {
        emit(options.events, {
          type: "motion.qc.checkpoint.failed",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: attempt.runId,
          failCount: result.checkpointResults.filter((c) => c.status === "fail")
            .length,
        });
      }

      const evidence: MotionQcEvidenceDescriptor[] = measurements.measurements
        .flatMap((m) => m.evidenceRefs ?? [])
        .filter((id, i, arr) => arr.indexOf(id) === i)
        .map((evidenceId) =>
          assertMotionQcEvidenceSafe({
            evidenceId,
            role: "motion_qc_evidence",
            contentFingerprint: fingerprint([evidenceId, attempt.attemptId]),
            mimeType: "image/png",
            provenance: {
              correlationId: input.correlationId,
              measurementVersion: measurements.measurementVersion,
            },
          }),
        );

      const report = buildMotionQcQualityReport({
        result,
        policy,
        measurementVersion: measurements.measurementVersion,
        runId: attempt.runId,
        jobId: attempt.jobId,
        attemptId: attempt.attemptId,
        outputRef: input.output.providerOutputRef,
        correlationId: input.correlationId,
        createdBy: input.actorId,
        createdAt: input.nowIso,
      });

      const fp = fingerprint([
        attempt.runId,
        attempt.attemptId,
        input.output.providerOutputRef,
        policy.version,
      ]);

      await options.reports.save({
        reportId: `mqr-${fp}`,
        projectId: input.projectId,
        runId: attempt.runId,
        revision: 1,
        active: true,
        value: report,
        fingerprint: fp,
      });

      const handoff = motionQcHandoffFromResult(result);

      emit(options.events, {
        type: "motion.qc.completed",
        correlationId: input.correlationId,
        projectId: input.projectId,
        runId: attempt.runId,
        jobId: attempt.jobId,
        policyId: policy.policyId,
        policyVersion: policy.version,
        measurementVersion: measurements.measurementVersion,
        overallStatus: result.overallStatus,
        humanValidationRequired: result.humanValidationRequired,
        failCount: result.issues.filter((i) => i.severity === "blocking").length,
      });

      if (handoff.outcome === "needs_review") {
        emit(options.events, {
          type: "motion.qc.needs_review",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: attempt.runId,
          overallStatus: result.overallStatus,
          humanValidationRequired: true,
        });
      } else if (handoff.outcome === "rejected") {
        emit(options.events, {
          type: "motion.qc.rejected",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: attempt.runId,
          overallStatus: "reject",
        });
      } else if (handoff.outcome === "retry_recommended") {
        emit(options.events, {
          type: "motion.qc.retry_recommended",
          correlationId: input.correlationId,
          projectId: input.projectId,
          runId: attempt.runId,
          overallStatus: "retry",
        });
      }

      return deepFreeze({
        result,
        report,
        handoff,
        evidence,
        idempotentReplay: false,
      }) as MotionQcEvaluateResult;
    },
  };
}

/**
 * Apply QC handoff onto attempt record (in-memory) — no retry job, no approval.
 */
export function applyMotionQcHandoffToAttempt(
  attempt: MotionTransferAttemptRecord,
  handoff: ReturnType<typeof motionQcHandoffFromResult>,
): MotionTransferAttemptRecord {
  return {
    ...attempt,
    phase: handoff.phase === "qc_pending" ? "qc_pending" : handoff.phase,
    terminal: true,
  };
}
