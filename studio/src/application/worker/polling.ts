/**
 * Async job reschedule helpers — no infinite polling in one runOnce (VHS-114).
 */

import type { ProductionPayloadReference } from "@/application/production/enqueue";

export type ReschedulePlan = {
  availableAt: string;
  payloadRef: ProductionPayloadReference;
};

/**
 * Compute next poll availability. Bound pollAfterMs.
 */
export function planNextPoll(input: {
  nowIso: string;
  pollAfterMs?: number;
  payloadRef: ProductionPayloadReference;
  maxPollAfterMs?: number;
}): ReschedulePlan {
  const max = input.maxPollAfterMs ?? 60_000;
  const delay = Math.min(
    Math.max(input.pollAfterMs ?? input.payloadRef.pollAfterMs ?? 3_000, 500),
    max
  );
  const availableAt = new Date(Date.parse(input.nowIso) + delay).toISOString();
  return {
    availableAt,
    payloadRef: {
      ...input.payloadRef,
      mode: "poll",
      pollAfterMs: delay,
    },
  };
}

/**
 * Default policy: lease covers a single bounded call — no concurrent heartbeat.
 * Documented in needsConcurrentHeartbeat (policy.ts).
 */
export type HeartbeatController = {
  start: () => void;
  stop: () => void;
  /** True if a heartbeat failure forced stop. */
  lost: () => boolean;
};

export type HeartbeatDeps = {
  intervalMs: number;
  /** Injected scheduler — tests use fake timers; never leave active after stop. */
  schedule: (fn: () => void, ms: number) => { cancel: () => void };
  onHeartbeat: () => Promise<void>;
  onLost: () => void;
};

export function createHeartbeatController(deps: HeartbeatDeps): HeartbeatController {
  let handle: { cancel: () => void } | null = null;
  let stopped = false;
  let lost = false;

  const tick = () => {
    if (stopped) return;
    void (async () => {
      try {
        await deps.onHeartbeat();
        if (!stopped) {
          handle = deps.schedule(tick, deps.intervalMs);
        }
      } catch {
        lost = true;
        stopped = true;
        handle?.cancel();
        handle = null;
        deps.onLost();
      }
    })();
  };

  return {
    start() {
      if (stopped || handle) return;
      handle = deps.schedule(tick, deps.intervalMs);
    },
    stop() {
      stopped = true;
      handle?.cancel();
      handle = null;
    },
    lost: () => lost,
  };
}
