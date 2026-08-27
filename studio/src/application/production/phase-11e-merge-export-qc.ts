/**
 * Prepared merge/export QC and future Human Review.
 * No auto-approve. No publication. mergeExportAuthorized stays false.
 */
export type Phase11EMergeExportQc = {
  prepared: true;
  autoApproved: false;
  metadataOk: boolean;
  checksumPresent: boolean;
  filesProduced: false;
  urlsCreated: false;
  probeAvailable: false;
  humanReviewRequired: true;
};

export type Phase11EMergeExportReviewHandoff = {
  prepared: true;
  persistedToProduction: false;
  decision: "none";
  mergeExportAuthorized: false;
  publicationAllowed: false;
  downloadAllowed: false;
  activationAllowed: false;
};

export function evaluatePhase11EMergeExportTechnicalQuality(input: {
  checksum: string;
  synthetic: boolean;
  filesCreated: number;
  urlsCreated: number;
}): Phase11EMergeExportQc {
  return {
    prepared: true,
    autoApproved: false,
    metadataOk: input.synthetic === true && input.filesCreated === 0 && input.urlsCreated === 0,
    checksumPresent: /^[0-9a-f]{64}$/i.test(input.checksum),
    filesProduced: false,
    urlsCreated: false,
    probeAvailable: false,
    humanReviewRequired: true,
  };
}

export function assertPhase11EMergeExportNoAutoApprove(qc: Phase11EMergeExportQc): void {
  if (qc.autoApproved) {
    throw new Error("Phase 11E: merge/export QC must not auto-approve.");
  }
}

export function createPhase11EMergeExportReviewHandoff(): Phase11EMergeExportReviewHandoff {
  return {
    prepared: true,
    persistedToProduction: false,
    decision: "none",
    mergeExportAuthorized: false,
    publicationAllowed: false,
    downloadAllowed: false,
    activationAllowed: false,
  };
}

export function assertPhase11EReviewDoesNotOpenMerge(review: Phase11EMergeExportReviewHandoff): void {
  if (
    review.mergeExportAuthorized ||
    review.activationAllowed ||
    review.publicationAllowed ||
    review.downloadAllowed
  ) {
    throw new Error("Phase 11E: Human Review handoff must not open merge/export/publication.");
  }
}

export function assertCompletedDoesNotAuthorizeMergeExport(input: {
  completed?: boolean;
  approved?: boolean;
  mergeReady?: boolean;
  fakeLipsyncSucceeded?: boolean;
  mergeExportAuthorized: boolean;
}): void {
  if (input.mergeExportAuthorized) {
    throw new Error("Phase 11E: completed, approved, merge_ready, or fake lipsync never authorize merge/export.");
  }
}
