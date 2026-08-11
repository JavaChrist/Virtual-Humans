/**
 * Map MotionQcResult → quality_report artifact value (MT-009).
 * No remote DB write — in-memory port for tests.
 */

import {
  deepFreeze,
  parseMotionQcResult,
  type MotionQcResult,
} from "@/domain/motion";
import type { MotionQcPolicy } from "@/domain/motion/qc";

export const MOTION_QC_QUALITY_REPORT_SCHEMA_VERSION = "1.0.0" as const;

export type MotionQcQualityReportValue = {
  schemaVersion: typeof MOTION_QC_QUALITY_REPORT_SCHEMA_VERSION;
  kind: "motion_qc_result";
  motionQc: MotionQcResult;
  policyId: string;
  policyVersion: string;
  measurementVersion: string;
  source: {
    runId: string;
    jobId: string;
    attemptId: string;
    providerId?: string;
    modelId?: string;
    outputRefFingerprint: string;
  };
  createdBy: string;
  correlationId: string;
  createdAt: string;
};

export type MotionQcReportRecord = {
  reportId: string;
  projectId: string;
  runId: string;
  revision: number;
  active: boolean;
  value: MotionQcQualityReportValue;
  fingerprint: string;
};

export type MotionQcReportStore = {
  save(record: MotionQcReportRecord): Promise<void>;
  getActive(projectId: string, runId: string): Promise<MotionQcReportRecord | null>;
};

export function createMemoryMotionQcReportStore(): MotionQcReportStore & {
  records: Map<string, MotionQcReportRecord>;
} {
  const records = new Map<string, MotionQcReportRecord>();
  return {
    records,
    async save(record) {
      // deactivate previous active for same run
      for (const [k, v] of records) {
        if (v.projectId === record.projectId && v.runId === record.runId && v.active) {
          records.set(k, { ...v, active: false });
        }
      }
      records.set(record.reportId, deepFreeze({ ...record }) as MotionQcReportRecord);
    },
    async getActive(projectId, runId) {
      for (const v of records.values()) {
        if (v.projectId === projectId && v.runId === runId && v.active) return v;
      }
      return null;
    },
  };
}

export function buildMotionQcQualityReport(input: {
  result: MotionQcResult;
  policy: MotionQcPolicy;
  measurementVersion: string;
  runId: string;
  jobId: string;
  attemptId: string;
  providerId?: string;
  modelId?: string;
  outputRef: string;
  correlationId: string;
  createdBy: string;
  createdAt: string;
}): Readonly<MotionQcQualityReportValue> {
  const motionQc = parseMotionQcResult(input.result);
  const outputRefFingerprint =
    input.outputRef.length <= 24
      ? input.outputRef
      : `${input.outputRef.slice(0, 10)}…${input.outputRef.slice(-6)}`;

  return deepFreeze({
    schemaVersion: MOTION_QC_QUALITY_REPORT_SCHEMA_VERSION,
    kind: "motion_qc_result",
    motionQc,
    policyId: input.policy.policyId,
    policyVersion: input.policy.version,
    measurementVersion: input.measurementVersion,
    source: {
      runId: input.runId,
      jobId: input.jobId,
      attemptId: input.attemptId,
      providerId: input.providerId,
      modelId: input.modelId,
      outputRefFingerprint,
    },
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    createdAt: input.createdAt,
  });
}
