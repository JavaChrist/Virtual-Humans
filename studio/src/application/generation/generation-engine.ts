/**
 * Generation Engine — executes exactly one decided GenerationStep (VHS-109).
 * Never selects models, never triggers fallbacks, never orchestrates multi-step.
 */

import {
  assertExternalJobRef,
  assertStepPackageProfile,
  buildCommandFingerprint,
  GenerationDomainError,
  isGenerationDomainError,
  validateGenerationCommand,
  type ExternalJobRef,
  type GenerationCommand,
  type GenerationExecutionContext,
  type GenerationResult,
  type ProviderAdapter,
} from "@/domain/generation";
import type { ProviderAdapterRegistry } from "./adapter-registry";
import { resolveCanonicalInput } from "./input-resolver";
import { mapProviderError } from "@/infrastructure/providers/error-mapping";

export interface GenerationEngine {
  execute(
    command: GenerationCommand,
    context: GenerationExecutionContext,
  ): Promise<GenerationResult>;
  poll(
    job: ExternalJobRef,
    context: GenerationExecutionContext,
    meta: { modelId: string; providerId: string; action: string },
  ): Promise<GenerationResult>;
  cancel(
    job: ExternalJobRef,
    context: GenerationExecutionContext,
    meta: { modelId: string; providerId: string },
  ): Promise<GenerationResult>;
}

export type CreateGenerationEngineOptions = {
  registry: ProviderAdapterRegistry;
  /** Optional aspect ratio / duration enrichment. */
  defaultAspectRatio?: "9:16" | "16:9" | "1:1";
};

function providerContext(
  command: GenerationCommand,
  context: GenerationExecutionContext,
) {
  return {
    correlationId: context.correlationId,
    idempotencyKey: command.idempotencyKey,
    timeoutMs: context.timeoutMs ?? command.step.timeoutSeconds * 1000,
    requestedAt: context.requestedAt,
    signal: context.signal,
  };
}

export function createGenerationEngine(
  options: CreateGenerationEngineOptions,
): GenerationEngine {
  const { registry } = options;

  return {
    async execute(command, context) {
      // Never read fallbacks for execution
      void command.step.fallbacks;

      try {
        validateGenerationCommand(command);
        assertStepPackageProfile(command.step, command.scenePackage);

        const fingerprint = buildCommandFingerprint({
          projectId: command.projectId,
          planRevisionId: command.planRevisionId,
          sceneId: command.sceneId,
          stepId: command.step.id,
          action: command.step.action,
          providerId: command.step.providerId,
          modelId: command.step.modelId,
          capabilityProfile: command.step.capabilityProfile,
          promptVariantId: command.step.promptVariantId,
          referenceAssetIds: command.resolvedInputs.map((r) => r.asset.assetId),
          durationSeconds: command.step.expectedOutput.durationSeconds,
          aspectRatio: options.defaultAspectRatio,
          dialogueCharCount: command.scenePackage.dialogue?.text.length,
          dependsOnStepIds: command.step.dependsOnStepIds,
          attempt: command.attempt,
        });

        if (context.idempotencyStore) {
          const begin = await context.idempotencyStore.begin(
            command.idempotencyKey,
            fingerprint,
          );
          if (begin.status === "conflict") {
            return {
              status: "failed",
              failedAt: context.requestedAt,
              error: {
                code: "idempotency_conflict",
                retryable: false,
                publicMessage: "Idempotency key conflict.",
              },
            };
          }
        }

        const adapter = registry.resolve(
          command.step.providerId,
          command.step.modelId,
          command.step.action,
        );

        const canonical = resolveCanonicalInput(command, {
          aspectRatio: options.defaultAspectRatio,
          durationSeconds: command.step.expectedOutput.durationSeconds,
        });

        if (
          canonical.providerId !== command.step.providerId ||
          canonical.modelId !== command.step.modelId ||
          canonical.capabilityProfile !== command.step.capabilityProfile
        ) {
          throw new GenerationDomainError(
            "invalid_input",
            "Canonical input does not match generation step.",
          );
        }

        const pctx = providerContext(command, context);
        const submission = await adapter.submit(canonical, pctx);

        if (submission.status === "completed") {
          const result: GenerationResult = {
            status: "completed",
            output: submission.output,
            usage: submission.usage,
            completedAt: submission.completedAt,
          };
          if (context.idempotencyStore) {
            await context.idempotencyStore.complete(
              command.idempotencyKey,
              fingerprint,
            );
          }
          return result;
        }

        return {
          status: "submitted",
          providerJob: submission.providerJob,
          submittedAt: submission.submittedAt,
          pollAfterMs: submission.pollAfterMs,
        };
      } catch (e) {
        const failedAt = context.requestedAt;
        if (isGenerationDomainError(e)) {
          if (context.idempotencyStore) {
            await context.idempotencyStore.fail(command.idempotencyKey, e.code).catch(() => undefined);
          }
          return { status: "failed", error: e.toGenerationError(), failedAt };
        }
        const mapped = mapProviderError(e, {
          providerId: command.step.providerId,
          modelId: command.step.modelId,
        });
        return { status: "failed", error: mapped, failedAt };
      }
    },

    async poll(job, context, meta) {
      assertExternalJobRef(job, {
        providerId: meta.providerId,
        modelId: meta.modelId,
      });
      let adapter: ProviderAdapter;
      try {
        adapter = registry.resolve(
          meta.providerId,
          meta.modelId,
          meta.action as never,
        );
      } catch (e) {
        if (isGenerationDomainError(e)) {
          return { status: "failed", error: e.toGenerationError(), failedAt: context.requestedAt };
        }
        throw e;
      }
      if (!adapter.poll) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "polling_unsupported",
            retryable: false,
            publicMessage: "Polling is not supported for this adapter.",
            providerId: meta.providerId,
            modelId: meta.modelId,
          },
        };
      }
      try {
        const polled = await adapter.poll(job, {
          correlationId: context.correlationId,
          idempotencyKey: "poll",
          timeoutMs: context.timeoutMs ?? 30_000,
          requestedAt: context.requestedAt,
          signal: context.signal,
        });
        if (polled.status === "completed") {
          return {
            status: "completed",
            output: polled.output,
            providerJob: polled.providerJob,
            usage: polled.usage,
            completedAt: polled.completedAt,
          };
        }
        if (polled.status === "processing") {
          return {
            status: "processing",
            providerJob: polled.providerJob,
            progress: polled.progress,
            pollAfterMs: polled.pollAfterMs,
          };
        }
        return {
          status: "failed",
          error: polled.error,
          providerJob: polled.providerJob,
          failedAt: polled.failedAt,
        };
      } catch (e) {
        if (isGenerationDomainError(e)) {
          return { status: "failed", error: e.toGenerationError(), failedAt: context.requestedAt };
        }
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: mapProviderError(e, meta),
        };
      }
    },

    async cancel(job, context, meta) {
      assertExternalJobRef(job, meta);
      let adapter: ProviderAdapter;
      try {
        // action unused for cancel resolve — use a dummy supported check via list
        const found = registry.list().find((a) => a.providerId === meta.providerId);
        if (!found) {
          throw new GenerationDomainError("adapter_not_found", "No adapter for provider.", {
            providerId: meta.providerId,
          });
        }
        adapter = found;
      } catch (e) {
        if (isGenerationDomainError(e)) {
          return { status: "failed", error: e.toGenerationError(), failedAt: context.requestedAt };
        }
        throw e;
      }
      if (!adapter.cancel) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "cancellation_unsupported",
            retryable: false,
            publicMessage: "Cancellation is not supported for this adapter.",
            providerId: meta.providerId,
            modelId: meta.modelId,
          },
        };
      }
      const cancelled = await adapter.cancel(job, {
        correlationId: context.correlationId,
        idempotencyKey: "cancel",
        timeoutMs: context.timeoutMs ?? 30_000,
        requestedAt: context.requestedAt,
        signal: context.signal,
      });
      return {
        status: "cancelled",
        providerJob: cancelled.providerJob,
        cancelledAt: cancelled.cancelledAt,
      };
    },
  };
}
