/**
 * Cancellation helpers (pure status decisions).
 */

import type { ProductionRunStatus } from "./production-run";

export function canRequestCancellation(status: ProductionRunStatus): boolean {
  return (
    status === "pending" ||
    status === "validating" ||
    status === "running" ||
    status === "cancelling"
  );
}

export function isCancellationTerminal(status: ProductionRunStatus): boolean {
  return status === "cancelled";
}
