/**
 * Generic artifact-bundle coherence and merge/export authorization.
 * Resolves plan/run/output explicitly. No phase-specific UUIDs.
 */
import { createHash } from "node:crypto";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export const ARTIFACT_BUNDLE_COHERENCE_VERSION = "artifact-bundle-coherence-1.0.0" as const;

export type ArtifactIdentity = {
  workspaceId: string;
  projectId: string;
  artifactId: string;
  revision: number;
};

export type ArtifactBundleMember = ArtifactIdentity & {
  artifactType: string;
  sceneId?: string | null;
  runId?: string | null;
  jobId?: string | null;
  generationPlanId?: string | null;
  planFingerprint?: string | null;
  sourceAssetId?: string | null;
  outputAssetId?: string | null;
  capability?: string | null;
  action?: string | null;
  checksum?: string | null;
  lifecycle?: string | null;
  stale?: boolean;
  quarantined?: boolean;
};

export type HumanReviewMember = {
  decisionId: string;
  decision: string;
  assetId: string;
  requestId?: string | null;
};

export type OutputMember = {
  assetId: string;
  checksum?: string | null;
  lifecycle: string;
  active: boolean;
  published: boolean;
  stale?: boolean;
  quarantined?: boolean;
};

export type ArtifactBundle = {
  workspaceId: string;
  projectId: string;
  sceneId?: string | null;
  runId: string;
  jobId?: string | null;
  generationPlanId: string;
  planFingerprint?: string | null;
  sourceAssetId?: string | null;
  outputAssetId: string;
  capability?: string | null;
  action?: string | null;
  generationPlan: ArtifactBundleMember;
  qualityReport: ArtifactBundleMember;
  productionResult: ArtifactBundleMember;
  humanReview?: HumanReviewMember | null;
  output: OutputMember;
};

export type CoherenceIssue = {
  code: string;
  message: string;
};

export type ArtifactBundleCoherenceResult = {
  coherent: boolean;
  issues: CoherenceIssue[];
};

export type NaivePointerSetInput = {
  workspaceId: string;
  projectId: string;
  activeGenerationPlan: ArtifactBundleMember;
  activeQualityReport: ArtifactBundleMember;
  activeProductionResult: ArtifactBundleMember;
};

export type MergeExportAuthorizationInput = {
  deliveryStatus?: string | null;
  mergeExportAuthorized: boolean;
  outputApproved: boolean;
  outputSelected: boolean;
  outputActive?: boolean;
  humanReviewApproved: boolean;
  stale?: boolean;
  quarantined?: boolean;
  bundleCoherent: boolean;
  downstreamEnabled: boolean;
  requireActivation?: boolean;
};

export type MergeExportAuthorizationDecision = {
  mergeAllowed: boolean;
  exportAllowed: boolean;
  downstreamAllowed: boolean;
  reasons: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function issue(code: string, message: string): CoherenceIssue {
  return { code, message: redactCoherenceError(message) };
}

function sameId(left?: string | null, right?: string | null): boolean {
  return Boolean(left) && Boolean(right) && left === right;
}

function present(value?: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

export function redactCoherenceError(message: string): string {
  return message
    .replace(UUID_RE, (id) => `${id.slice(0, 8)}…`)
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/data:[^,\s]+,[^\s]+/gi, "[redacted-data]");
}

/**
 * Fail-closed: missing authorization is false. An explicit false on any
 * phase or delivery field wins over an explicit true elsewhere.
 */
export function readMergeExportAuthorized(value: unknown): boolean {
  const rec = asRecord(value);
  const delivery = asRecord(rec.delivery);
  const phase11a = asRecord(rec.phase11a);
  const phase11b = asRecord(rec.phase11b);
  const flags = [
    rec.mergeExportAuthorized,
    delivery.mergeExportAuthorized,
    phase11a.mergeExportAuthorized,
    phase11b.mergeExportAuthorized,
  ];
  if (flags.some((flag) => flag === false)) return false;
  return flags.some((flag) => flag === true);
}

export function evaluateArtifactBundleCoherence(
  bundle: ArtifactBundle,
): ArtifactBundleCoherenceResult {
  const issues: CoherenceIssue[] = [];
  const members: ArtifactBundleMember[] = [
    bundle.generationPlan,
    bundle.qualityReport,
    bundle.productionResult,
  ];

  if (!present(bundle.workspaceId) || !present(bundle.projectId)) {
    issues.push(issue("scope_missing", "Workspace ou projet absent."));
  }
  if (!present(bundle.generationPlanId)) {
    issues.push(issue("plan_absent", "GenerationPlan absent."));
  }
  if (!present(bundle.outputAssetId)) {
    issues.push(issue("output_absent", "Output asset absent."));
  }
  if (!present(bundle.runId)) {
    issues.push(issue("run_absent", "Run absent."));
  }

  for (const member of members) {
    if (present(bundle.workspaceId) && member.workspaceId !== bundle.workspaceId) {
      issues.push(issue("workspace_mismatch", "Workspace incoherent entre artifacts."));
    }
    if (present(bundle.projectId) && member.projectId !== bundle.projectId) {
      issues.push(issue("project_mismatch", "Projet incoherent entre artifacts."));
    }
    if (present(bundle.sceneId) && present(member.sceneId) && member.sceneId !== bundle.sceneId) {
      issues.push(issue("scene_mismatch", "Scene incoherente entre artifacts."));
    }
    if (present(bundle.runId) && present(member.runId) && member.runId !== bundle.runId) {
      issues.push(issue("run_mismatch", "Run incoherent entre artifacts."));
    }
    if (present(bundle.jobId) && present(member.jobId) && member.jobId !== bundle.jobId) {
      issues.push(issue("job_mismatch", "Job incoherent entre artifacts."));
    }
    if (
      present(bundle.generationPlanId) &&
      present(member.generationPlanId) &&
      member.generationPlanId !== bundle.generationPlanId
    ) {
      issues.push(issue("plan_mismatch", "GenerationPlan incoherent entre artifacts."));
    }
    if (
      present(bundle.planFingerprint) &&
      present(member.planFingerprint) &&
      member.planFingerprint !== bundle.planFingerprint
    ) {
      issues.push(issue("plan_fingerprint_mismatch", "Fingerprint de plan incoherent."));
    }
    if (
      present(bundle.sourceAssetId) &&
      present(member.sourceAssetId) &&
      member.sourceAssetId !== bundle.sourceAssetId
    ) {
      issues.push(issue("source_mismatch", "Source asset incoherente."));
    }
    if (
      present(bundle.outputAssetId) &&
      present(member.outputAssetId) &&
      member.outputAssetId !== bundle.outputAssetId
    ) {
      issues.push(issue("output_mismatch", "Output asset incoherent."));
    }
    if (
      present(bundle.capability) &&
      present(member.capability) &&
      member.capability !== bundle.capability
    ) {
      issues.push(issue("capability_mismatch", "Capability incoherente."));
    }
    if (present(bundle.action) && present(member.action) && member.action !== bundle.action) {
      issues.push(issue("action_mismatch", "Action incoherente."));
    }
    if (member.stale === true) {
      issues.push(issue("stale_artifact", "Artifact stale refuse."));
    }
    if (member.quarantined === true) {
      issues.push(issue("quarantined_artifact", "Artifact quarantaine refuse."));
    }
  }

  if (
    !present(bundle.generationPlan.generationPlanId) &&
    !present(bundle.generationPlan.outputAssetId) &&
    !present(bundle.generationPlan.sourceAssetId)
  ) {
    issues.push(issue("plan_provenance_missing", "GenerationPlan sans provenance."));
  }
  if (!present(bundle.qualityReport.outputAssetId)) {
    issues.push(issue("quality_report_asset_missing", "Quality Report sans output."));
  } else if (
    present(bundle.outputAssetId) &&
    bundle.qualityReport.outputAssetId !== bundle.outputAssetId
  ) {
    issues.push(issue("quality_report_asset_mismatch", "Quality Report porte sur un autre asset."));
  }
  if (
    present(bundle.productionResult.generationPlanId) &&
    present(bundle.generationPlanId) &&
    bundle.productionResult.generationPlanId !== bundle.generationPlanId
  ) {
    issues.push(issue("production_result_plan_mismatch", "Production Result porte sur un autre plan."));
  }
  if (
    present(bundle.productionResult.runId) &&
    present(bundle.runId) &&
    bundle.productionResult.runId !== bundle.runId
  ) {
    issues.push(issue("production_result_run_mismatch", "Production Result porte sur un autre run."));
  }
  if (
    present(bundle.productionResult.outputAssetId) &&
    present(bundle.outputAssetId) &&
    bundle.productionResult.outputAssetId !== bundle.outputAssetId
  ) {
    issues.push(issue("production_result_output_mismatch", "Production Result porte sur un autre output."));
  }

  if (bundle.humanReview) {
    if (bundle.humanReview.assetId !== bundle.outputAssetId) {
      issues.push(issue("human_review_asset_mismatch", "Human Review porte sur un autre asset."));
    }
    if (
      present(bundle.humanReview.decision) &&
      bundle.humanReview.decision !== "approved" &&
      bundle.humanReview.decision !== "pending"
    ) {
      issues.push(issue("human_review_incompatible", "Human Review incompatible avec le bundle."));
    }
  }

  if (bundle.output.assetId !== bundle.outputAssetId) {
    issues.push(issue("output_identity_mismatch", "Identite output incoherente."));
  }
  if (bundle.output.stale === true || bundle.output.quarantined === true) {
    issues.push(issue("output_stale_or_quarantined", "Output stale ou quarantaine refuse."));
  }
  const incompatibleLifecycle = new Set(["rejected", "failed", "quarantined", "expired"]);
  if (incompatibleLifecycle.has(bundle.output.lifecycle)) {
    issues.push(issue("lifecycle_incompatible", "Lifecycle output incompatible."));
  }
  if (
    present(bundle.output.checksum) &&
    present(bundle.qualityReport.checksum) &&
    bundle.output.checksum !== bundle.qualityReport.checksum
  ) {
    issues.push(issue("checksum_mismatch", "Checksum contradictoire."));
  }
  if (
    present(bundle.output.checksum) &&
    present(bundle.productionResult.checksum) &&
    bundle.output.checksum !== bundle.productionResult.checksum
  ) {
    issues.push(issue("checksum_mismatch", "Checksum contradictoire."));
  }

  return { coherent: issues.length === 0, issues };
}

export function evaluateNaiveActivePointerSet(
  input: NaivePointerSetInput,
): ArtifactBundleCoherenceResult {
  const issues: CoherenceIssue[] = [];
  const { activeGenerationPlan: plan, activeQualityReport: qr, activeProductionResult: pr } =
    input;

  if (plan.workspaceId !== input.workspaceId || qr.workspaceId !== input.workspaceId || pr.workspaceId !== input.workspaceId) {
    issues.push(issue("workspace_mismatch", "Pointeurs actifs : workspace incoherent."));
  }
  if (plan.projectId !== input.projectId || qr.projectId !== input.projectId || pr.projectId !== input.projectId) {
    issues.push(issue("project_mismatch", "Pointeurs actifs : projet incoherent."));
  }
  if (present(qr.generationPlanId) && qr.generationPlanId !== plan.artifactId) {
    issues.push(issue("naive_plan_mismatch", "Quality Report actif n'appartient pas au GenerationPlan actif."));
  }
  if (present(pr.generationPlanId) && pr.generationPlanId !== plan.artifactId) {
    issues.push(issue("naive_plan_mismatch", "Production Result actif n'appartient pas au GenerationPlan actif."));
  }
  if (present(qr.outputAssetId) && present(pr.outputAssetId) && qr.outputAssetId !== pr.outputAssetId) {
    issues.push(issue("naive_output_mismatch", "QR et PR actifs ne portent pas sur le meme output."));
  }
  if (present(plan.capability) && present(qr.capability) && plan.capability !== qr.capability) {
    issues.push(issue("naive_capability_mismatch", "GenerationPlan actif et Quality Report actif de capabilities distinctes."));
  }
  if (present(plan.capability) && present(pr.capability) && plan.capability !== pr.capability) {
    issues.push(issue("naive_capability_mismatch", "GenerationPlan actif et Production Result actif de capabilities distinctes."));
  }
  if (present(plan.outputAssetId) && present(pr.outputAssetId) && plan.outputAssetId !== pr.outputAssetId) {
    issues.push(issue("naive_output_mismatch", "GenerationPlan actif et Production Result actif d'outputs distincts."));
  }
  if (!present(plan.generationPlanId) && !present(plan.sourceAssetId) && !present(plan.outputAssetId)) {
    issues.push(issue("plan_provenance_missing", "GenerationPlan actif sans provenance."));
  }

  return { coherent: issues.length === 0, issues };
}

export function selectExplicitArtifactBundle(input: {
  candidates: ArtifactBundle[];
  selectedOutputAssetId?: string | null;
  selectedRunId?: string | null;
  selectedGenerationPlanId?: string | null;
}): { ok: true; bundle: ArtifactBundle } | { ok: false; code: string; message: string } {
  if (input.candidates.length === 0) {
    return {
      ok: false,
      code: "bundle_absent",
      message: redactCoherenceError("Aucun bundle artifact resolvable."),
    };
  }

  const selected = input.candidates.filter((bundle) => {
    if (present(input.selectedOutputAssetId) && bundle.outputAssetId !== input.selectedOutputAssetId) {
      return false;
    }
    if (present(input.selectedRunId) && bundle.runId !== input.selectedRunId) {
      return false;
    }
    if (
      present(input.selectedGenerationPlanId) &&
      bundle.generationPlanId !== input.selectedGenerationPlanId
    ) {
      return false;
    }
    return true;
  });

  const hasSelection =
    present(input.selectedOutputAssetId) ||
    present(input.selectedRunId) ||
    present(input.selectedGenerationPlanId);

  if (!hasSelection && input.candidates.length > 1) {
    return {
      ok: false,
      code: "ambiguous_bundles",
      message: redactCoherenceError("Plusieurs bundles candidats sans selection explicite."),
    };
  }
  if (selected.length === 0) {
    return {
      ok: false,
      code: "bundle_selection_mismatch",
      message: redactCoherenceError("La selection explicite ne correspond a aucun bundle."),
    };
  }
  if (selected.length > 1) {
    return {
      ok: false,
      code: "ambiguous_bundles",
      message: redactCoherenceError("Selection insuffisante : plusieurs bundles restent candidats."),
    };
  }
  return { ok: true, bundle: selected[0]! };
}

export function evaluateMergeExportAuthorization(
  input: MergeExportAuthorizationInput,
): MergeExportAuthorizationDecision {
  const reasons: string[] = [];
  if (input.deliveryStatus !== "merge_ready") {
    reasons.push("delivery_not_ready");
  }
  if (input.mergeExportAuthorized !== true) {
    reasons.push(
      input.deliveryStatus === "merge_ready"
        ? "merge_ready_without_authorization"
        : "merge_export_unauthorized",
    );
  }
  if (!input.outputApproved) reasons.push("output_not_approved");
  if (!input.outputSelected) reasons.push("output_not_selected");
  if (!input.humanReviewApproved) reasons.push("human_review_not_approved");
  if (input.stale === true) reasons.push("stale_artifact");
  if (input.quarantined === true) reasons.push("quarantined_artifact");
  if (!input.bundleCoherent) reasons.push("bundle_incoherent");
  if (input.requireActivation === true && input.outputActive !== true) {
    reasons.push("output_not_active");
  }

  const mergeAllowed = reasons.length === 0;
  const exportAllowed = mergeAllowed;
  const downstreamAllowed = mergeAllowed && input.downstreamEnabled === true;
  if (!input.downstreamEnabled) {
    reasons.push("downstream_flag_off");
  }

  return {
    mergeAllowed,
    exportAllowed,
    downstreamAllowed,
    reasons: reasons.map((code) => redactCoherenceError(code)),
  };
}

export function fingerprintCoherenceDecision(fields: string[]): string {
  return createHash("sha256").update(fields.join("|")).digest("hex");
}

export function sameIds(left?: string | null, right?: string | null): boolean {
  return sameId(left, right);
}
