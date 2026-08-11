/**
 * MT-008 — redacted Motion Transfer worker observability events.
 * MT-011 — assert delegates to central Motion sanitizer.
 */

import { assertMotionSurfaceRedacted } from "@/domain/motion/security";

export type MotionTransferWorkerEventType =
  | "motion.job.claimed"
  | "motion.submit.intent"
  | "motion.submit.accepted"
  | "motion.submit.unknown"
  | "motion.poll.scheduled"
  | "motion.poll.status"
  | "motion.provider.completed"
  | "motion.provider.failed"
  | "motion.ledger.reconciled"
  | "motion.qc.pending"
  | "motion.late_result";

export type MotionTransferWorkerEvent = {
  type: MotionTransferWorkerEventType;
  correlationId: string;
  workspaceId?: string;
  projectId: string;
  runId: string;
  jobId: string;
  attemptId: string;
  providerId?: string;
  modelId?: string;
  adapterVersion?: string;
  /** Truncated / fingerprinted — never raw provider URL. */
  providerJobIdFingerprint?: string;
  status?: string;
  durationMs?: number;
  usageSeconds?: number;
  costMinor?: number;
  pollCount?: number;
  phase?: string;
};

export type MotionTransferWorkerEventSink = {
  emit(event: MotionTransferWorkerEvent): void;
};

export function fingerprintProviderJobId(providerJobId: string): string {
  const t = providerJobId.trim();
  if (t.length <= 12) return `pjid:${t}`;
  return `pjid:${t.slice(0, 6)}…${t.slice(-4)}`;
}

export function assertMotionEventRedacted(event: MotionTransferWorkerEvent): void {
  assertMotionSurfaceRedacted(event, "motion_event");
}
