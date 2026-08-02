import { z } from "zod";
import { DomainIdSchema } from "@/domain/shared";
import { ArtifactTypeValues } from "./artifact-types";
import { MAX_APPROVAL_COMMENT_LENGTH } from "./approval";
import { ProjectStatusValues } from "./project-state";
import { REVISION_SCHEMA_VERSION } from "./revision";
import { SceneStatusValues } from "./scene-state";

export const ArtifactTypeSchema = z.enum(ArtifactTypeValues);
export const ProjectStatusSchema = z.enum(ProjectStatusValues);
export const SceneStatusSchema = z.enum(SceneStatusValues);

export const ProjectStateSchema = z.object({
  status: ProjectStatusSchema,
  previousStatus: ProjectStatusSchema.optional(),
});

export const SceneStateSchema = z.object({
  status: SceneStatusSchema,
  jobId: z.string().min(1).max(128).optional(),
});

export const RevisionSchemaZ = z.object({
  id: DomainIdSchema,
  projectId: DomainIdSchema,
  artifactType: ArtifactTypeSchema,
  revision: z.number().int().positive(),
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  value: z.unknown(),
  createdAt: z.iso.datetime({ offset: true }),
  createdBy: DomainIdSchema,
  correlationId: DomainIdSchema,
  parentRevisionId: DomainIdSchema.optional(),
  reason: z.enum(["initial", "correction", "regeneration", "approval_change", "system"]).optional(),
});

export const ActiveRevisionSchema = z.object({
  projectId: DomainIdSchema,
  artifactType: ArtifactTypeSchema,
  revisionId: DomainIdSchema,
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime({ offset: true }),
  updatedBy: DomainIdSchema,
});

export const VersionTokenSchema = z.object({
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const ApprovalSchema = z.object({
  id: DomainIdSchema,
  projectId: DomainIdSchema,
  artifactType: ArtifactTypeSchema,
  revisionId: DomainIdSchema,
  revision: z.number().int().positive(),
  status: z.enum(["approved", "rejected"]),
  decidedAt: z.iso.datetime({ offset: true }),
  decidedBy: DomainIdSchema,
  comment: z.string().max(MAX_APPROVAL_COMMENT_LENGTH).optional(),
});

export const PROJECT_DOMAIN_SCHEMA_VERSION = REVISION_SCHEMA_VERSION;
