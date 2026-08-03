/**
 * Enqueue dispatcher — only applies PD-issued commands (VHS-114).
 * Worker never invents steps, models, or fallbacks.
 */

import type {
  EnqueueProductionJobCommand,
  JobQueuePort,
} from "@/application/production/enqueue";

export type DispatchResult = {
  enqueued: number;
  skipped: number;
  errors: Array<{ stepId: string; publicMessage: string }>;
};

/**
 * Idempotent enqueue of PD commands. Unique key is run/scene/step/attempt
 * (enforced by queue unique constraint).
 */
export async function dispatchEnqueueCommands(
  queue: JobQueuePort,
  commands: EnqueueProductionJobCommand[]
): Promise<DispatchResult> {
  let enqueued = 0;
  let skipped = 0;
  const errors: DispatchResult["errors"] = [];

  for (const cmd of commands) {
    try {
      await queue.enqueue(cmd);
      enqueued += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "enqueue failed";
      // Unique violation → already enqueued (idempotent)
      if (/unique|duplicate|already/i.test(msg)) {
        skipped += 1;
      } else {
        errors.push({ stepId: cmd.stepId, publicMessage: msg });
      }
    }
  }

  return { enqueued, skipped, errors };
}
