/**
 * Process-scoped Motion review harness (MT-010).
 * Production: empty → API fail-closed. Tests/local harness seed sessions.
 */

import {
  createMemoryMotionReviewDecisionStore,
  createMemoryMotionReviewSessionStore,
  createMotionReviewOrchestrator,
  type MotionReviewOrchestrator,
} from "@/application/motion/motion-review-orchestrator";

const sessions = createMemoryMotionReviewSessionStore();
const decisions = createMemoryMotionReviewDecisionStore();

export function getMotionReviewHarnessStores() {
  return { sessions, decisions };
}

export function createMotionReviewOrchestratorFromHarness(opts?: {
  capabilityEnabled?: boolean;
  events?: Parameters<typeof createMotionReviewOrchestrator>[0]["events"];
}): MotionReviewOrchestrator {
  const defaultEnabled =
    process.env.MOTION_TRANSFER_ENABLED === "1" ||
    process.env.MOTION_TRANSFER_ENABLED === "true" ||
    process.env.MOTION_TRANSFER_FAKE_HARNESS === "1" ||
    process.env.NODE_ENV === "test";

  return createMotionReviewOrchestrator({
    sessions,
    decisions,
    events: opts?.events,
    capabilityEnabled: opts?.capabilityEnabled ?? defaultEnabled,
  });
}

/** Test-only reset between suites. */
export function resetMotionReviewHarness(): void {
  sessions.sessions.clear();
  decisions.records.length = 0;
}
