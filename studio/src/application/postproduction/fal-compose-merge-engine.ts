/**
 * Fal compose MergeEngine adapter — injectable, not auto-wired to Production Director (VHS-111B).
 */

import {
  FAL_COMPOSE_DECLARED_CAPABILITIES,
  isPostProductionDomainError,
  validateMergePlanAgainstCapabilities,
  type MergeEngineCapabilities,
  type MergeExecutionContext,
  type MergePlan,
  type MergeResult,
  type MergeValidationResult,
} from "@/domain/postproduction";
import {
  buildComposeVideoAsset,
  buildFalComposePayload,
  mapFalComposeClientError,
  type FalComposeClientPort,
} from "@/infrastructure/postproduction/fal-compose";
import { expiresAtFrom } from "@/infrastructure/providers/output-mapping";
import { MERGE_MODEL_ID } from "@/lib/pricing";
import { mapMergePlanToFalComposeInput } from "./map-merge-plan";
import type { MergeEngine } from "./ports";

export const FAL_COMPOSE_MERGE_CAPABILITIES: MergeEngineCapabilities = Object.freeze({
  ...FAL_COMPOSE_DECLARED_CAPABILITIES,
  version: "fal-compose.merge-engine.v1",
  executionEnabled: true,
  /** merge-audio is out of scope for this engine */
  singleAudioMux: false,
});

export type CreateFalComposeMergeEngineOptions = {
  client: FalComposeClientPort;
  modelId?: string;
  capabilities?: MergeEngineCapabilities;
  /** Asset id factory — injected for determinism in tests. */
  nextAssetId?: (context: MergeExecutionContext) => string;
};

export function createFalComposeMergeEngine(
  options: CreateFalComposeMergeEngineOptions
): MergeEngine {
  if (!options.client) {
    throw new Error("FalComposeClientPort requis pour createFalComposeMergeEngine.");
  }
  const modelId = options.modelId ?? MERGE_MODEL_ID;
  const capabilities = options.capabilities ?? FAL_COMPOSE_MERGE_CAPABILITIES;
  const nextAssetId =
    options.nextAssetId ??
    ((ctx) => `compose:${ctx.correlationId}:${ctx.requestedAt}`);

  const engine: MergeEngine = {
    capabilities,

    async validate(plan, context): Promise<MergeValidationResult> {
      const base = validateMergePlanAgainstCapabilities(plan, capabilities);
      try {
        mapMergePlanToFalComposeInput(plan, context.requestedAt);
      } catch (e) {
        if (isPostProductionDomainError(e)) {
          base.issues.push({
            code: e.code,
            message: e.publicMessage,
            blocking: true,
          });
          return { ...base, valid: false };
        }
        throw e;
      }
      return {
        ...base,
        valid: base.issues.filter((i) => i.blocking).length === 0,
      };
    },

    async execute(plan: MergePlan, context: MergeExecutionContext): Promise<MergeResult> {
      if (!capabilities.executionEnabled) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "merge_adapter_not_configured",
            retryable: false,
            publicMessage: "MergeEngine fal compose non activé.",
          },
        };
      }

      const validation = await engine.validate(plan, context);
      if (!validation.valid) {
        const issue = validation.issues.find((i) => i.blocking);
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "invalid_plan",
            retryable: false,
            publicMessage: issue?.message ?? "Plan de merge invalide.",
          },
        };
      }

      let composeInput;
      try {
        composeInput = mapMergePlanToFalComposeInput(plan, context.requestedAt);
      } catch (e) {
        if (isPostProductionDomainError(e)) {
          return {
            status: "failed",
            failedAt: context.requestedAt,
            error: {
              code: e.code,
              retryable: false,
              publicMessage: e.publicMessage,
            },
          };
        }
        throw e;
      }

      const payload = buildFalComposePayload(composeInput);

      try {
        const submission = await options.client.submit(modelId, payload, {
          correlationId: context.correlationId,
          requestedAt: context.requestedAt,
          signal: context.signal,
        });
        return {
          status: "submitted",
          job: {
            providerId: "fal",
            modelId: submission.modelId || modelId,
            externalJobId: submission.requestId,
          },
          pollAfterMs: 3000,
        };
      } catch (e) {
        const mapped = mapFalComposeClientError(e);
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: mapped.code,
            retryable: mapped.retryable,
            publicMessage: mapped.publicMessage,
          },
        };
      }
    },
    // cancel intentionally omitted — not supported
  };

  if (options.client.poll) {
    const pollFn = options.client.poll.bind(options.client);
    engine.poll = async (job, context): Promise<MergeResult> => {
      if (job.providerId !== "fal" || job.modelId !== modelId) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "invalid_plan",
            retryable: false,
            publicMessage: "Référence de job merge invalide.",
          },
        };
      }
      if (!job.externalJobId?.trim()) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "invalid_plan",
            retryable: false,
            publicMessage: "Identifiant de job manquant.",
          },
        };
      }

      try {
        const polled = await pollFn(modelId, job.externalJobId, {
          correlationId: context.correlationId,
          requestedAt: context.requestedAt,
          signal: context.signal,
        });
        if (polled.status === "IN_QUEUE" || polled.status === "IN_PROGRESS") {
          return {
            status: "processing",
            job,
            pollAfterMs: 3000,
          };
        }
        if (polled.status === "FAILED") {
          return {
            status: "failed",
            failedAt: context.requestedAt,
            error: {
              code: "merge_failed",
              retryable: false,
              publicMessage: "Échec du job compose.",
            },
          };
        }
        if (polled.status !== "COMPLETED") {
          return {
            status: "processing",
            job,
            pollAfterMs: 3000,
          };
        }
        const asset = buildComposeVideoAsset({
          assetId: nextAssetId(context),
          videoUrl: polled.videoUrl,
          expiresAt: expiresAtFrom(context.requestedAt),
        });
        if ("error" in asset) {
          return {
            status: "failed",
            failedAt: context.requestedAt,
            error: {
              code: "output_invalid",
              retryable: false,
              publicMessage: "Sortie merge invalide.",
            },
          };
        }
        return {
          status: "completed",
          asset,
          completedAt: context.requestedAt,
        };
      } catch (e) {
        const mapped = mapFalComposeClientError(e);
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: mapped.code,
            retryable: mapped.retryable,
            publicMessage: mapped.publicMessage,
          },
        };
      }
    };
  }

  return engine;
}

/** Wire historical fal helpers into FalComposeClientPort (runtime only — not used in unit tests). */
export function createFalComposeClientFromLib(deps: {
  submitJob: (model: string, input: Record<string, unknown>) => Promise<string>;
  checkJob: (
    model: string,
    requestId: string
  ) => Promise<{ status: string; videoUrl?: string; error?: string }>;
}): FalComposeClientPort {
  return {
    async submit(modelId, payload, _context) {
      void _context;
      const requestId = await deps.submitJob(modelId, { tracks: payload.tracks });
      return { requestId, modelId };
    },
    async poll(modelId, requestId, _context) {
      void _context;
      const status = await deps.checkJob(modelId, requestId);
      if (status.status === "COMPLETED") {
        if (!status.videoUrl) {
          return { status: "FAILED", requestId, error: "missing video url" };
        }
        return { status: "COMPLETED", requestId, videoUrl: status.videoUrl };
      }
      if (status.status === "FAILED") {
        return { status: "FAILED", requestId, error: status.error };
      }
      if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
        return { status: status.status, requestId };
      }
      return { status: "IN_PROGRESS", requestId };
    },
  };
}
