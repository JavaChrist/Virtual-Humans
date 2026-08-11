/**
 * Redaction helpers for Motion Transfer — no signed URLs, data URLs, or binaries.
 */

import { sanitizePublicMessage } from "./errors";
import type { MotionMediaReference } from "./media-reference";
import type {
  MotionQcIssue,
  MotionQcResult,
  MotionTransferInput,
  MotionTransferResult,
} from "./types";

export type RedactedMotionMediaReference = {
  assetId: string;
  kind: string;
  role: string;
  mimeType?: string;
  checksum?: string;
  accessKind: "internal" | "signed_url" | "data_url";
  storagePath?: string;
  signedUrl: "[redacted]" | null;
  dataUrl: "[redacted]" | null;
  durationSeconds?: number;
  width?: number;
  height?: number;
  provenance?: MotionMediaReference["provenance"];
};

export function redactMotionMediaReference(
  ref: MotionMediaReference,
): RedactedMotionMediaReference {
  const access = ref.asset.access;
  return {
    assetId: ref.asset.assetId,
    kind: ref.asset.kind,
    role: ref.role,
    mimeType: ref.asset.mimeType,
    checksum: ref.asset.checksum,
    accessKind: access.kind,
    storagePath: access.kind === "internal" ? access.storagePath : undefined,
    signedUrl: access.kind === "signed_url" ? "[redacted]" : null,
    dataUrl: access.kind === "data_url" ? "[redacted]" : null,
    durationSeconds: ref.durationSeconds,
    width: ref.width,
    height: ref.height,
    provenance: ref.provenance,
  };
}

export function redactMotionTransferInput(input: MotionTransferInput): {
  schemaVersion: string;
  capability: string;
  sourceVideo: RedactedMotionMediaReference;
  character: {
    characterId: string;
    identityLock: string;
    outfitLock?: string;
    fullBodyRequired?: boolean;
    identityReferences: RedactedMotionMediaReference[];
    outfitReference?: RedactedMotionMediaReference;
  };
  motion: MotionTransferInput["motion"];
  referenceSpec?: {
    movementId: string;
    version: string;
    title: string;
    humanValidationRequired: boolean;
    phaseCount: number;
    checkpointCount: number;
  };
  output: MotionTransferInput["output"];
  prompt: "[redacted]" | null;
  negativeConstraintCount: number;
  qcRequirementCodes: string[];
  correlationId: string;
} {
  return {
    schemaVersion: input.schemaVersion,
    capability: input.capability,
    sourceVideo: redactMotionMediaReference(input.sourceVideo),
    character: {
      characterId: input.character.characterId,
      identityLock: input.character.identityLock,
      outfitLock: input.character.outfitLock,
      fullBodyRequired: input.character.fullBodyRequired,
      identityReferences: input.character.identityReferences.map(
        redactMotionMediaReference,
      ),
      outfitReference: input.character.outfitReference
        ? redactMotionMediaReference(input.character.outfitReference)
        : undefined,
    },
    motion: { ...input.motion },
    referenceSpec: input.referenceSpec
      ? {
          movementId: input.referenceSpec.movementId,
          version: input.referenceSpec.version,
          title: input.referenceSpec.title,
          humanValidationRequired: input.referenceSpec.humanValidationRequired,
          phaseCount: input.referenceSpec.phases.length,
          checkpointCount: input.referenceSpec.checkpoints.length,
        }
      : undefined,
    output: { ...input.output },
    prompt: input.prompt ? "[redacted]" : null,
    negativeConstraintCount: input.negativeConstraints?.length ?? 0,
    qcRequirementCodes: input.qcRequirements.map((q) => q.code),
    correlationId: input.correlationId,
  };
}

export function redactMotionQcIssue(issue: MotionQcIssue): MotionQcIssue {
  return {
    code: issue.code,
    severity: issue.severity,
    message: sanitizePublicMessage(issue.message),
  };
}

export function redactMotionQcResult(result: MotionQcResult): MotionQcResult {
  return {
    ...result,
    issues: result.issues.map(redactMotionQcIssue),
    checkpointResults: result.checkpointResults.map((c) => ({
      checkpointId: c.checkpointId,
      status: c.status,
      notes: c.notes ? sanitizePublicMessage(c.notes) : undefined,
    })),
  };
}

export function redactMotionTransferResult(
  result: MotionTransferResult,
): Record<string, unknown> {
  return {
    schemaVersion: result.schemaVersion,
    status: result.status,
    asset: result.asset ? redactMotionMediaReference(result.asset) : undefined,
    providerId: result.providerId,
    modelId: result.modelId,
    providerJobId: result.providerJobId,
    usage: result.usage,
    costMinor: result.costMinor,
    provenance: result.provenance,
    qc: result.qc ? redactMotionQcResult(result.qc) : undefined,
    errorCode: result.errorCode,
    publicMessage: result.publicMessage
      ? sanitizePublicMessage(result.publicMessage)
      : undefined,
  };
}

export function assertNoSignedUrlLeak(value: unknown, path = "root"): void {
  if (typeof value === "string") {
    if (/https?:\/\//i.test(value) && /sign|token|X-Amz|sig=/i.test(value)) {
      throw new Error(`signed_url_leak_blocked at ${path}`);
    }
    if (value.startsWith("data:")) {
      throw new Error(`data_url_leak_blocked at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoSignedUrlLeak(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      assertNoSignedUrlLeak(v, `${path}.${k}`);
    }
  }
}
