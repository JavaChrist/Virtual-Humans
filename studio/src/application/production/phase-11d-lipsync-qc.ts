/**
 * Prepared lipsync QC and future Human Review. No auto-approve. No merge/export.
 */
export type Phase11DLipsyncQc = {
  prepared: true;
  autoApproved: false;
  mimeOk: boolean;
  checksumPresent: boolean;
  probeAvailable: false;
  humanReviewRequired: true;
};

export type Phase11DLipsyncReviewHandoff = {
  prepared: true;
  persistedToProduction: false;
  decision: "none";
  lipsyncAuthorized: false;
  mergeExportAuthorized: false;
  activationAllowed: false;
};

export function evaluatePhase11DLipsyncTechnicalQuality(input: {
  mimeType: string;
  checksum: string;
}): Phase11DLipsyncQc {
  return {
    prepared: true,
    autoApproved: false,
    mimeOk: input.mimeType === "video/mp4",
    checksumPresent: /^[0-9a-f]{64}$/i.test(input.checksum),
    probeAvailable: false,
    humanReviewRequired: true,
  };
}

export function assertPhase11DLipsyncNoAutoApprove(qc: Phase11DLipsyncQc): void {
  if (qc.autoApproved) {
    throw new Error("Phase 11D: lipsync QC must not auto-approve.");
  }
}

export function createPhase11DLipsyncReviewHandoff(): Phase11DLipsyncReviewHandoff {
  return {
    prepared: true,
    persistedToProduction: false,
    decision: "none",
    lipsyncAuthorized: false,
    mergeExportAuthorized: false,
    activationAllowed: false,
  };
}

export function assertPhase11DReviewDoesNotOpenMerge(review: Phase11DLipsyncReviewHandoff): void {
  if (review.mergeExportAuthorized || review.activationAllowed || review.lipsyncAuthorized) {
    throw new Error("Phase 11D: Human Review handoff must not open lipsync/merge/activation.");
  }
}
