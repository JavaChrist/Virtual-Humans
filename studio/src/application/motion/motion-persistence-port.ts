/**
 * Motion Transfer persistence ports (MT-005).
 * In-memory fake for unit tests — never talks to Production.
 */

import {
  MOTION_PERSISTENCE_CONTRACT_VERSION,
  type MotionAssetProvenance,
  type MotionAssetRole,
  type MotionHumanReviewDecision,
  type MotionProviderOutputLifecycleStatus,
  type MotionSourceLifecycleStatus,
  assertMotionAssetMimeAllowed,
  isFinalizableMotionReview,
} from "@/domain/motion/persistence";
import {
  MOTION_ASSETS_BUCKET,
  buildMotionAssetStoragePath,
  dbKindForMotionRole,
} from "./motion-asset-path";

export type MotionMediaRegistration = {
  workspaceId: string;
  projectId: string;
  assetId: string;
  role: MotionAssetRole;
  mimeType: string;
  checksum: string;
  contentFingerprint: string;
  correlationId: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  licenseTag?: string;
  consentTag?: string;
  biometricPotential?: boolean;
};

export type MotionMediaRecord = {
  workspaceId: string;
  projectId: string;
  assetId: string;
  role: MotionAssetRole;
  mimeType: string;
  checksum: string;
  contentFingerprint: string;
  storageBucket: typeof MOTION_ASSETS_BUCKET;
  storagePath: string;
  dbKind: "image" | "video";
  provenance: MotionAssetProvenance;
  sourceLifecycle: MotionSourceLifecycleStatus;
  createdAt: string;
};

export type MotionPlanRecord = {
  workspaceId: string;
  projectId: string;
  planFingerprint: string;
  registryVersion: string;
  idempotencyMaterial: string;
  /** Redacted plan JSON — no signed URLs / prompts / binaries. */
  planRedacted: Record<string, unknown>;
  correlationId: string;
  createdAt: string;
};

export type MotionReviewRecord = {
  workspaceId: string;
  projectId: string;
  decisionId: string;
  decision: MotionHumanReviewDecision;
  productionResultRevisionId: string;
  idempotencyKey: string;
  correlationId: string;
  createdAt: string;
};

export type MotionPersistencePort = {
  registerMedia(input: MotionMediaRegistration, at: string): Promise<MotionMediaRecord>;
  getMediaByFingerprint(
    workspaceId: string,
    projectId: string,
    contentFingerprint: string,
  ): Promise<MotionMediaRecord | null>;
  /** Metadata only — never returns signed URLs. */
  getMediaMetadata(
    workspaceId: string,
    projectId: string,
    assetId: string,
  ): Promise<Omit<MotionMediaRecord, never> | null>;
  markSourceConsumed(
    workspaceId: string,
    projectId: string,
    assetId: string,
  ): Promise<void>;
  markProviderOutputLifecycle(
    workspaceId: string,
    projectId: string,
    assetId: string,
    status: MotionProviderOutputLifecycleStatus,
  ): Promise<void>;
  savePlan(record: MotionPlanRecord): Promise<MotionPlanRecord>;
  getPlan(
    workspaceId: string,
    projectId: string,
    planFingerprint: string,
  ): Promise<MotionPlanRecord | null>;
  recordHumanReview(record: MotionReviewRecord): Promise<MotionReviewRecord>;
  latestHumanReview(
    workspaceId: string,
    projectId: string,
  ): Promise<MotionReviewRecord | null>;
};

function assertScope(
  workspaceId: string,
  projectId: string,
  record: { workspaceId: string; projectId: string },
): void {
  if (record.workspaceId !== workspaceId || record.projectId !== projectId) {
    throw new Error("motion_persistence_scope_violation");
  }
}

function assertNoSignedUrlInJson(value: unknown): void {
  const blob = JSON.stringify(value);
  if (/https:\/\/\S+/i.test(blob) || /X-Amz-/i.test(blob) || /data:[^;]+;base64,/i.test(blob)) {
    throw new Error("motion_persistence_signed_or_inline_forbidden");
  }
}

/** In-memory fake — unit tests only. */
export function createMemoryMotionPersistencePort(): MotionPersistencePort {
  const media = new Map<string, MotionMediaRecord>();
  const byFp = new Map<string, string>();
  const plans = new Map<string, MotionPlanRecord>();
  const reviews: MotionReviewRecord[] = [];

  const mediaKey = (ws: string, proj: string, assetId: string) =>
    `${ws}::${proj}::${assetId}`;
  const fpKey = (ws: string, proj: string, fp: string) => `${ws}::${proj}::${fp}`;
  const planKey = (ws: string, proj: string, fp: string) => `${ws}::${proj}::${fp}`;

  return {
    async registerMedia(input, at) {
      assertMotionAssetMimeAllowed(input.role, input.mimeType);
      if (!input.checksum?.trim() || !input.contentFingerprint?.trim()) {
        throw new Error("motion_media_fingerprint_required");
      }
      const storagePath = buildMotionAssetStoragePath({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        role: input.role,
        assetId: input.assetId,
        mimeType: input.mimeType,
      });
      const provenance: MotionAssetProvenance = {
        schemaVersion: "1.0.0",
        motionRole: input.role,
        capability: "video.motion_transfer",
        contentFingerprint: input.contentFingerprint,
        correlationId: input.correlationId,
        sourceLifecycle: "available",
        licenseTag: input.licenseTag,
        consentTag: input.consentTag,
        biometricPotential: input.biometricPotential,
      };
      assertNoSignedUrlInJson(provenance);
      const record: MotionMediaRecord = {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        assetId: input.assetId,
        role: input.role,
        mimeType: input.mimeType,
        checksum: input.checksum,
        contentFingerprint: input.contentFingerprint,
        storageBucket: MOTION_ASSETS_BUCKET,
        storagePath,
        dbKind: dbKindForMotionRole(input.role, input.mimeType),
        provenance,
        sourceLifecycle: "available",
        createdAt: at,
      };
      media.set(mediaKey(input.workspaceId, input.projectId, input.assetId), record);
      byFp.set(
        fpKey(input.workspaceId, input.projectId, input.contentFingerprint),
        input.assetId,
      );
      return structuredClone(record);
    },

    async getMediaByFingerprint(workspaceId, projectId, contentFingerprint) {
      const assetId = byFp.get(fpKey(workspaceId, projectId, contentFingerprint));
      if (!assetId) return null;
      const rec = media.get(mediaKey(workspaceId, projectId, assetId));
      return rec ? structuredClone(rec) : null;
    },

    async getMediaMetadata(workspaceId, projectId, assetId) {
      const rec = media.get(mediaKey(workspaceId, projectId, assetId));
      if (!rec) return null;
      assertScope(workspaceId, projectId, rec);
      // Explicitly no signed URL field
      return structuredClone(rec);
    },

    async markSourceConsumed(workspaceId, projectId, assetId) {
      const rec = media.get(mediaKey(workspaceId, projectId, assetId));
      if (!rec) throw new Error("motion_media_not_found");
      assertScope(workspaceId, projectId, rec);
      rec.sourceLifecycle = "consumed_by_run";
      rec.provenance = {
        ...rec.provenance,
        sourceLifecycle: "consumed_by_run",
      };
    },

    async markProviderOutputLifecycle(workspaceId, projectId, assetId, status) {
      const rec = media.get(mediaKey(workspaceId, projectId, assetId));
      if (!rec) throw new Error("motion_media_not_found");
      assertScope(workspaceId, projectId, rec);
      if (status === "approved" && rec.role !== "motion_provider_output") {
        // approved output should be motion_approved_output role typically
      }
      rec.provenance = {
        ...rec.provenance,
        providerOutputLifecycle: status,
        lateOutput: status === "late_quarantined" ? true : rec.provenance.lateOutput,
      };
    },

    async savePlan(record) {
      assertNoSignedUrlInJson(record.planRedacted);
      const key = planKey(
        record.workspaceId,
        record.projectId,
        record.planFingerprint,
      );
      const existing = plans.get(key);
      if (existing) {
        if (existing.idempotencyMaterial !== record.idempotencyMaterial) {
          throw new Error("motion_plan_idempotency_conflict");
        }
        return structuredClone(existing);
      }
      plans.set(key, record);
      return structuredClone(record);
    },

    async getPlan(workspaceId, projectId, planFingerprint) {
      const rec = plans.get(planKey(workspaceId, projectId, planFingerprint));
      return rec ? structuredClone(rec) : null;
    },

    async recordHumanReview(record) {
      if (
        !(
          [
            "approved",
            "rejected",
            "retry_same_reference",
            "retry_updated_constraints",
            "request_new_reference",
          ] as const
        ).includes(record.decision)
      ) {
        throw new Error("invalid_review_decision");
      }
      const dup = reviews.find(
        (r) =>
          r.workspaceId === record.workspaceId &&
          r.idempotencyKey === record.idempotencyKey,
      );
      if (dup) return structuredClone(dup);
      reviews.push(record);
      return structuredClone(record);
    },

    async latestHumanReview(workspaceId, projectId) {
      const scoped = reviews.filter(
        (r) => r.workspaceId === workspaceId && r.projectId === projectId,
      );
      return scoped.length ? structuredClone(scoped[scoped.length - 1]!) : null;
    },
  };
}

export function assertMotionPlanNotFinalWithoutApprove(
  review: MotionReviewRecord | null,
): void {
  if (!review || !isFinalizableMotionReview(review.decision)) {
    throw new Error("motion_final_requires_approve");
  }
}

export const MOTION_PERSISTENCE_PORT_VERSION = MOTION_PERSISTENCE_CONTRACT_VERSION;
