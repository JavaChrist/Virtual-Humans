import { CostDomainError } from "./errors";
import { decideBudget, type BudgetDecision, type BudgetSnapshot } from "./budget";
import {
  MediaActionSchemaValues,
  type CostEstimate,
  type MediaAction,
} from "./estimate";

export type DryRunValidationCode =
  | "schema_ok"
  | "schema_invalid"
  | "reference_missing"
  | "capability_incompatible"
  | "duration_invalid"
  | "aspect_ratio_invalid"
  | "format_invalid"
  | "estimate_ok"
  | "estimate_failed"
  | "budget_ok"
  | "budget_rejected";

export type DryRunValidation = {
  code: DryRunValidationCode;
  passed: boolean;
  message: string;
};

export type DryRunWarning = {
  code: string;
  message: string;
};

/**
 * Theoretical capability profile — no provider SDK.
 * Provided by the caller (future Capability Registry / adapter).
 */
export type DryRunCapability = {
  action: MediaAction;
  supported: boolean;
  /** Allowed duration values in seconds (video / lipsync). */
  allowedSeconds?: number[];
  /** Allowed aspect ratios. */
  allowedAspectRatios?: string[];
  /** Required reference kinds, e.g. "image", "audio", "character". */
  requiredRefs?: string[];
};

export type DryRunInputs = {
  /** Opaque reference ids present for the request (not logged as content). */
  refs?: string[];
  /** Declared ref kinds available, e.g. ["image", "character"]. */
  refKinds?: string[];
  durationSeconds?: number;
  aspectRatio?: string;
  format?: string;
  modelId?: string;
  /** Extra free-form flags for future validators (booleans / numbers / strings only). */
  extras?: Record<string, string | number | boolean>;
};

export type DryRunRequest = {
  mode: "dry-run";
  projectId?: string;
  sceneId?: string;
  action: MediaAction;
  inputs: DryRunInputs;
};

export type DryRunResult = {
  executable: boolean;
  estimate: CostEstimate;
  budgetDecision: BudgetDecision;
  validations: DryRunValidation[];
  warnings: DryRunWarning[];
  /** Literal false — dry-run never calls a provider. */
  providerCalled: false;
};

export type RunDryRunOptions = {
  /** Pre-built estimate (domain-pure; caller builds via buildCostEstimate / legacy adapter). */
  estimate: CostEstimate;
  budget: BudgetSnapshot;
  capability?: DryRunCapability;
};

function push(
  list: DryRunValidation[],
  code: DryRunValidationCode,
  passed: boolean,
  message: string,
): void {
  list.push({ code, passed, message });
}

/**
 * Full dry-run validation without any provider call.
 * Pure: estimate and budget snapshot are supplied by the caller.
 */
export function runDryRun(request: DryRunRequest, options: RunDryRunOptions): DryRunResult {
  if (request.mode !== "dry-run") {
    throw new CostDomainError("invalid_dry_run", "Request mode must be dry-run.");
  }
  if (!(MediaActionSchemaValues as readonly string[]).includes(request.action)) {
    throw new CostDomainError("invalid_dry_run", "Unsupported media action.");
  }
  if (!request.inputs || typeof request.inputs !== "object") {
    throw new CostDomainError("invalid_dry_run", "Dry-run inputs are required.");
  }

  const validations: DryRunValidation[] = [];
  const warnings: DryRunWarning[] = [];

  // Schema
  push(validations, "schema_ok", true, "Dry-run request schema is valid.");

  // Capability
  const cap = options.capability;
  if (cap) {
    if (cap.action !== request.action) {
      push(
        validations,
        "capability_incompatible",
        false,
        "Capability profile does not match the requested action.",
      );
    } else if (!cap.supported) {
      push(
        validations,
        "capability_incompatible",
        false,
        "Requested action is not supported by the capability profile.",
      );
    } else {
      push(validations, "capability_incompatible", true, "Action is supported.");
    }

    if (cap.requiredRefs?.length) {
      const kinds = new Set(request.inputs.refKinds ?? []);
      const missing = cap.requiredRefs.filter((r) => !kinds.has(r));
      if (missing.length) {
        push(
          validations,
          "reference_missing",
          false,
          `Missing required references: ${missing.join(", ")}.`,
        );
      } else {
        push(validations, "reference_missing", true, "Required references are present.");
      }
    }

    if (
      request.inputs.durationSeconds != null &&
      cap.allowedSeconds &&
      cap.allowedSeconds.length > 0
    ) {
      const ok = cap.allowedSeconds.includes(request.inputs.durationSeconds);
      push(
        validations,
        "duration_invalid",
        ok,
        ok
          ? "Duration is within allowed values."
          : "Duration is not in the allowed set for this capability.",
      );
    }

    if (request.inputs.aspectRatio && cap.allowedAspectRatios?.length) {
      const ok = cap.allowedAspectRatios.includes(request.inputs.aspectRatio);
      push(
        validations,
        "aspect_ratio_invalid",
        ok,
        ok ? "Aspect ratio is supported." : "Aspect ratio is not supported.",
      );
    }
  } else {
    warnings.push({
      code: "capability_unspecified",
      message: "No capability profile provided; capability checks were skipped.",
    });
  }

  // Estimate coherence (already built; action must match)
  if (options.estimate.action !== request.action) {
    push(
      validations,
      "estimate_failed",
      false,
      "Estimate action does not match the dry-run request.",
    );
  } else {
    push(validations, "estimate_ok", true, "Estimate is attached.");
  }

  // Budget
  const budgetDecision = decideBudget(options.budget, options.estimate.total);
  if (budgetDecision.allowed) {
    push(validations, "budget_ok", true, "Budget allows the estimated cost.");
  } else {
    push(
      validations,
      "budget_rejected",
      false,
      `Budget rejected the estimate (${budgetDecision.reason}).`,
    );
  }

  const executable = validations.every((v) => v.passed);

  return Object.freeze({
    executable,
    estimate: options.estimate,
    budgetDecision,
    validations: Object.freeze(validations) as DryRunValidation[],
    warnings: Object.freeze(warnings) as DryRunWarning[],
    providerCalled: false as const,
  });
}
