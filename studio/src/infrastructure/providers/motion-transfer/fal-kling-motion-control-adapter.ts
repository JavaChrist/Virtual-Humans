/**
 * Fal Kling v3 Pro motion-control adapter (MT-007B).
 * Implements MotionTransferProviderPort. Disabled by default via resolver/flags.
 * Tests inject FakeFalMotionControlTransport — zero network / zero FAL_KEY.
 */

import {
  MotionTransferDomainError,
  assertEstimateUsableForPaidReservation,
  assertProviderOutputDescriptorSafe,
  createProviderErrorEvidence,
  deepFreeze,
  MOTION_TRANSFER_PROVIDER_PORT_VERSION,
  type MotionTransferCancelResult,
  type MotionTransferEstimate,
  type MotionTransferJobStatus,
  type MotionTransferProviderCallCounters,
  type MotionTransferProviderContext,
  type MotionTransferProviderErrorEvidence,
  type MotionTransferProviderPort,
  type MotionTransferProviderSubmitInput,
  type MotionTransferStatus,
  type MotionTransferSubmission,
} from "@/domain/motion";
import {
  assertNotI2vFalsePositive,
  FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
  mapFalQueueStatusToMotionJobStatus,
  type FalKlingCharacterOrientation,
} from "./fal-kling-motion-control-mapping";
import type { FalMotionControlTransport } from "./fal-motion-control-transport";
import {
  evaluateMotionTransferPrivacyGate,
  type MotionTransferPrivacyDecisions,
} from "./privacy-gate";

export const FAL_MOTION_TRANSFER_PROVIDER_ID = "fal" as const;
export const FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID =
  FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT;
export const FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION = "mt007b-1.0.0" as const;
export const FAL_KLING_MOTION_CONTROL_PRICING_VERSION =
  "fal-llms.txt-2026-08-11" as const;
export const FAL_KLING_MOTION_CONTROL_CONTRACT_VERSION =
  MOTION_TRANSFER_PROVIDER_PORT_VERSION;

/**
 * Official price $0.168/s expressed as deci-cents per second (16.8¢ = 168 deci-cents).
 * costMinorUSD = ceil(durationSeconds * 168 / 10) — integer-only, conservative ceil.
 */
export const FAL_KLING_V3_PRO_DECI_CENTS_PER_SECOND = 168 as const;

/** Official OpenAPI x-fal video min_duration. */
export const FAL_KLING_V3_PRO_MIN_DURATION_SECONDS = 3 as const;
export const FAL_KLING_V3_PRO_MAX_DURATION_IMAGE_SECONDS = 10 as const;
export const FAL_KLING_V3_PRO_MAX_DURATION_VIDEO_SECONDS = 30 as const;

export type FalKlingMotionControlAdapterOptions = {
  transport: FalMotionControlTransport;
  /**
   * Process-local submit replay for same idempotencyKey within this port instance.
   * NOT a Production exactly-once guarantee — job DB / orchestration owns that (MT-008).
   * Enabled so contract-suite duplicate-submit behavior is observable in tests.
   */
  enableProcessLocalSubmitReplay?: boolean;
  /** Privacy decisions — default blocked; real resolver requires accepted. */
  privacyDecisions?: Partial<MotionTransferPrivacyDecisions>;
  /** When true, enforce privacy gate on submit (Production path). */
  enforcePrivacyGateOnSubmit?: boolean;
  nowIso?: () => string;
};

function maxDurationForOrientation(
  orientation: FalKlingCharacterOrientation,
): number {
  return orientation === "video"
    ? FAL_KLING_V3_PRO_MAX_DURATION_VIDEO_SECONDS
    : FAL_KLING_V3_PRO_MAX_DURATION_IMAGE_SECONDS;
}

export function resolveFalKlingCharacterOrientation(motion: {
  preserveCamera?: boolean;
}): FalKlingCharacterOrientation {
  // Official: 'video' better for complex motions; 'image' for camera-follow from image.
  return motion.preserveCamera === true ? "video" : "image";
}

/**
 * Deterministic cost in USD minor (cents), conservative ceil.
 * $0.168/s → ceil(duration * 168 / 10).
 */
export function computeFalKlingV3ProCostMinor(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Durée facturable invalide.",
    );
  }
  return Math.ceil(
    (durationSeconds * FAL_KLING_V3_PRO_DECI_CENTS_PER_SECOND) / 10,
  );
}

/** Pure pricing formula (unit tests) — does not apply duration gates. */
export function computeFalKlingV3ProCostMinorUnchecked(
  durationSeconds: number,
): number {
  return Math.ceil(
    (durationSeconds * FAL_KLING_V3_PRO_DECI_CENTS_PER_SECOND) / 10,
  );
}

export function assertFalKlingDurationAllowed(
  durationSeconds: number,
  orientation: FalKlingCharacterOrientation,
): void {
  const max = maxDurationForOrientation(orientation);
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < FAL_KLING_V3_PRO_MIN_DURATION_SECONDS ||
    durationSeconds > max
  ) {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Durée hors bornes officielles fal Kling motion-control.",
      {
        diagnostic: `duration=${durationSeconds};orientation=${orientation};min=${FAL_KLING_V3_PRO_MIN_DURATION_SECONDS};max=${max}`,
      },
    );
  }
}

function isForbiddenMediaRef(ref: string): boolean {
  const t = ref.trim();
  if (!t) return true;
  if (/^data:/i.test(t)) return true;
  return false;
}

function assertBoundaryRef(ref: string, field: string): string {
  if (isForbiddenMediaRef(ref)) {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Référence média boundary invalide.",
      { field },
    );
  }
  return ref.trim();
}

function opaqueOutputRef(providerJobId: string): string {
  return `fal-out:${providerJobId}`;
}

function checkAbort(context: MotionTransferProviderContext): void {
  if (context.signal?.aborted) {
    throw new MotionTransferDomainError("cancelled", "Opération annulée.");
  }
}

function checkDeadline(
  context: MotionTransferProviderContext,
  now: string,
): void {
  if (context.deadlineAt && Date.parse(context.deadlineAt) <= Date.parse(now)) {
    throw new MotionTransferDomainError(
      "provider_timeout",
      "Deadline globale dépassée.",
      { diagnostic: "deadline_exceeded" },
    );
  }
}

type FalTransportErrorShape = {
  stage?: string;
  httpStatus?: number;
  message?: string;
  providerErrorCode?: string;
  providerErrorType?: string;
};

function extractFalTransportError(err: unknown): FalTransportErrorShape | null {
  if (!err || typeof err !== "object") return null;
  const shaped = (err as { falTransportError?: FalTransportErrorShape })
    .falTransportError;
  if (shaped) return shaped;
  const anyErr = err as {
    status?: number;
    statusCode?: number;
    body?: { detail?: unknown; message?: string };
    message?: string;
  };
  return {
    httpStatus: anyErr.status ?? anyErr.statusCode,
    message: anyErr.message,
  };
}

export function mapFalTransportErrorToEvidence(
  err: unknown,
  stage: MotionTransferProviderErrorEvidence["stage"],
  networkAttempts: number,
): Readonly<MotionTransferProviderErrorEvidence> {
  const raw = extractFalTransportError(err);
  const http = raw?.httpStatus;
  const msg = (raw?.message ?? "Erreur provider fal.").slice(0, 200);
  let code: MotionTransferProviderErrorEvidence["code"] = "provider_failed";
  if (http === 401 || http === 403) code = "provider_auth_failed";
  else if (http === 400 || http === 422) code = "provider_invalid_request";
  else if (http === 429) code = "provider_rate_limited";
  else if (http === 402) code = "provider_quota_exceeded";
  else if (http === 404) code = "provider_job_not_found";
  else if (http === 408 || http === 504) code = "provider_timeout";
  else if (http != null && http >= 500) code = "provider_unavailable";
  else if (/rate.?limit/i.test(msg)) code = "provider_rate_limited";
  else if (/quota|balance|locked/i.test(msg)) code = "provider_quota_exceeded";
  else if (/not found/i.test(msg)) code = "provider_job_not_found";
  else if (/timeout/i.test(msg)) code = "provider_timeout";
  else if (/content.?policy|safety|moderat/i.test(msg)) code = "provider_rejected";

  return createProviderErrorEvidence({
    code,
    publicMessage: msg.replace(/https?:\/\/\S+/gi, "[redacted_url]"),
    httpStatus: http,
    providerErrorCode: raw?.providerErrorCode,
    providerErrorType: raw?.providerErrorType,
    stage,
    networkAttempts,
    usagePresent: false,
  });
}

function throwMapped(
  err: unknown,
  stage: MotionTransferProviderErrorEvidence["stage"],
  networkAttempts: number,
): never {
  if (err instanceof MotionTransferDomainError) throw err;
  const ev = mapFalTransportErrorToEvidence(err, stage, networkAttempts);
  throw new MotionTransferDomainError(ev.code, ev.publicMessage, {
    diagnostic: JSON.stringify(ev),
  });
}

export function buildFalKlingV3ProSubmitInput(args: {
  mediaBoundary: MotionTransferProviderSubmitInput["mediaBoundary"];
  motion: MotionTransferProviderSubmitInput["motion"];
  prompt?: string;
}): {
  orientation: FalKlingCharacterOrientation;
  falInput: Record<string, unknown>;
  omittedFields: readonly string[];
} {
  assertNotI2vFalsePositive(FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT);

  if (args.motion.character.outfitLock === "required") {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "outfitLock=required non supporté — pas de champ outfit dédié sur fal Kling motion-control.",
      { field: "character.outfitLock" },
    );
  }

  const identityCount = args.mediaBoundary.identityRefs.length;
  if (identityCount < 1) {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Référence personnage principale requise (image_url).",
      { field: "mediaBoundary.identityRefs" },
    );
  }

  const orientation = resolveFalKlingCharacterOrientation(args.motion.motion);
  const video_url = assertBoundaryRef(
    args.mediaBoundary.sourceVideoRef,
    "mediaBoundary.sourceVideoRef",
  );
  const image_url = assertBoundaryRef(
    args.mediaBoundary.identityRefs[0]!,
    "mediaBoundary.identityRefs[0]",
  );

  const falInput: Record<string, unknown> = {
    image_url,
    video_url,
    character_orientation: orientation,
    keep_original_sound: false,
  };

  if (args.prompt?.trim()) {
    falInput.prompt = args.prompt.trim().slice(0, 2500);
  }

  const omittedFields: string[] = [];
  if (args.mediaBoundary.outfitRef) {
    omittedFields.push("outfitRef");
  }
  // aspect ratio / resolution / fps — not accepted by this endpoint schema
  omittedFields.push("output.aspectRatio", "output.resolution", "output.fps");

  if (identityCount > 1) {
    if (orientation !== "video") {
      throw new MotionTransferDomainError(
        "provider_invalid_request",
        "Élément facial (elements) uniquement si character_orientation=video.",
        { field: "mediaBoundary.identityRefs" },
      );
    }
    if (identityCount > 2) {
      throw new MotionTransferDomainError(
        "provider_invalid_request",
        "Exactement une identité principale (+ au plus un élément facial).",
        { field: "mediaBoundary.identityRefs" },
      );
    }
    const face = assertBoundaryRef(
      args.mediaBoundary.identityRefs[1]!,
      "mediaBoundary.identityRefs[1]",
    );
    falInput.elements = [{ frontal_image_url: face }];
  }

  return { orientation, falInput, omittedFields };
}

type ReplayRecord = {
  providerJobId: string;
  submittedAt: string;
};

/**
 * Create fal Kling v3 Pro Motion Transfer adapter (code-complete, runtime-gated).
 */
export function createFalKlingMotionControlAdapter(
  options: FalKlingMotionControlAdapterOptions,
): MotionTransferProviderPort & {
  readonly counters: MotionTransferProviderCallCounters;
  readonly transport: FalMotionControlTransport;
  readonly adapterVersion: typeof FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION;
  readonly pricingVersion: typeof FAL_KLING_MOTION_CONTROL_PRICING_VERSION;
} {
  const transport = options.transport;
  const nowIso = options.nowIso ?? (() => new Date().toISOString());
  const enableReplay = options.enableProcessLocalSubmitReplay !== false;
  const enforcePrivacy = options.enforcePrivacyGateOnSubmit === true;
  const privacyDecisions = options.privacyDecisions ?? {};

  const counters: MotionTransferProviderCallCounters = {
    estimate: 0,
    submit: 0,
    poll: 0,
    cancel: 0,
    network: 0,
  };

  const replay = new Map<string, ReplayRecord>();

  const port: MotionTransferProviderPort & {
    readonly counters: MotionTransferProviderCallCounters;
    readonly transport: FalMotionControlTransport;
    readonly adapterVersion: typeof FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION;
    readonly pricingVersion: typeof FAL_KLING_MOTION_CONTROL_PRICING_VERSION;
  } = {
    providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
    supportedModelIds: [FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID],
    portVersion: MOTION_TRANSFER_PROVIDER_PORT_VERSION,
    counters,
    transport,
    adapterVersion: FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
    pricingVersion: FAL_KLING_MOTION_CONTROL_PRICING_VERSION,

    async estimate(input, context) {
      counters.estimate += 1;
      checkAbort(context);
      checkDeadline(context, nowIso());

      if (
        context.modelId !== FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID &&
        context.modelId !== FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT
      ) {
        // allow empty model in estimate context — use supported model
      }

      const orientation = resolveFalKlingCharacterOrientation(input.motion.motion);
      assertFalKlingDurationAllowed(input.billableDurationSeconds, orientation);

      const costMinor = computeFalKlingV3ProCostMinor(input.billableDurationSeconds);
      const estimate: MotionTransferEstimate = {
        schemaVersion: "1.0.0",
        currency: input.currency || "USD",
        estimatedCostMinor: costMinor,
        durationSeconds: input.billableDurationSeconds,
        pricingUnit: "second",
        mode: "firm",
        pricingStrategy: "per_second",
        pricingVersion: FAL_KLING_MOTION_CONTROL_PRICING_VERSION,
        assumptions: [
          "official_llms_txt_usd_per_second",
          `orientation=${orientation}`,
          `max_duration=${maxDurationForOrientation(orientation)}`,
          "billable_duration=source_or_declared",
        ],
        providerId: FAL_MOTION_TRANSFER_PROVIDER_ID,
        modelId: FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
        capability: "video.motion_transfer",
        capabilityVersion: "1.0.0",
        notes: [
          "documentary_price_confirmed_at_adapter_level",
          "no_budget_reservation",
        ],
      };
      return deepFreeze(estimate);
    },

    async submit(input, context) {
      counters.submit += 1;
      checkAbort(context);
      const now = nowIso();
      checkDeadline(context, now);

      if (input.providerId !== FAL_MOTION_TRANSFER_PROVIDER_ID) {
        throw new MotionTransferDomainError(
          "model_not_supported",
          "Provider Motion Transfer non supporté par cet adapter.",
        );
      }
      if (input.modelId !== FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID) {
        throw new MotionTransferDomainError(
          "model_not_supported",
          "Aucun fallback automatique vers v3 standard / v2.6 / I2V.",
          { diagnostic: `model=${input.modelId}` },
        );
      }

      assertEstimateUsableForPaidReservation(input.estimate);

      if (enforcePrivacy) {
        const gate = evaluateMotionTransferPrivacyGate(privacyDecisions);
        if (gate.status !== "accepted") {
          throw new MotionTransferDomainError(
            "provider_not_configured",
            "Privacy gate Motion Transfer bloqué — upload/submit réel interdit.",
            { diagnostic: `privacy_missing:${gate.missing.join(",")}` },
          );
        }
      }

      if (enableReplay) {
        const existing = replay.get(context.idempotencyKey);
        if (existing) {
          const submission: MotionTransferSubmission = {
            schemaVersion: "1.0.0",
            status: "submitted",
            providerJobId: existing.providerJobId,
            submittedAt: existing.submittedAt,
            acceptedAt: existing.submittedAt,
            syncOrAsync: "async",
            pollingRequired: true,
            requestMetadataRedacted: {
              idempotentReplay: true,
              replayScope: "process_local_not_production_guarantee",
              attempt: context.attempt,
              endpoint: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
              nativeFalIdempotency: false,
            },
          };
          return deepFreeze(submission);
        }
      }

      const built = buildFalKlingV3ProSubmitInput({
        mediaBoundary: input.mediaBoundary,
        motion: input.motion,
        prompt: input.motion.prompt,
      });

      const duration =
        input.motion.output.durationSeconds ??
        input.estimate.durationSeconds ??
        input.motion.sourceVideo.durationSeconds;
      if (duration != null) {
        assertFalKlingDurationAllowed(duration, built.orientation);
      }

      let response;
      try {
        counters.network += 1;
        response = await transport.submit({
          endpointId: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
          input: built.falInput,
        });
      } catch (err) {
        throwMapped(err, "submit", counters.network);
      }

      if (!response.requestId?.trim()) {
        throw new MotionTransferDomainError(
          "provider_failed",
          "providerJobId fal vide.",
        );
      }

      if (enableReplay) {
        replay.set(context.idempotencyKey, {
          providerJobId: response.requestId,
          submittedAt: now,
        });
      }

      const submission: MotionTransferSubmission = {
        schemaVersion: "1.0.0",
        status: "submitted",
        providerJobId: response.requestId,
        submittedAt: now,
        acceptedAt: now,
        syncOrAsync: "async",
        pollingRequired: true,
        requestMetadataRedacted: {
          attempt: context.attempt,
          correlationId: context.correlationId,
          endpoint: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
          characterOrientation: built.orientation,
          keepOriginalSound: false,
          elementsPresent: Array.isArray(built.falInput.elements),
          promptPresent: typeof built.falInput.prompt === "string",
          omittedFields: built.omittedFields,
          mediaRefCount:
            1 +
            input.mediaBoundary.identityRefs.length +
            (input.mediaBoundary.outfitRef ? 1 : 0),
          nativeFalIdempotency: false,
          exactlyOnceBoundary: "vhs_job_db_orchestration",
          adapterVersion: FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
        },
      };
      return deepFreeze(submission);
    },

    async poll(input, context) {
      counters.poll += 1;
      checkAbort(context);
      const now = nowIso();
      checkDeadline(context, now);

      if (!input.providerJobId?.trim()) {
        throw new MotionTransferDomainError(
          "provider_invalid_request",
          "providerJobId requis pour poll.",
        );
      }

      let raw;
      try {
        counters.network += 1;
        raw = await transport.getStatus({
          endpointId: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
          requestId: input.providerJobId,
        });
      } catch (err) {
        throwMapped(err, "poll", counters.network);
      }

      let mapped: MotionTransferJobStatus;
      try {
        mapped = mapFalQueueStatusToMotionJobStatus(raw.status);
      } catch (err) {
        if (err instanceof MotionTransferDomainError) throw err;
        throw new MotionTransferDomainError(
          "provider_status_unknown",
          "Statut fal queue inconnu.",
          { diagnostic: `fal_status:${String(raw.status).slice(0, 40)}` },
        );
      }

      if (mapped === "failed") {
        const status: MotionTransferStatus = {
          schemaVersion: "1.0.0",
          status: "failed",
          providerJobId: input.providerJobId,
          errorCode: "provider_failed",
          updatedAt: now,
        };
        return deepFreeze(status);
      }

      if (mapped !== "completed") {
        const status: MotionTransferStatus = {
          schemaVersion: "1.0.0",
          status: mapped,
          providerJobId: input.providerJobId,
          updatedAt: now,
        };
        return deepFreeze(status);
      }

      // Terminal success — fetch result by providerJobId (never resubmit).
      // Prefer embedded result from fake getStatus; otherwise dedicated getResult.
      let terminal = raw;
      if (!terminal.result?.videoUrl) {
        try {
          counters.network += 1;
          terminal = await transport.getResult({
            endpointId: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
            requestId: input.providerJobId,
          });
        } catch (err) {
          throwMapped(err, "poll", counters.network);
        }
      }

      if (terminal.status !== "COMPLETED") {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Résultat fal non terminal COMPLETED.",
        );
      }

      const videoUrl = terminal.result?.videoUrl;
      if (!videoUrl || /^data:/i.test(videoUrl)) {
        throw new MotionTransferDomainError(
          "provider_output_invalid",
          "Résultat fal mal formé — vidéo absente.",
        );
      }
      // Memory-only — never persist / never put in opaque descriptor.
      void videoUrl;

      const output = {
        providerOutputRef: opaqueOutputRef(input.providerJobId),
        mimeType: terminal.result?.contentType ?? "video/mp4",
        sizeBytes: terminal.result?.fileSize,
        durationSeconds: terminal.result?.durationSeconds,
        width: terminal.result?.width,
        height: terminal.result?.height,
        fps: terminal.result?.fps,
        completedAt: now,
      };
      assertProviderOutputDescriptorSafe(output);

      const billable = terminal.result?.durationSeconds ?? undefined;
      const actualCostMinor =
        billable != null && billable > 0
          ? computeFalKlingV3ProCostMinor(billable)
          : undefined;

      const status: MotionTransferStatus = {
        schemaVersion: "1.0.0",
        status: "completed",
        providerJobId: input.providerJobId,
        updatedAt: now,
        output,
        usage: billable != null ? { durationSeconds: billable } : undefined,
        actualCostMinor,
        currency: actualCostMinor != null ? "USD" : undefined,
      };
      return deepFreeze(status);
    },

    async cancel(input) {
      counters.cancel += 1;
      const result: MotionTransferCancelResult = {
        schemaVersion: "1.0.0",
        status: "cancel_unsupported",
        providerJobId: input.providerJobId,
        lateResultExpected: true,
      };
      return deepFreeze(result);
    },
  };

  return port;
}
