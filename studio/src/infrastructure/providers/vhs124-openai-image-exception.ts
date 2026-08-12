/**
 * VHS-124 bounded exception — OpenAI image on Production Director path.
 * Default OFF. Does not declare global real-provider Registry compatibility.
 */

import type { MediaAction } from "@/domain/cost";
import {
  GenerationDomainError,
  type CanonicalGenerationInput,
  type GenerationCommand,
  type GenerationExecutionContext,
  type GenerationResult,
  type ExternalJobRef,
  type ProviderAdapter,
  type ProviderExecutionContext,
  type ProviderSubmissionResult,
  type ProviderEstimateResult,
} from "@/domain/generation";
import type { GenerationEngine } from "@/application/generation";
import { fromLegacyUsdEstimate } from "@/domain/cost";
import { estimateImage, type ImageQuality, type ImageSize } from "@/lib/pricing";
import {
  assertVhs124OpenAIImageAllowlistScope,
  assertVhs124OpenAIImageExceptionActive,
  isVhs124OpenAIImageExceptionEnabled,
  isVhs124OpenAIImageExceptionExpired,
  PHASE_11A_ALLOWLIST_SCOPE,
  PHASE_11A_SMOKE_MODEL,
  PHASE_11A_SMOKE_PROVIDER,
  PHASE_11A_SMOKE_QUALITY,
  PHASE_11A_SMOKE_SIZE,
  vhs124OpenAIImageExceptionAuditView,
} from "@/application/production/phase-11a-openai-image-allowlist";
import type { OpenAIImageClientPort } from "./contracts";
import { createOpenAIImageAdapter } from "./openai-image-adapter";
import { createUniversalFakeAdapter } from "./fake-universal-adapter";

export type CreateCallTimeOpenAIImageClientOptions = {
  /** Env map — key read only at call-time. */
  env: Record<string, string | undefined>;
  /** Injectable fetch for tests — default global fetch (never called in wire phase). */
  fetchImpl?: typeof fetch;
};

/**
 * OpenAI image client that reads OPENAI_API_KEY only when generateImage is invoked.
 * No key in returned object fields.
 */
export function createCallTimeOpenAIImageClient(
  options: CreateCallTimeOpenAIImageClientOptions,
): OpenAIImageClientPort {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async generateImage(opts) {
      const apiKey = options.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new GenerationDomainError(
          "provider_unavailable",
          "OpenAI image key unavailable at call-time.",
          { providerId: "openai", modelId: PHASE_11A_SMOKE_MODEL, retryable: false },
        );
      }
      const res = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: PHASE_11A_SMOKE_MODEL,
          prompt: opts.prompt,
          size: opts.size,
          quality: opts.quality,
          n: 1,
        }),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 200);
        throw new GenerationDomainError(
          res.status === 429 ? "rate_limited" : "provider_unavailable",
          `OpenAI image error (${res.status}).`,
          {
            providerId: "openai",
            modelId: PHASE_11A_SMOKE_MODEL,
            retryable: res.status === 429 || res.status >= 500,
            diagnostic: detail.replace(/sk-[a-zA-Z0-9]+/g, "[redacted]"),
          },
        );
      }
      const json = (await res.json()) as {
        data?: { b64_json?: string; url?: string }[];
      };
      const item = json.data?.[0];
      if (item?.b64_json) {
        return {
          dataUrl: `data:image/png;base64,${item.b64_json}`,
          size: opts.size,
          quality: opts.quality,
        };
      }
      if (item?.url) {
        // Temporary URL — memory only at adapter boundary; not persisted by this client.
        return { dataUrl: item.url, size: opts.size, quality: opts.quality };
      }
      throw new GenerationDomainError(
        "output_invalid",
        "OpenAI image empty response.",
        { providerId: "openai", modelId: PHASE_11A_SMOKE_MODEL, retryable: false },
      );
    },
  };
}

export function createVhs124AllowlistedOpenAIImageAdapter(input: {
  client: OpenAIImageClientPort;
  quality?: ImageQuality;
  size?: ImageSize;
  /** When true, supports() is false unless exception env active (checked externally). */
  requireExceptionGate?: (env: Record<string, string | undefined>) => boolean;
  env?: Record<string, string | undefined>;
}): ProviderAdapter {
  const quality = input.quality ?? PHASE_11A_SMOKE_QUALITY;
  const size = input.size ?? PHASE_11A_SMOKE_SIZE;
  const inner = createOpenAIImageAdapter(input.client, { quality, forceSize: size });
  const env = input.env ?? {};

  return {
    providerId: PHASE_11A_SMOKE_PROVIDER,
    supports(modelId: string, action: MediaAction): boolean {
      if (input.requireExceptionGate && !input.requireExceptionGate(env)) {
        return false;
      }
      if (isVhs124OpenAIImageExceptionExpired()) {
        return false;
      }
      return (
        modelId === PHASE_11A_SMOKE_MODEL &&
        (action === "image" || action === "scene_image") &&
        inner.supports(modelId, action)
      );
    },
    async estimate(
      canonical: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderEstimateResult> {
      void context;
      if (canonical.kind !== "image") {
        throw new GenerationDomainError(
          "model_not_supported",
          "Allowlist estimate expects image input.",
        );
      }
      if (canonical.modelId !== PHASE_11A_SMOKE_MODEL) {
        throw new GenerationDomainError(
          "model_not_supported",
          "Allowlist model mismatch.",
        );
      }
      const usd = estimateImage(size, quality, 1);
      return {
        estimate: fromLegacyUsdEstimate({
          id: `est-allowlist-${context.idempotencyKey}`.slice(0, 64),
          projectId: PHASE_11A_ALLOWLIST_SCOPE.projectId,
          createdBy: "vhs124-allowlist",
          correlationId: context.correlationId,
          sceneId: PHASE_11A_ALLOWLIST_SCOPE.sceneId,
          action: "image",
          modelId: PHASE_11A_SMOKE_MODEL,
          providerId: PHASE_11A_SMOKE_PROVIDER,
          quantity: 1,
          usd,
          confidence: "high",
        }),
      };
    },
    async submit(
      canonical: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderSubmissionResult> {
      if (input.requireExceptionGate) {
        assertVhs124OpenAIImageExceptionActive({ env });
      }
      if (canonical.kind !== "image") {
        throw new GenerationDomainError(
          "model_not_supported",
          "Allowlist submit expects image.",
        );
      }
      if (
        canonical.modelId !== PHASE_11A_SMOKE_MODEL ||
        canonical.providerId !== PHASE_11A_SMOKE_PROVIDER ||
        canonical.capabilityProfile !== PHASE_11A_ALLOWLIST_SCOPE.capability
      ) {
        throw new GenerationDomainError(
          "model_not_supported",
          "Allowlist capability/provider/model mismatch.",
        );
      }
      // Single network attempt — no retry inside adapter.
      return inner.submit(canonical, context);
    },
  };
}

/**
 * Resolve Director provider adapters:
 * - default / exception OFF → fakes only (VHS-124)
 * - exception ON → fal/elevenlabs fakes + allowlisted OpenAI image (not wildcard real)
 */
export function resolveDirectorProviderAdapters(input: {
  env: Record<string, string | undefined>;
  openaiImageClient?: OpenAIImageClientPort;
  nowIso?: string;
}): {
  adapters: ProviderAdapter[];
  mode: "fakes_only" | "vhs124_openai_image_allowlist";
  audit: ReturnType<typeof vhs124OpenAIImageExceptionAuditView>;
} {
  const audit = vhs124OpenAIImageExceptionAuditView(input.env, input.nowIso);
  const enabled = isVhs124OpenAIImageExceptionEnabled(input.env);
  const expired = isVhs124OpenAIImageExceptionExpired(input.nowIso);

  if (!enabled || expired) {
    return {
      adapters: [
        createUniversalFakeAdapter("fal"),
        createUniversalFakeAdapter("openai"),
        createUniversalFakeAdapter("elevenlabs"),
      ],
      mode: "fakes_only",
      audit,
    };
  }

  const client =
    input.openaiImageClient ?? createCallTimeOpenAIImageClient({ env: input.env });

  const allowlisted = createVhs124AllowlistedOpenAIImageAdapter({
    client,
    quality: PHASE_11A_SMOKE_QUALITY,
    size: PHASE_11A_SMOKE_SIZE,
    requireExceptionGate: isVhs124OpenAIImageExceptionEnabled,
    env: input.env,
  });

  return {
    adapters: [
      createUniversalFakeAdapter("fal"),
      allowlisted,
      createUniversalFakeAdapter("elevenlabs"),
    ],
    mode: "vhs124_openai_image_allowlist",
    audit,
  };
}

/** Engine wrapper — enforces project/scene/step allowlist before provider submit. */
export function createVhs124ScopedGenerationEngine(
  base: GenerationEngine,
): GenerationEngine {
  return {
    async execute(
      command: GenerationCommand,
      context: GenerationExecutionContext,
    ): Promise<GenerationResult> {
      assertVhs124OpenAIImageAllowlistScope({
        projectId: command.projectId,
        sceneId: command.sceneId,
        action: command.step.action,
        capabilityProfile: command.step.capabilityProfile,
        providerId: command.step.providerId,
        modelId: command.step.modelId,
        stepCount: 1,
        jobCount: 1,
        outputCount: 1,
        fallbackRequested: (command.step.fallbacks?.length ?? 0) > 0,
        retryRequested: command.attempt > 1,
        downstreamRequested: false,
        estimateMinor: command.step.estimate.total.amountMinor,
        motionFlagsOrAssetsReferenced:
          command.step.action === "motion_transfer" ||
          command.step.capabilityProfile.includes("motion"),
        legacyEndpoint: false,
        fakeAdapterOnRealPath: false,
      });
      return base.execute(command, context);
    },
    poll(
      job: ExternalJobRef,
      context: GenerationExecutionContext,
      meta: { modelId: string; providerId: string; action: string },
    ) {
      return base.poll(job, context, meta);
    },
    cancel(
      job: ExternalJobRef,
      context: GenerationExecutionContext,
      meta: { modelId: string; providerId: string },
    ) {
      return base.cancel(job, context, meta);
    },
  };
}
