/**
 * Prepared future preflight for composing the existing provider PNG.
 * This module must not read Production media or call a provider.
 * Execution is gated until AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS.
 */

export const PHASE_11A_EXISTING_PROVIDER_ASSET_PREFIX = "7832765d" as const;
export const PHASE_11A_REJECTED_PROVIDER_ASSET_PREFIX = "5d68ef64" as const;
export const PHASE_11A_PENDING_RUN_PREFIX = "39329a01" as const;
export const PHASE_11A_PENDING_JOB_PREFIX = "edc6e84a" as const;

export const PHASE_11A_FUTURE_COMPOSITION_PREFLIGHT_STEPS = [
  "verify_exact_provider_asset_metadata_only",
  "create_ephemeral_signed_url_in_memory",
  "download_unique_existing_png_once",
  "decode_rgb8_filters_0_to_4_in_memory",
  "compose_deterministic_overlay_in_memory",
  "verify_checksum_qc_and_parent_child_contract",
  "write_nothing_close_all_gates",
] as const;

export const PHASE_11A_FUTURE_RUN_CLOSE_TRANSITIONS = {
  currentRunStatus: "running",
  currentWaitingReason: "needs_review",
  providerJob: "completed",
  providerAsset: "present_pending_review_inactive",
  composedAsset: "missing",
  afterSuccessfulComposition: {
    typographicQualityReport: "seeded",
    humanReview: "seeded_no_decision",
    runStatus: "running_or_equivalent_waiting_human",
    waitingReason: "needs_review",
    activation: false,
    autoSuccess: false,
    thirdOpenAICall: false,
  },
} as const;

export type Phase11AExistingProviderCompositionPreflightPlan = {
  prepared: true;
  executed: false;
  providerAssetRead: false;
  providerCalled: false;
  ProductionStorageWrite: false;
  HumanReviewRequired: true;
  pngFiltersSupported: readonly [0, 1, 2, 3, 4];
  targetProviderAssetPrefix: typeof PHASE_11A_EXISTING_PROVIDER_ASSET_PREFIX;
  rejectedAssetPrefixUnchanged: typeof PHASE_11A_REJECTED_PROVIDER_ASSET_PREFIX;
  pendingRunPrefix: typeof PHASE_11A_PENDING_RUN_PREFIX;
  steps: typeof PHASE_11A_FUTURE_COMPOSITION_PREFLIGHT_STEPS;
  futureRunClose: typeof PHASE_11A_FUTURE_RUN_CLOSE_TRANSITIONS;
  authorizationRequired: "AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS";
};

export function describePhase11AExistingProviderCompositionPreflight(): Phase11AExistingProviderCompositionPreflightPlan {
  return {
    prepared: true,
    executed: false,
    providerAssetRead: false,
    providerCalled: false,
    ProductionStorageWrite: false,
    HumanReviewRequired: true,
    pngFiltersSupported: [0, 1, 2, 3, 4],
    targetProviderAssetPrefix: PHASE_11A_EXISTING_PROVIDER_ASSET_PREFIX,
    rejectedAssetPrefixUnchanged: PHASE_11A_REJECTED_PROVIDER_ASSET_PREFIX,
    pendingRunPrefix: PHASE_11A_PENDING_RUN_PREFIX,
    steps: PHASE_11A_FUTURE_COMPOSITION_PREFLIGHT_STEPS,
    futureRunClose: PHASE_11A_FUTURE_RUN_CLOSE_TRANSITIONS,
    authorizationRequired: "AUTH_11A_COMPOSE_EXISTING_PROVIDER_PNG_FILTERS",
  };
}

export function assertPhase11AExistingProviderCompositionPreflightNotAuthorized(): never {
  throw new Error(
    "Phase 11A existing-provider composition preflight is prepared but not authorized in this phase.",
  );
}

export const PHASE_11A_COMPOSITION_PREFLIGHT_CONFIRM_ENV =
  "CONFIRM_PHASE_11A_EXISTING_PROVIDER_COMPOSITION_PREFLIGHT" as const;

export const PHASE_11A_COMPOSITION_PREFLIGHT_FORBIDDEN_EXECUTE_ENV =
  "PHASE_11A_ALLOW_EXECUTE" as const;

export function assertPhase11ACompositionPreflightConfirm(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): void {
  if (env[PHASE_11A_COMPOSITION_PREFLIGHT_CONFIRM_ENV] !== "1") {
    throw new Error("CONFIRM_PHASE_11A_EXISTING_PROVIDER_COMPOSITION_PREFLIGHT required");
  }
  if (env[PHASE_11A_COMPOSITION_PREFLIGHT_FORBIDDEN_EXECUTE_ENV] === "1") {
    throw new Error("PHASE_11A_ALLOW_EXECUTE is forbidden for this preflight");
  }
}

const LEAK_RE = /sk-|data:image\/|base64,|https?:\/\/|token=|sig=/i;

export function assertPhase11ACompositionPreflightReportRedacted(blob: string): void {
  if (LEAK_RE.test(blob)) {
    throw new Error("preflight report leak");
  }
}

export function redactChecksumPrefix(checksum: string, chars = 16): string {
  return /^[a-f0-9]{16,64}$/i.test(checksum) ? checksum.slice(0, chars) : "invalid";
}
