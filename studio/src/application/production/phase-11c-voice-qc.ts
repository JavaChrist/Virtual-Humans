/**
 * Phase 11C — honest Voice QC. Perceptual scoring is unavailable_humanOnly.
 */
export type Phase11CVoiceTechnicalQc = {
  mime: boolean;
  size: boolean;
  checksum: boolean;
  decodable: "unavailable" | "pass" | "fail";
  duration: boolean;
  sampleRate: boolean;
  channels: boolean;
  bitrate: boolean;
  silence: "unavailable" | "pass" | "fail";
  durationVsText: boolean;
  provenance: boolean;
  estimate: boolean;
};

export type Phase11CVoiceQualityResult = {
  technicalStatus: "accepted" | "rejected" | "needs_review";
  perceptualStatus: "unavailable_humanOnly";
  humanReviewRequired: true;
  autoApprove: false;
  checks: Phase11CVoiceTechnicalQc;
};

export function evaluatePhase11CVoiceTechnicalQuality(input: {
  mime: string;
  bytes: number;
  checksum: string;
  expectedChecksum?: string;
  durationSeconds?: number;
  expectedDurationSeconds?: number;
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
  probeAvailable: boolean;
  provenanceOk: boolean;
  estimateOk: boolean;
}): Phase11CVoiceQualityResult {
  const mime = input.mime === "audio/mpeg";
  const size = input.bytes > 0 && input.bytes <= 5 * 1024 * 1024;
  const checksum = Boolean(input.checksum) && (!input.expectedChecksum || input.checksum === input.expectedChecksum);
  const duration =
    input.durationSeconds == null || input.expectedDurationSeconds == null
      ? true
      : Math.abs(input.durationSeconds - input.expectedDurationSeconds) <= 2;
  const sampleRate = input.sampleRate == null ? true : input.sampleRate === 44100;
  const channels = input.channels == null ? true : input.channels === 1 || input.channels === 2;
  const bitrate = input.bitrate == null ? true : input.bitrate >= 64_000 && input.bitrate <= 192_000;
  const decodable: Phase11CVoiceTechnicalQc["decodable"] = input.probeAvailable ? "pass" : "unavailable";
  const silence: Phase11CVoiceTechnicalQc["silence"] = "unavailable";
  const checks: Phase11CVoiceTechnicalQc = {
    mime,
    size,
    checksum,
    decodable,
    duration,
    sampleRate,
    channels,
    bitrate,
    silence,
    durationVsText: duration,
    provenance: input.provenanceOk,
    estimate: input.estimateOk,
  };
  const hardFail = !mime || !size || !checksum || !input.provenanceOk;
  return {
    technicalStatus: hardFail ? "rejected" : "needs_review",
    perceptualStatus: "unavailable_humanOnly",
    humanReviewRequired: true,
    autoApprove: false,
    checks,
  };
}

export function assertPhase11CVoiceNoAutoApprove(result: Phase11CVoiceQualityResult): void {
  if (result.autoApprove || result.perceptualStatus !== "unavailable_humanOnly") {
    throw new Error("Phase 11C QC must not invent a perceptual score or auto-approve.");
  }
  if (!result.humanReviewRequired) {
    throw new Error("Phase 11C QC requires Human Review.");
  }
}
