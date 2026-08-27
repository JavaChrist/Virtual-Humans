"use client";

import { useEffect } from "react";
import { registerUpdateBlocker } from "./update-blockers";

/**
 * Bind the existing in-memory update-blocker registry to a React lifetime.
 * Cleanup on inactive, error/success (caller flips `active`), unmount, and
 * dependency change. Not a second registry.
 */
export function useUpdateBlocker(active: boolean, id: string, reason: string): void {
  useEffect(() => {
    if (!active || !id) return;
    return registerUpdateBlocker(id, reason);
  }, [active, id, reason]);
}
