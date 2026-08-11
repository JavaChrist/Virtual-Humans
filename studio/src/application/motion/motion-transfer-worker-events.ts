/**
 * MT-008 — redacted Motion Transfer worker observability events.
 */

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
  const blob = JSON.stringify(event);
  if (/https?:\/\//i.test(blob) || /data:[^;]+;base64,/i.test(blob)) {
    throw new Error("motion_event_media_leak");
  }
  if (/\bsk-[A-Za-z0-9]{10,}/i.test(blob) || /Bearer\s+\S+/i.test(blob)) {
    throw new Error("motion_event_secret_leak");
  }
}
