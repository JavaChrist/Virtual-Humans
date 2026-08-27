/**
 * In-memory update blockers for the PWA apply path.
 * Browser-local, SSR-safe, no persistence, no user data.
 */

export type UpdateBlocker = {
  id: string;
  reason: string;
};

const blockers = new Map<string, { reason: string; refs: number }>();
const listeners = new Set<() => void>();

const REASON_MAX = 200;

export function sanitizeUpdateBlockerReason(reason: string): string {
  return reason.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function registerUpdateBlocker(id: string, reason: string): () => void {
  const key = id.trim();
  if (!key) return () => {};
  const safe = sanitizeUpdateBlockerReason(reason) || "Action en cours";
  const current = blockers.get(key);
  if (current) {
    current.refs += 1;
    current.reason = safe;
  } else {
    blockers.set(key, { reason: safe, refs: 1 });
  }
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const entry = blockers.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) blockers.delete(key);
    emit();
  };
}

export function getActiveUpdateBlockers(): UpdateBlocker[] {
  return [...blockers.entries()].map(([id, value]) => ({
    id,
    reason: value.reason,
  }));
}

export function subscribeToUpdateBlockers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset. */
export function resetUpdateBlockersForTests(): void {
  blockers.clear();
  listeners.clear();
}
