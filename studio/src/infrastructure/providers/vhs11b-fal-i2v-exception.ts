/**
 * Phase 11B — bounded fal Kling I2V exception wrapper.
 * Default OFF. Never reads a provider key during wiring tests.
 */
import type { MediaAction } from "@/domain/cost";
import {
  GenerationDomainError,
  type CanonicalGenerationInput,
  type ProviderAdapter,
  type ProviderExecutionContext,
  type ProviderPollResult,
  type ProviderSubmissionResult,
  type ExternalJobRef,
} from "@/domain/generation";
import type { GenerationEngine } from "@/application/generation";
import { createGenerationEngine, createProviderAdapterRegistry } from "@/application/generation";
import { createUniversalFakeAdapter } from "./fake-universal-adapter";
import { createFalAdapter } from "./fal-adapter";
import type { FalClientPort } from "./contracts";
import {
  PHASE_11B_ACTION,
  PHASE_11B_CAPABILITY,
  PHASE_11B_MODEL,
  PHASE_11B_PROJECT_ID,
  PHASE_11B_PROVIDER,
  PHASE_11B_SCENE_ID,
  assertVhs11BFalI2vAllowlistScope,
  assertVhs11BFalI2vExceptionActive,
} from "@/application/production/phase-11b-i2v-allowlist";

export function createVhs11BAllowlistedFalI2vAdapter(client: FalClientPort): ProviderAdapter {
  const inner = createFalAdapter(client);
  return {
    providerId: PHASE_11B_PROVIDER,
    supports(modelId: string, action: MediaAction): boolean {
      return action === PHASE_11B_ACTION && modelId === PHASE_11B_MODEL && inner.supports(modelId, action);
    },
    async submit(
      input: CanonicalGenerationInput,
      context: ProviderExecutionContext,
    ): Promise<ProviderSubmissionResult> {
      if (input.kind !== "video" || input.action !== "video") {
        throw new GenerationDomainError("model_not_supported", "11B adapter expects I2V video input.");
      }
      if (input.capabilityProfile !== PHASE_11B_CAPABILITY) {
        throw new GenerationDomainError("model_not_supported", "11B adapter rejects non-I2V capability.");
      }
      assertVhs11BFalI2vAllowlistScope({
        projectId: PHASE_11B_PROJECT_ID,
        sceneId: PHASE_11B_SCENE_ID,
        action: input.action,
        capabilityProfile: input.capabilityProfile,
        providerId: PHASE_11B_PROVIDER,
        modelId: input.modelId,
        durationSeconds: input.durationSeconds,
      });
      return inner.submit(input, context);
    },
    async poll(job: ExternalJobRef, context: ProviderExecutionContext): Promise<ProviderPollResult> {
      if (job.modelId !== PHASE_11B_MODEL) {
        throw new GenerationDomainError("invalid_input", "11B adapter cannot poll a non-allowlisted model.");
      }
      if (!inner.poll) {
        throw new GenerationDomainError("invalid_input", "11B adapter requires a pollable fal transport.");
      }
      return inner.poll(job, context);
    },
  };
}

export function resolveDirectorI2vProviderAdapters(input: {
  env: Record<string, string | undefined>;
  falClient?: FalClientPort;
  nowIso?: string;
}): { adapters: ProviderAdapter[]; realI2v: boolean } {
  try {
    assertVhs11BFalI2vExceptionActive({ env: input.env, nowIso: input.nowIso });
  } catch {
    return {
      adapters: [
        createUniversalFakeAdapter("fal"),
        createUniversalFakeAdapter("openai"),
        createUniversalFakeAdapter("elevenlabs"),
      ],
      realI2v: false,
    };
  }
  if (!input.falClient) {
    throw new Error("Phase 11B: real I2V path requires an injected Fal client; no implicit key read.");
  }
  return {
    adapters: [
      createVhs11BAllowlistedFalI2vAdapter(input.falClient),
      createUniversalFakeAdapter("openai"),
      createUniversalFakeAdapter("elevenlabs"),
    ],
    realI2v: true,
  };
}

export function createVhs11BScopedGenerationEngine(input: {
  env: Record<string, string | undefined>;
  falClient?: FalClientPort;
  nowIso?: string;
}): GenerationEngine {
  const resolved = resolveDirectorI2vProviderAdapters(input);
  return createGenerationEngine({
    registry: createProviderAdapterRegistry(resolved.adapters),
  });
}

export function runPhase11BI2vAdapterContractSuite(adapter: ProviderAdapter): void {
  if (adapter.providerId !== "fal") {
    throw new Error("11B contract: providerId must be fal.");
  }
  if (!adapter.supports(PHASE_11B_MODEL, PHASE_11B_ACTION)) {
    throw new Error("11B contract: must support Kling I2V.");
  }
  if (adapter.supports("fal-ai/kling-video/v2/master/text-to-video", "video")) {
    throw new Error("11B contract: must not support T2V.");
  }
  if (adapter.supports("fal-ai/kling-video/v3/pro/motion-control", "motion_transfer")) {
    throw new Error("11B contract: must not support Motion Transfer.");
  }
}
