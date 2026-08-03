/**
 * Domain project foundation — VHS-004.
 * Pure TypeScript: states, revisions, optimistic locking, approvals.
 * No React, Supabase, Next.js, or providers.
 */

export {
  ArtifactTypeValues,
  REQUIRED_FOR_PRODUCTION,
  isArtifactType,
  type ArtifactType,
} from "./artifact-types";

export {
  ProjectDomainError,
  isProjectDomainError,
  type ProjectDomainErrorCode,
} from "./errors";

export {
  ProjectStatusValues,
  assertProjectTransition,
  canTransitionProject,
  getAllowedProjectTransitions,
  isProjectStatus,
  transitionProject,
  type ProjectState,
  type ProjectStatus,
  type ProjectTransitionOptions,
} from "./project-state";

export {
  SceneStatusValues,
  assertSceneTransition,
  canTransitionScene,
  getAllowedSceneTransitions,
  isSceneStatus,
  transitionScene,
  type SceneState,
  type SceneStatus,
  type SceneTransitionContext,
} from "./scene-state";

export {
  REVISION_SCHEMA_VERSION,
  activateRevision,
  createInitialRevision,
  createNextRevision,
  freezeSerializableValue,
  validateRevisionChain,
  type ActiveRevision,
  type CreateInitialRevisionInput,
  type CreateNextRevisionInput,
  type Revision,
  type RevisionReason,
} from "./revision";

export {
  applyOptimisticUpdate,
  assertExpectedRevision,
  type OptimisticUpdateResult,
  type OptimisticWrite,
  type VersionToken,
} from "./concurrency";

export {
  MAX_APPROVAL_COMMENT_LENGTH,
  assertApprovalCurrent,
  checkProductionReadiness,
  createApproval,
  isApprovalCurrent,
  type Approval,
  type ApprovalStatus,
  type CreateApprovalInput,
  type ProductionReadiness,
  type ProductionReadinessInput,
} from "./approval";

export {
  ActiveRevisionSchema,
  ApprovalSchema,
  ArtifactTypeSchema,
  PROJECT_DOMAIN_SCHEMA_VERSION,
  ProjectStateSchema,
  ProjectStatusSchema,
  RevisionSchemaZ,
  SceneStateSchema,
  SceneStatusSchema,
  VersionTokenSchema,
} from "./schemas";

export {
  ARTIFACT_CHILDREN,
  PIPELINE_ORDER,
  PROVENANCE_KEYS,
  RESTART_DIRECTOR_BY_TYPE,
  assertArtifactType,
  dependsOnAny,
  descendantsOf,
  determineRestartPoint,
  extractProvenanceIds,
} from "./dependency-graph";

export {
  briefsAreIdentical,
  diffBriefFields,
  type BriefFieldChange,
} from "./brief-diff";
