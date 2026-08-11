/**
 * MT-007A — Static mapping design for fal Kling motion-control → MotionTransferProviderPort.
 * NO network. NO SDK calls. NO credentials. Adapter implementation = MT-007B.
 *
 * Evidence date: 2026-08-11
 * Official sources:
 * - https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control/llms.txt
 * - https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control/api
 */

import { MotionTransferDomainError, deepFreeze } from "@/domain/motion";

export const FAL_KLING_MOTION_CONTROL_SPIKE_VERSION = "mt007a-1.0.0" as const;

/** Recommended primary endpoint (disabled until MT-007B + gates). */
export const FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT =
  "fal-ai/kling-video/v3/pro/motion-control" as const;

export const FAL_KLING_V3_STANDARD_MOTION_CONTROL_ENDPOINT =
  "fal-ai/kling-video/v3/standard/motion-control" as const;

export const FAL_KLING_V26_PRO_MOTION_CONTROL_ENDPOINT =
  "fal-ai/kling-video/v2.6/pro/motion-control" as const;

export const FAL_KLING_V26_STANDARD_MOTION_CONTROL_ENDPOINT =
  "fal-ai/kling-video/v2.6/standard/motion-control" as const;

/** Documented USD per second (official llms.txt pricing, 2026-08-11). */
export const FAL_KLING_MOTION_CONTROL_USD_PER_SECOND = {
  [FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT]: 0.168,
  [FAL_KLING_V3_STANDARD_MOTION_CONTROL_ENDPOINT]: 0.126,
  [FAL_KLING_V26_PRO_MOTION_CONTROL_ENDPOINT]: 0.112,
  [FAL_KLING_V26_STANDARD_MOTION_CONTROL_ENDPOINT]: 0.07,
} as const;

export type FalKlingCharacterOrientation = "image" | "video";

/** Boundary fields for fal submit — URLs injected only by future adapter. */
export type FalKlingMotionControlRequestPlan = {
  endpointId: string;
  method: "POST";
  queueSubmitPath: "fal.queue.submit";
  authBoundary: "server_only_FAL_KEY";
  fields: {
    image_url: "[boundary:identity_or_character_image]";
    video_url: "[boundary:source_motion_video]";
    character_orientation: FalKlingCharacterOrientation;
    prompt?: "[redacted_optional]";
    keep_original_sound?: boolean;
    /** V3 only — facial element binding when orientation=video. */
    elements?: "[boundary:optional_face_element_v3_only]";
  };
  maxDurationSeconds: { image: 10; video: 30 };
};

export type FalQueueStatusRaw =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

/** Map fal queue status → Motion Transfer domain job status. */
export function mapFalQueueStatusToMotionJobStatus(
  raw: string,
): "queued" | "processing" | "completed" | "failed" {
  switch (raw) {
    case "IN_QUEUE":
      return "queued";
    case "IN_PROGRESS":
      return "processing";
    case "COMPLETED":
      return "completed";
    case "FAILED":
      return "failed";
    default:
      throw new MotionTransferDomainError(
        "provider_status_unknown",
        "Statut fal queue inconnu.",
        { diagnostic: `fal_status:${raw}` },
      );
  }
}

export type MotionProviderErrorMapRow = {
  falSignal: string;
  vhsCode: string;
  retryableHuman: boolean;
};

export const FAL_KLING_ERROR_MAP: readonly MotionProviderErrorMapRow[] = [
  { falSignal: "401/403", vhsCode: "provider_auth_failed", retryableHuman: false },
  { falSignal: "400/422 validation", vhsCode: "provider_invalid_request", retryableHuman: false },
  { falSignal: "429", vhsCode: "provider_rate_limited", retryableHuman: true },
  { falSignal: "402 / quota", vhsCode: "provider_quota_exceeded", retryableHuman: false },
  { falSignal: "408/504 timeout", vhsCode: "provider_timeout", retryableHuman: true },
  { falSignal: "5xx", vhsCode: "provider_unavailable", retryableHuman: true },
  { falSignal: "content_policy", vhsCode: "provider_rejected", retryableHuman: false },
  { falSignal: "unknown", vhsCode: "provider_failed", retryableHuman: false },
];

export type ContractSuiteFeasibility =
  | "DIRECT"
  | "ADAPTER_DERIVED"
  | "NOT_SUPPORTED"
  | "DECISION_REQUIRED";

export const FAL_KLING_CONTRACT_SUITE_FEASIBILITY = {
  estimate: "ADAPTER_DERIVED", // per_second from published price × duration
  submit: "DIRECT", // fal.queue.submit + request_id
  poll: "DIRECT", // fal.queue.status / result
  cancel: "NOT_SUPPORTED", // existing VHS fal adapter has no cancel; fal cancel not proven for this endpoint
  idempotence: "ADAPTER_DERIVED", // VHS idempotencyKey → stable client correlation; fal request_id on first accept
  statuses: "DIRECT", // IN_QUEUE / IN_PROGRESS / COMPLETED / FAILED
  usage: "ADAPTER_DERIVED", // duration from input video / result metadata
  cost: "ADAPTER_DERIVED", // published $/s × billable seconds (indicative until dry-run)
  errors: "ADAPTER_DERIVED", // HTTP + fal error mapping table
  redaction: "ADAPTER_DERIVED", // never persist fal CDN signed/public URLs in artifacts
  late_result: "ADAPTER_DERIVED", // quarantine if job already cancelled/failed locally
} as const satisfies Record<string, ContractSuiteFeasibility>;

export function buildFalKlingV3ProRequestPlan(
  orientation: FalKlingCharacterOrientation,
): Readonly<FalKlingMotionControlRequestPlan> {
  return deepFreeze({
    endpointId: FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT,
    method: "POST",
    queueSubmitPath: "fal.queue.submit",
    authBoundary: "server_only_FAL_KEY",
    fields: {
      image_url: "[boundary:identity_or_character_image]",
      video_url: "[boundary:source_motion_video]",
      character_orientation: orientation,
      prompt: "[redacted_optional]",
      keep_original_sound: false,
      elements:
        orientation === "video"
          ? "[boundary:optional_face_element_v3_only]"
          : undefined,
    },
    maxDurationSeconds: { image: 10, video: 30 },
  });
}

/** Indicative MV-001 cost from official $/s — NOT a paid reservation. */
export function estimateFalKlingIndicativeCostMinor(input: {
  endpointId: keyof typeof FAL_KLING_MOTION_CONTROL_USD_PER_SECOND;
  durationSeconds: number;
}): {
  usdPerSecond: number;
  estimatedUsd: number;
  estimatedCostMinor: number;
  currency: "USD";
  mode: "indicative";
  pricingVersion: string;
} {
  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0 ||
    input.durationSeconds > 30
  ) {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Durée hors bornes documentées pour estimation indicative.",
    );
  }
  const usdPerSecond = FAL_KLING_MOTION_CONTROL_USD_PER_SECOND[input.endpointId];
  const estimatedUsd = usdPerSecond * input.durationSeconds;
  return {
    usdPerSecond,
    estimatedUsd,
    estimatedCostMinor: Math.ceil(estimatedUsd * 100),
    currency: "USD",
    mode: "indicative",
    pricingVersion: "fal-llms.txt-2026-08-11",
  };
}

/** False-positive endpoints already in VHS fal VIDEO_MODELS — must never route as motion_transfer. */
export const VHS_FAL_FALSE_POSITIVE_VIDEO_ENDPOINTS = [
  "fal-ai/kling-video/v2/master/image-to-video",
  "fal-ai/kling-video/v2/master/text-to-video",
  "fal-ai/runway-gen3/turbo/image-to-video",
  "fal-ai/veo3.1/fast",
  "bytedance/seedance-2.0/reference-to-video",
  "fal-ai/minimax/hailuo-02/standard/text-to-video",
] as const;

export function isFalKlingMotionControlEndpoint(endpointId: string): boolean {
  return (
    endpointId === FAL_KLING_V3_PRO_MOTION_CONTROL_ENDPOINT ||
    endpointId === FAL_KLING_V3_STANDARD_MOTION_CONTROL_ENDPOINT ||
    endpointId === FAL_KLING_V26_PRO_MOTION_CONTROL_ENDPOINT ||
    endpointId === FAL_KLING_V26_STANDARD_MOTION_CONTROL_ENDPOINT
  );
}

export function assertNotI2vFalsePositive(endpointId: string): void {
  if (
    (VHS_FAL_FALSE_POSITIVE_VIDEO_ENDPOINTS as readonly string[]).includes(
      endpointId,
    )
  ) {
    throw new MotionTransferDomainError(
      "model_not_supported",
      "I2V/T2V n'est pas du motion transfer.",
      { diagnostic: `false_positive:${endpointId}` },
    );
  }
}
