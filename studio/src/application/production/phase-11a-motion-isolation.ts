/**
 * Phase 11A-RESUME — isolation guards between main media pipeline and Motion Transfer.
 * Documentary / non-paid. Prevents accidental reuse of MV-001 scope.
 */

export const PHASE_11A_RESUME_VERSION = "phase-11a-resume-1.0.0" as const;

/** Documented Motion project — must never be the 11A media smoke project. */
export const MV001_MOTION_PROJECT_ID =
  "390c25db-69e1-403a-83c5-7afcb4b85e84" as const;

export const MV001_BENCHMARK_SCOPE = "MV-001" as const;
export const MV002_STATUS_DEFERRED = "DEFERRED" as const;

const MOTION_ENDPOINT_MARKERS = [
  "motion-control",
  "motion_transfer",
  "kling-video/v3/pro/motion-control",
] as const;

export function assertPhase11ADoesNotUseMotionProject(projectId: string): void {
  if (projectId.trim() === MV001_MOTION_PROJECT_ID) {
    throw new Error(
      "Phase 11A media pipeline must not use the MV-001 Motion project.",
    );
  }
}

export function assertPhase11ADoesNotUseMv001PrivacyPack(scope: string): void {
  if (
    scope === MV001_BENCHMARK_SCOPE ||
    scope === "ACCEPTED_LIMITED_MV001" ||
    scope.toUpperCase().includes("MV-001")
  ) {
    throw new Error(
      "Phase 11A must not use the MV-001 Privacy Pack — media privacy is a separate Auth.",
    );
  }
}

export function assertPhase11ADoesNotInvokeMotionEndpoint(modelOrAction: string): void {
  const v = modelOrAction.toLowerCase();
  for (const marker of MOTION_ENDPOINT_MARKERS) {
    if (v.includes(marker.toLowerCase())) {
      throw new Error(
        `Phase 11A must not invoke Motion endpoint/action: ${modelOrAction}`,
      );
    }
  }
}

export function assertPhase11ADoesNotReuseMv001AssetIds(assetIds: readonly string[]): void {
  const forbiddenExact = new Set([
    "2d7ffcad-fa49-4ad6-9cbb-0b710c570345", // approved motion output
  ]);
  for (const id of assetIds) {
    const t = id.trim().toLowerCase();
    if (forbiddenExact.has(t)) {
      throw new Error("Phase 11A must not reuse MV-001 private output asset.");
    }
  }
}

/** Ops status after MT-015A human decision: MV-002 deferred. */
export function assertMv002RemainsDeferred(status: string): void {
  if (status !== MV002_STATUS_DEFERRED && status !== "DESIGN_READY_DEFERRED") {
    throw new Error(
      "MV-002 must remain DEFERRED during Phase 11A-RESUME — no Privacy/budget/media Auth.",
    );
  }
}

export function assertMotionRegistryStaysDisabled(input: {
  enabled: boolean;
  paidExecution: boolean;
}): void {
  if (input.enabled || input.paidExecution) {
    throw new Error(
      "Motion Registry must remain enabled=false and paidExecution=false during Phase 11A.",
    );
  }
}

/** Budget snapshot used by 11A-RESUME docs (USD cents). */
export const PHASE_11A_RESUME_BUDGET = {
  hardMinor: 274,
  committedMinor: 247,
  reservedMinor: 0,
  availableMinor: 27,
  /** OpenAI gpt-image-1 1024 low indicative */
  imageEstimateMinor: 1,
  imageReservationMinor: 2,
  imageShortfallMinor: 0,
  /** fal PuLID indicative */
  falImageEstimateMinor: 5,
  falImageReservationMinor: 6,
  falImageShortfallMinor: 0,
  /** ElevenLabs short TTS indicative */
  voiceEstimateMinor: 2,
  voiceReservationMinor: 3,
  voiceShortfallMinor: 0,
  /** Hailuo 6s indicative — does NOT fit available */
  videoEstimateMinor: 30,
  videoReservationMinor: 36,
  videoShortfallMinor: 9,
} as const;

export function phase11AShortfall(
  reservationMinor: number,
  availableMinor = PHASE_11A_RESUME_BUDGET.availableMinor,
): number {
  return Math.max(0, reservationMinor - availableMinor);
}
