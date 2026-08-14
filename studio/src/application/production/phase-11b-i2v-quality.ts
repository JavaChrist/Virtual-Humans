/**
 * Phase 11B — bounded I2V QC. Visual/motion scoring is unavailable_humanOnly.
 */
export type Phase11BI2vTechnicalQc = {
  mime: boolean;
  duration: boolean;
  dimensions: boolean;
  fps: boolean;
  size: boolean;
  checksum: boolean;
  probe: "unavailable" | "pass" | "fail";
  provenance: boolean;
  estimateMatch: boolean;
};

export type Phase11BI2vQualityResult = {
  technicalStatus: "accepted" | "rejected" | "needs_review";
  visualStatus: "unavailable_humanOnly";
  humanReviewRequired: true;
  autoApprove: false;
  checks: Phase11BI2vTechnicalQc;
};

export function evaluatePhase11BI2vTechnicalQuality(input: {
  mime: string;
  durationSeconds: number;
  expectedDurationSeconds: number;
  width: number;
  height: number;
  fps?: number;
  bytes: number;
  checksum: string;
  expectedChecksum?: string;
  probeAvailable: boolean;
  provenanceOk: boolean;
}): Phase11BI2vQualityResult {
  const mime = input.mime === "video/mp4" || input.mime === "video/webm";
  const duration = Math.abs(input.durationSeconds - input.expectedDurationSeconds) <= 1;
  const dimensions = input.width >= 256 && input.height >= 256;
  const fps = input.fps == null ? true : input.fps >= 12 && input.fps <= 60;
  const size = input.bytes > 0 && input.bytes <= 80 * 1024 * 1024;
  const checksum = Boolean(input.checksum) && (!input.expectedChecksum || input.checksum === input.expectedChecksum);
  const probe: Phase11BI2vTechnicalQc["probe"] = input.probeAvailable ? "pass" : "unavailable";
  const checks: Phase11BI2vTechnicalQc = {
    mime,
    duration,
    dimensions,
    fps,
    size,
    checksum,
    probe,
    provenance: input.provenanceOk,
    estimateMatch: duration,
  };
  const hardFail = !mime || !size || !checksum || !input.provenanceOk;
  return {
    technicalStatus: hardFail ? "rejected" : probe === "unavailable" ? "needs_review" : "accepted",
    visualStatus: "unavailable_humanOnly",
    humanReviewRequired: true,
    autoApprove: false,
    checks,
  };
}

export function assertPhase11BI2vNoAutoApprove(result: Phase11BI2vQualityResult): void {
  if (result.autoApprove || result.visualStatus !== "unavailable_humanOnly") {
    throw new Error("Phase 11B QC must not auto-approve visual/motion quality.");
  }
  if (!result.humanReviewRequired) {
    throw new Error("Phase 11B QC requires Human Review.");
  }
}
