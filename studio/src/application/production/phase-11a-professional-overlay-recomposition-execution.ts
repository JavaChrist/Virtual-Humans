/**
 * Phase 11A professional overlay recomposition execution (1.2.0).
 * Live Storage writes are gated. This module is local/admin only.
 */
import { assertPhase11AProfessionalSourceVersions } from "./phase-11a-professional-overlay-real-parent-preflight";

export const PHASE_11A_PROFESSIONAL_RECOMPOSITION_AUTH =
  "AUTH_11A_PROFESSIONAL_OVERLAY_RECOMPOSITION_EXECUTION" as const;
export const PHASE_11A_PROFESSIONAL_RECOMPOSITION_CONFIRM_ENV =
  "CONFIRM_PHASE_11A_PROFESSIONAL_OVERLAY_RECOMPOSITION_EXECUTION" as const;
export const PHASE_11A_PROFESSIONAL_RECOMPOSITION_FORBIDDEN_EXECUTE_ENV =
  "PHASE_11A_ALLOW_EXECUTE" as const;

export const PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT =
  "d395ec7d8c9ce33ab39974764de3b83a0ca670ce" as const;
export const PHASE_11A_PROFESSIONAL_APPLICATIVE_COMMIT_SHORT = "d395ec7" as const;
export const PHASE_11A_PROFESSIONAL_PREFLIGHT_DOCS_COMMIT_SHORT = "e94850c" as const;

export const PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM =
  "9ac484b7a1db3264330ee09ddcb197fa8d83e6735a3476c7af5ab1547ff317f0" as const;
export const PHASE_11A_PROFESSIONAL_EXPECTED_BYTES = 1_338_305 as const;
export const PHASE_11A_PROFESSIONAL_EXPECTED_FINGERPRINT_PREFIX = "49284892d6bac249" as const;
export const PHASE_11A_PROFESSIONAL_EXPECTED_ASSET_PREFIX = "49284892" as const;
export const PHASE_11A_PROFESSIONAL_EXPECTED_OVERLAY_FP_PREFIX = "4cfcc445f41ca453" as const;
export const PHASE_11A_PROFESSIONAL_EXPECTED_CONTRAST = 14.67 as const;
export const PHASE_11A_PROFESSIONAL_PREFLIGHT_VISUAL_DECISION = "ACCEPT_PREFLIGHT_VISUAL" as const;

export const PHASE_11A_PROFESSIONAL_APPLICATIVE_FILES = [
  "studio/src/application/production/phase-11a-vector-compositor.ts",
  "studio/src/application/production/phase-11a-overlay-latin-vector.ts",
  "studio/src/application/production/phase-11a-overlay-layout-1-2.ts",
  "studio/src/application/production/phase-11a-overlay-font.ts",
  "studio/src/application/production/phase-11a-typographic-qc.ts",
  "studio/src/application/production/phase-11a-deterministic-compositor.ts",
  "studio/src/domain/production/image-text-overlay.ts",
  "studio/src/application/production/phase-11a-composed-ingest.ts",
  "studio/src/application/production/phase-11a-image-role-storage.ts",
] as const;

export function assertPhase11AProfessionalRecompositionConfirm(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): void {
  if (env[PHASE_11A_PROFESSIONAL_RECOMPOSITION_CONFIRM_ENV] !== "1") {
    throw new Error("CONFIRM_PHASE_11A_PROFESSIONAL_OVERLAY_RECOMPOSITION_EXECUTION required");
  }
  if (env[PHASE_11A_PROFESSIONAL_RECOMPOSITION_FORBIDDEN_EXECUTE_ENV] === "1") {
    throw new Error("PHASE_11A_ALLOW_EXECUTE is forbidden for this execution");
  }
}

export function assertPhase11AProfessionalExpectedRender(input: {
  checksumSha256: string;
  byteLength: number;
  width: number;
  height: number;
  fingerprint: string;
  assetId: string;
  overlayFingerprint: string;
  contrastRatio: number;
  titleFontSize: number;
  ctaFontSize: number;
  titleLineCount: number;
  ctaLineCount: number;
}): void {
  if (input.checksumSha256 !== PHASE_11A_PROFESSIONAL_EXPECTED_CHECKSUM) {
    throw new Error("STOP expected checksum mismatch");
  }
  if (input.byteLength !== PHASE_11A_PROFESSIONAL_EXPECTED_BYTES) {
    throw new Error("STOP expected size mismatch");
  }
  if (input.width !== 1024 || input.height !== 1024) {
    throw new Error("STOP expected dimensions mismatch");
  }
  if (!input.fingerprint.startsWith(PHASE_11A_PROFESSIONAL_EXPECTED_FINGERPRINT_PREFIX)) {
    throw new Error("STOP expected fingerprint mismatch");
  }
  if (!input.assetId.startsWith(PHASE_11A_PROFESSIONAL_EXPECTED_ASSET_PREFIX)) {
    throw new Error("STOP expected assetId mismatch");
  }
  if (!input.overlayFingerprint.startsWith(PHASE_11A_PROFESSIONAL_EXPECTED_OVERLAY_FP_PREFIX)) {
    throw new Error("STOP expected overlay fingerprint mismatch");
  }
  if (Math.abs(input.contrastRatio - PHASE_11A_PROFESSIONAL_EXPECTED_CONTRAST) > 0.02) {
    throw new Error("STOP expected contrast mismatch");
  }
  if (input.titleFontSize !== 40 || input.ctaFontSize !== 22) {
    throw new Error("STOP expected font sizes mismatch");
  }
  if (input.titleLineCount !== 1 || input.ctaLineCount !== 1) {
    throw new Error("STOP expected line counts mismatch");
  }
}

export function assertPhase11AProfessionalRuntimeVersions(input: {
  fontFamily: string;
  fontId: string;
  fontLicense: string;
  compositorVersion: string;
  layoutVersion: string;
  panelVersion: string;
  bitmapCompositorVersion: string;
}): void {
  assertPhase11AProfessionalSourceVersions(input);
}

const LEAK_RE = /sk-|data:image\/|base64,|https?:\/\/|token=|sig=/i;

export function assertPhase11AProfessionalExecutionReportRedacted(blob: string): void {
  if (LEAK_RE.test(blob)) {
    throw new Error("execution report leak");
  }
}
