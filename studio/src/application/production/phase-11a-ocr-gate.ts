/**
 * Phase 11A — provider-agnostic OCR port for provider-image text detection.
 * This phase: fake OCR in tests only. No paid OCR. No real network.
 */

export const PHASE_11A_OCR_UNAVAILABLE_MEASURE = "unavailable_humanOnly" as const;
export const PHASE_11A_PROVIDER_IMAGE_TEXT_DETECTED = "provider_image_text_detected" as const;

export type ImageOcrInspection = {
  available: boolean;
  detected: boolean;
  score: number;
  snippets: string[];
};

export type ImageOcrPort = {
  inspect(bytes: Uint8Array): Promise<ImageOcrInspection>;
};

export type ProviderImageTextGateResult =
  | { status: "pass"; measure: "ocr_clear"; detected: false }
  | { status: "fail"; measure: typeof PHASE_11A_PROVIDER_IMAGE_TEXT_DETECTED; detected: true; score: number }
  | { status: "unavailable_humanOnly"; measure: typeof PHASE_11A_OCR_UNAVAILABLE_MEASURE; detected: false };

export function createUnavailableImageOcrPort(): ImageOcrPort {
  return {
    async inspect() {
      return { available: false, detected: false, score: 0, snippets: [] };
    },
  };
}

export function createFakeImageOcrPort(script: {
  available?: boolean;
  detected?: boolean;
  score?: number;
  snippets?: string[];
}): ImageOcrPort {
  const available = script.available ?? true;
  return {
    async inspect() {
      return {
        available,
        detected: available ? Boolean(script.detected) : false,
        score: available ? (script.score ?? 0) : 0,
        snippets: available ? [...(script.snippets ?? [])] : [],
      };
    },
  };
}

export function evaluateProviderImageTextGate(
  inspection: ImageOcrInspection,
  threshold = 0.5,
): ProviderImageTextGateResult {
  if (!inspection.available) {
    return {
      status: "unavailable_humanOnly",
      measure: PHASE_11A_OCR_UNAVAILABLE_MEASURE,
      detected: false,
    };
  }
  if (inspection.detected && inspection.score > threshold) {
    return {
      status: "fail",
      measure: PHASE_11A_PROVIDER_IMAGE_TEXT_DETECTED,
      detected: true,
      score: inspection.score,
    };
  }
  return { status: "pass", measure: "ocr_clear", detected: false };
}

export async function inspectProviderImageText(input: {
  bytes: Uint8Array;
  ocr: ImageOcrPort;
  threshold?: number;
}): Promise<ProviderImageTextGateResult> {
  const inspection = await input.ocr.inspect(input.bytes);
  return evaluateProviderImageTextGate(inspection, input.threshold ?? 0.5);
}
