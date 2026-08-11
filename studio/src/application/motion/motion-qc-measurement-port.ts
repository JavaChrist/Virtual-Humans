/**
 * Motion QC measurement port (MT-009) — provider-agnostic.
 * No real CV adapter in this ticket.
 */

import type {
  MotionQcMeasurementSet,
  MotionReferenceSpec,
  MotionTransferInput,
  MotionTransferProviderOutputDescriptor,
} from "@/domain/motion";

export type MotionQcMeasurementContext = {
  correlationId: string;
  workspaceId: string;
  projectId: string;
  runId: string;
  jobId: string;
  attemptId: string;
  providerId?: string;
  modelId?: string;
  nowIso: string;
};

export type MotionQcMeasurementInput = {
  sourceDurationSeconds?: number;
  output: MotionTransferProviderOutputDescriptor;
  motionInput: MotionTransferInput;
  referenceSpec?: MotionReferenceSpec;
};

export interface MotionQcMeasurementPort {
  readonly measurementVersion: string;
  measure(
    input: MotionQcMeasurementInput,
    context: MotionQcMeasurementContext,
  ): Promise<MotionQcMeasurementSet>;
}
