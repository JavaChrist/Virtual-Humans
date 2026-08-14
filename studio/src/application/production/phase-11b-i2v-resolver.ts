/**
 * Phase 11B — call-time media resolver.
 * This phase never signs or reads Production media. Signed URL count stays 0.
 */
import type { ExistingMediaAssetReference } from "@/domain/generation/existing-media-asset-reference";
import type { ResolvedGenerationInput } from "@/domain/generation";
import { assertPhase11BSourceReferenceReady } from "./phase-11b-existing-asset";
import {
  PHASE_11B_SIGNED_URL_TTL_SECONDS,
  type Phase11BAllowlistGate,
} from "./phase-11b-i2v-allowlist";
import type { ExistingMediaAssetFacts } from "@/domain/generation/existing-media-asset-reference";

export type Phase11BSignIntent = {
  reserved: boolean;
  immediatelyBeforeSubmit: boolean;
  authorized: boolean;
};

export type Phase11BResolverStore = {
  signedUrlCount: number;
  mediaReads: number;
  persistedPayloads: unknown[];
};

export function resolvePhase11BExistingAssetToInternalInput(
  reference: ExistingMediaAssetReference,
  facts: ExistingMediaAssetFacts,
): ResolvedGenerationInput {
  assertPhase11BSourceReferenceReady(reference, facts);
  const resolved: ResolvedGenerationInput = {
    role: reference.sourceRole,
    asset: {
      assetId: reference.assetId,
      kind: "image",
      mimeType: reference.expectedMimeType,
      checksum: reference.expectedChecksum,
      access: {
        kind: "internal",
        storagePath: reference.expectedStoragePath,
      },
    },
  };
  const blob = JSON.stringify(resolved);
  if (/https?:\/\//i.test(blob) || /data:[^;]+;base64,/i.test(blob)) {
    throw new Error("Phase 11B resolver must not emit a URL before authorized call-time sign.");
  }
  return resolved;
}

export function assertPhase11BMayCreateSignedUrl(intent: Phase11BSignIntent): void {
  if (!intent.authorized || !intent.reserved || !intent.immediatelyBeforeSubmit) {
    throw new Error(
      "Phase 11B: signed URL is forbidden until reservation + immediate pre-submit Auth.",
    );
  }
}

export function phase11BResolverMustStayUnsigned(
  store: Phase11BResolverStore,
  persistCandidate: unknown,
): void {
  if (store.signedUrlCount !== 0 || store.mediaReads !== 0) {
    throw new Error("Phase 11B wiring preflight: signed URL and media read counts must stay 0.");
  }
  const blob = JSON.stringify(persistCandidate);
  if (/https?:\/\//i.test(blob) || /token=/i.test(blob) || /data:[^;]+;base64,/i.test(blob)) {
    throw new Error("Phase 11B: refused to persist a signed URL or media payload.");
  }
  store.persistedPayloads.push(persistCandidate);
}

export function phase11BSignedUrlPolicy(): {
  ttlSeconds: typeof PHASE_11B_SIGNED_URL_TTL_SECONDS;
  persist: false;
  downloadOnWorkerIfProviderAcceptsUrl: false;
} {
  return {
    ttlSeconds: PHASE_11B_SIGNED_URL_TTL_SECONDS,
    persist: false,
    downloadOnWorkerIfProviderAcceptsUrl: false,
  };
}

export function assertPhase11BResolverHostAllowlist(host: string): void {
  if (host !== "storage.supabase.co" && !host.endsWith(".supabase.co")) {
    throw new Error("Phase 11B resolver host is not allowlisted.");
  }
}

export function redactPhase11BResolverError(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]");
}

export function phase11BAllowlistFromResolved(
  reference: ExistingMediaAssetReference,
): Phase11BAllowlistGate {
  return {
    workspaceId: reference.workspaceId,
    projectId: reference.projectId,
    sceneId: reference.sourceSceneId,
    action: "video",
    capabilityProfile: "video.image_to_video",
    providerId: "fal",
    modelId: "fal-ai/kling-video/v2/master/image-to-video",
  };
}
