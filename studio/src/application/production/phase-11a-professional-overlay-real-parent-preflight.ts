/**
 * Phase 11A — professional overlay real-parent preflight (memory only).
 * Does not read Production media by itself. Live script is separately gated.
 */
export const PHASE_11A_PROFESSIONAL_PREFLIGHT_AUTH =
  "AUTH_11A_PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT_NO_PROVIDER" as const;
export const PHASE_11A_PROFESSIONAL_PREFLIGHT_CONFIRM_ENV =
  "CONFIRM_PHASE_11A_PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT" as const;
export const PHASE_11A_PROFESSIONAL_PREFLIGHT_FORBIDDEN_EXECUTE_ENV =
  "PHASE_11A_ALLOW_EXECUTE" as const;

export const PHASE_11A_PROFESSIONAL_SOURCE_COMMIT =
  "d395ec7d8c9ce33ab39974764de3b83a0ca670ce" as const;
export const PHASE_11A_PROFESSIONAL_SOURCE_COMMIT_SHORT = "d395ec7" as const;

export const PHASE_11A_PROFESSIONAL_PARENT_PREFIX = "7832765d" as const;
export const PHASE_11A_PROFESSIONAL_PARENT_CHECKSUM_PREFIX = "1ac51f484420ef88" as const;
export const PHASE_11A_PROFESSIONAL_COMPOSED_110_PREFIX = "4429654f" as const;
export const PHASE_11A_PROFESSIONAL_COMPOSED_110_CHECKSUM_PREFIX = "b284e877e5a80e7a" as const;
export const PHASE_11A_PROFESSIONAL_COMPOSED_110_DECISION_PREFIX = "058faa7d" as const;
export const PHASE_11A_PROFESSIONAL_COMPOSED_100_PREFIX = "6a2beca9" as const;
export const PHASE_11A_PROFESSIONAL_COMPOSED_100_CHECKSUM_PREFIX = "d056b85aa4f9452d" as const;
export const PHASE_11A_PROFESSIONAL_COMPOSED_100_DECISION_PREFIX = "f1fcb832" as const;
export const PHASE_11A_PROFESSIONAL_SMOKE_PREFIX = "5d68ef64" as const;
export const PHASE_11A_PARENT_EXPECTED_BYTES = 1_131_237 as const;
export const PHASE_11A_SIGNED_URL_TTL_SEC = 60 as const;
export const PHASE_11A_SIGNED_URL_MAX_BYTES = 8 * 1024 * 1024;

export const PHASE_11A_PROFESSIONAL_PREVIEW_DIR =
  "studio/.tmp/phase-11a-professional-overlay-real-parent-preflight" as const;

export function assertPhase11AProfessionalPreflightConfirm(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): void {
  if (env[PHASE_11A_PROFESSIONAL_PREFLIGHT_CONFIRM_ENV] !== "1") {
    throw new Error("CONFIRM_PHASE_11A_PROFESSIONAL_OVERLAY_REAL_PARENT_PREFLIGHT required");
  }
  if (env[PHASE_11A_PROFESSIONAL_PREFLIGHT_FORBIDDEN_EXECUTE_ENV] === "1") {
    throw new Error("PHASE_11A_ALLOW_EXECUTE is forbidden for this preflight");
  }
}

const LEAK_RE = /sk-|data:image\/|base64,|https?:\/\/|token=|sig=/i;

export function assertPhase11AProfessionalPreflightReportRedacted(blob: string): void {
  if (LEAK_RE.test(blob)) {
    throw new Error("preflight report leak");
  }
}

export function redactChecksumPrefix(checksum: string, chars = 16): string {
  return /^[a-f0-9]{16,64}$/i.test(checksum) ? checksum.slice(0, chars) : "invalid";
}

export function assertPhase11AProfessionalSourceVersions(input: {
  fontFamily: string;
  fontId: string;
  fontLicense: string;
  compositorVersion: string;
  layoutVersion: string;
  panelVersion: string;
  bitmapCompositorVersion: string;
}): void {
  if (input.fontFamily !== "vhs-overlay-latin-vector-v1") {
    throw new Error("source font family");
  }
  if (input.fontId !== "vhs-overlay-latin-vector-outlines-v1") {
    throw new Error("source outlines");
  }
  if (input.fontLicense !== "original-work-in-repo") {
    throw new Error("source license");
  }
  if (input.compositorVersion !== "phase-11a-vector-compositor-1.2.0") {
    throw new Error("source compositor");
  }
  if (input.layoutVersion !== "phase-11a-overlay-layout-1.2.0") {
    throw new Error("source layout");
  }
  if (input.panelVersion !== "phase-11a-contrast-panel-1.2.0") {
    throw new Error("source panel");
  }
  if (input.bitmapCompositorVersion !== "phase-11a-bitmap-compositor-1.1.0") {
    throw new Error("1.1.0 compositor mutated");
  }
}
