/**
 * Fake MergeEngine — deterministic, execution-enabled (VHS-125).
 * Never invents an asset without options.asset; when contentBytes + contentPort
 * are provided, stores recoverable bytes at completion (tests / local director).
 * No real fal/provider calls.
 */

import type { GeneratedAsset } from "@/domain/generation";
import {
  FAL_COMPOSE_DECLARED_CAPABILITIES,
  validateMergePlanAgainstCapabilities,
  type ExternalMergeJobRef,
  type MergeEngineCapabilities,
  type MergeExecutionContext,
  type MergePlan,
  type MergeResult,
  type MergeValidationResult,
} from "@/domain/postproduction";
import type { AssetContentPort } from "./asset-content-port";
import { sha256Hex } from "./asset-content-port";
import type { MergeEngine } from "./ports";

export const FAKE_MERGE_CAPABILITIES: MergeEngineCapabilities = Object.freeze({
  ...FAL_COMPOSE_DECLARED_CAPABILITIES,
  version: "fake-merge.v1",
  executionEnabled: true,
});

export type FakeMergeEngineMode = "sync" | "async" | "error" | "timeout";

export type CreateFakeMergeEngineOptions = {
  /** Default "sync". */
  mode?: FakeMergeEngineMode;
  /** Final asset returned on completion — never fabricated when absent. */
  asset?: GeneratedAsset;
  capabilities?: MergeEngineCapabilities;
  /**
   * Optional: when set with contentPort + workspace/project, stores bytes on complete.
   * Prefer wiring put() from ExecuteMergeForProject when projectId is only known at execute time.
   */
  contentBytes?: Uint8Array;
  contentPort?: AssetContentPort;
  workspaceId?: string;
  projectId?: string;
};

const FAKE_MERGE_PROVIDER_ID = "fake-merge";
const FAKE_MERGE_MODEL_ID = "fake-merge-v1";

/** Build a minimal, non-network internal video asset for deterministic tests/local wiring. */
export function buildFakeInternalVideoAsset(input: {
  id: string;
  storagePath?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  checksum?: string;
}): GeneratedAsset {
  return {
    id: input.id,
    kind: "video",
    mimeType: "video/mp4",
    source: { kind: "internal", storagePath: input.storagePath ?? `fake-merge/${input.id}.mp4` },
    durationSeconds: input.durationSeconds,
    sizeBytes: input.sizeBytes ?? 1024,
    checksum: input.checksum,
  };
}

async function storeContentIfConfigured(
  options: CreateFakeMergeEngineOptions,
  asset: GeneratedAsset,
): Promise<GeneratedAsset> {
  const { contentBytes, contentPort, workspaceId, projectId } = options;
  if (!contentBytes || !contentPort || !workspaceId || !projectId) {
    return asset;
  }
  const storagePath =
    asset.source.kind === "internal" ? asset.source.storagePath : `fake-merge/${asset.id}.mp4`;
  await contentPort.put({
    assetId: asset.id,
    workspaceId,
    projectId,
    mimeType: asset.mimeType,
    bytes: contentBytes,
    storagePath,
  });
  const checksum = sha256Hex(contentBytes);
  return {
    ...asset,
    sizeBytes: contentBytes.byteLength,
    checksum,
    source:
      asset.source.kind === "internal"
        ? asset.source
        : { kind: "internal", storagePath },
  };
}

export function createFakeMergeEngine(options: CreateFakeMergeEngineOptions = {}): MergeEngine {
  const mode = options.mode ?? "sync";
  const capabilities = options.capabilities ?? FAKE_MERGE_CAPABILITIES;
  /** In-memory job store — deterministic per engine instance, never persisted. */
  const jobs = new Map<string, GeneratedAsset | undefined>();

  return {
    capabilities,

    async validate(plan: MergePlan): Promise<MergeValidationResult> {
      return validateMergePlanAgainstCapabilities(plan, capabilities);
    },

    async execute(plan: MergePlan, context: MergeExecutionContext): Promise<MergeResult> {
      if (mode === "error") {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "merge_failed",
            retryable: true,
            publicMessage: "Fake merge engine — échec simulé (mode error).",
          },
        };
      }
      if (mode === "timeout") {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "timeout",
            retryable: true,
            publicMessage: "Fake merge engine — délai simulé dépassé (mode timeout).",
          },
        };
      }

      const validation = validateMergePlanAgainstCapabilities(plan, capabilities);
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

      if (mode === "async") {
        const externalJobId = `${context.correlationId}:${plan.id}`;
        jobs.set(externalJobId, options.asset);
        return {
          status: "submitted",
          job: {
            providerId: FAKE_MERGE_PROVIDER_ID,
            modelId: FAKE_MERGE_MODEL_ID,
            externalJobId,
          },
          pollAfterMs: 10,
        };
      }

      // sync
      if (!options.asset) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "merge_adapter_not_configured",
            retryable: false,
            publicMessage:
              "Fake merge engine sans asset injecté — fournir options.asset pour l'exécution synchrone.",
          },
        };
      }
      const asset = await storeContentIfConfigured(options, options.asset);
      return { status: "completed", asset, completedAt: context.requestedAt };
    },

    async poll(job: ExternalMergeJobRef, context: MergeExecutionContext): Promise<MergeResult> {
      if (job.providerId !== FAKE_MERGE_PROVIDER_ID || job.modelId !== FAKE_MERGE_MODEL_ID) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "invalid_plan",
            retryable: false,
            publicMessage: "Référence de job merge fake invalide.",
          },
        };
      }
      if (!jobs.has(job.externalJobId)) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "invalid_plan",
            retryable: false,
            publicMessage: "Job merge fake introuvable.",
          },
        };
      }
      const pending = jobs.get(job.externalJobId);
      if (!pending) {
        return {
          status: "failed",
          failedAt: context.requestedAt,
          error: {
            code: "merge_adapter_not_configured",
            publicMessage: "Aucun asset injecté — impossible de compléter le merge fake asynchrone.",
            retryable: false,
          },
        };
      }
      jobs.delete(job.externalJobId);
      const asset = await storeContentIfConfigured(options, pending);
      return { status: "completed", asset, completedAt: context.requestedAt };
    },
  };
}
