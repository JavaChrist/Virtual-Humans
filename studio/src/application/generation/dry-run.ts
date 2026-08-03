/**
 * Generation Engine dry-run (VHS-109).
 * Never calls submit/poll/cancel or any network SDK.
 */

import type { CostEstimate } from "@/domain/cost";
import {
  assertStepPackageProfile,
  buildCommandFingerprint,
  isGenerationDomainError,
  validateGenerationCommand,
  type GenerationCommand,
  type GenerationValidation,
  type GenerationWarning,
} from "@/domain/generation";
import type { ProviderAdapterRegistry } from "./adapter-registry";
import { resolveCanonicalInput } from "./input-resolver";

export type GenerationEngineDryRunResult = {
  executable: boolean;
  providerCalled: false;
  adapterResolved: boolean;
  validations: GenerationValidation[];
  warnings: GenerationWarning[];
  estimate?: CostEstimate;
  fingerprint?: string;
};

export function runGenerationEngineDryRun(input: {
  command: GenerationCommand;
  registry: ProviderAdapterRegistry;
  aspectRatio?: "9:16" | "16:9" | "1:1";
}): GenerationEngineDryRunResult {
  const validations: GenerationValidation[] = [];
  const warnings: GenerationWarning[] = [];
  let adapterResolved = false;
  let executable = true;

  const push = (code: string, passed: boolean, message: string) => {
    validations.push({ code, passed, message });
    if (!passed) executable = false;
  };

  try {
    validateGenerationCommand(input.command);
    push("command", true, "Command is valid.");
  } catch (e) {
    push(
      "command",
      false,
      isGenerationDomainError(e) ? e.publicMessage : "Invalid command.",
    );
    return {
      executable: false,
      providerCalled: false,
      adapterResolved: false,
      validations,
      warnings,
    };
  }

  try {
    assertStepPackageProfile(input.command.step, input.command.scenePackage);
    push("profile", true, "Step profile matches package.");
  } catch (e) {
    push(
      "profile",
      false,
      isGenerationDomainError(e) ? e.publicMessage : "Profile mismatch.",
    );
  }

  try {
    input.registry.resolve(
      input.command.step.providerId,
      input.command.step.modelId,
      input.command.step.action,
    );
    adapterResolved = true;
    push("adapter", true, "Adapter resolved.");
  } catch (e) {
    push(
      "adapter",
      false,
      isGenerationDomainError(e) ? e.publicMessage : "Adapter not found.",
    );
  }

  let fingerprint: string | undefined;
  try {
    const canonical = resolveCanonicalInput(input.command, {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.command.step.expectedOutput.durationSeconds,
    });
    push("canonical_input", true, `Canonical input kind=${canonical.kind}.`);
    fingerprint = buildCommandFingerprint({
      projectId: input.command.projectId,
      planRevisionId: input.command.planRevisionId,
      sceneId: input.command.sceneId,
      stepId: input.command.step.id,
      action: input.command.step.action,
      providerId: input.command.step.providerId,
      modelId: input.command.step.modelId,
      capabilityProfile: input.command.step.capabilityProfile,
      promptVariantId: input.command.step.promptVariantId,
      referenceAssetIds: input.command.resolvedInputs.map((r) => r.asset.assetId),
      durationSeconds: input.command.step.expectedOutput.durationSeconds,
      aspectRatio: input.aspectRatio,
      dialogueCharCount: input.command.scenePackage.dialogue?.text.length,
      dependsOnStepIds: input.command.step.dependsOnStepIds,
      attempt: input.command.attempt,
    });
  } catch (e) {
    push(
      "canonical_input",
      false,
      isGenerationDomainError(e) ? e.publicMessage : "Cannot build canonical input.",
    );
  }

  // Local estimate from step — no provider estimate call
  const estimate = input.command.step.estimate;
  if (!estimate) {
    warnings.push({
      code: "estimate_unavailable",
      message: "No local CostEstimate attached to step.",
    });
  }

  // Idempotency key accepted by fal/openai/elevenlabs? document warning
  warnings.push({
    code: "idempotency_not_persisted",
    message:
      "Idempotency key is validated and transmitted; no durable store in this increment.",
  });
  warnings.push({
    code: "provider_idempotency_unsupported",
    message:
      "Underlying provider helpers do not accept the V2 idempotency key.",
  });

  return {
    executable,
    providerCalled: false,
    adapterResolved,
    validations,
    warnings,
    estimate,
    fingerprint,
  };
}
