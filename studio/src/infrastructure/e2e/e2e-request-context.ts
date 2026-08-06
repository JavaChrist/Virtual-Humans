/**
 * Request-scoped E2E harness context (Phase 8 / 8G-B).
 * Only honored when DIRECTOR_V2_E2E_HARNESS + fake mode are active.
 * Never reads provider keys; never enables real network.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export const E2E_FAKE_FAIL_HEADER = "x-vh-e2e-fake-fail";

export type E2eCreativeFakeFailMode =
  | "incomplete"
  | "refused"
  | "empty_response"
  | "invalid_structured_output"
  | "invalid_candidate"
  | "provider_failed";

export type E2eRequestContext = {
  creativeFail?: E2eCreativeFakeFailMode;
};

const storage = new AsyncLocalStorage<E2eRequestContext>();

const CREATIVE_FAIL_MODES = new Set<string>([
  "incomplete",
  "refused",
  "empty_response",
  "invalid_structured_output",
  "invalid_candidate",
  "provider_failed",
]);

/** Parse `creative:<mode>` or legacy bare stage names (ignored here). */
export function parseE2eFakeFailHeader(
  raw: string | null | undefined,
): E2eRequestContext {
  const v = raw?.trim().toLowerCase() ?? "";
  if (!v) return {};
  const creativePrefix = "creative:";
  if (v.startsWith(creativePrefix)) {
    const mode = v.slice(creativePrefix.length);
    if (CREATIVE_FAIL_MODES.has(mode)) {
      return { creativeFail: mode as E2eCreativeFakeFailMode };
    }
  }
  // Legacy: DIRECTOR_V2_E2E_FAKE_FAIL=creative → generic provider_failed
  if (v === "creative") {
    return { creativeFail: "provider_failed" };
  }
  return {};
}

export function runWithE2eRequestContext<T>(
  ctx: E2eRequestContext,
  fn: () => T,
): T {
  return storage.run(ctx, fn);
}

export function getE2eRequestContext(): E2eRequestContext {
  return storage.getStore() ?? {};
}
