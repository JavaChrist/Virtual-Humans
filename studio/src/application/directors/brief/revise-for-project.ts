/**
 * VHS-126 — ReviseProjectBrief: immutable next revision + downstream stale invalidation.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  BRIEF_SCHEMA_VERSION,
  finalizeBrief,
  type VideoProjectBrief,
  type VideoProjectBriefFields,
} from "@/domain/brief";
import type { ArtifactType } from "@/domain/project";
import {
  briefsAreIdentical,
  diffBriefFields,
  type BriefFieldChange,
} from "@/domain/project/brief-diff";
import {
  descendantsOf,
  determineRestartPoint,
} from "@/domain/project/dependency-graph";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import type { DirectorRunContext } from "@/application/directors/marketing/result";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";

export type StaleArtifactView = {
  artifactType: ArtifactType;
  artifactId: string;
  revision: number;
  staleReason: string | null;
  staleSince: string | null;
  causedByType: string | null;
  sourceRevision: number | null;
};

export type BriefRevisionView = {
  artifactId: string;
  revision: number;
  createdAt: string;
  projectName: string;
  isActive: boolean;
};

export type BriefRevisePort = {
  revise(input: {
    workspaceId: string;
    projectId: string;
    newArtifactId: string;
    brief: Record<string, unknown>;
    schemaVersion: string;
    expectedBriefRevision: number;
    expectedProjectRevision: number;
    idempotencyKey: string;
    commandFingerprint: string;
    correlationId: string;
    createdBy: string;
    actorType: string;
    actorId: string;
  }): Promise<{
    status: "created" | "existing";
    artifactId: string;
    revision: number;
    projectRevision: number;
    previousArtifactId?: string;
    previousRevision?: number;
    restartPoint: string;
    staleTypes: string[];
  }>;
  listStale(input: {
    workspaceId: string;
    projectId: string;
  }): Promise<StaleArtifactView[]>;
  clearStale(input: {
    workspaceId: string;
    projectId: string;
    artifactType: string;
  }): Promise<void>;
  listBriefRevisions(input: {
    workspaceId: string;
    projectId: string;
  }): Promise<BriefRevisionView[]>;
};

export type ReviseBriefDryRunResult = {
  executable: boolean;
  providerCalled: false;
  currentRevision: number;
  projectRevision: number;
  changes: BriefFieldChange[];
  identical: boolean;
  wouldInvalidate: ArtifactType[];
  restartPoint: ArtifactType;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  missingInformation: Array<{ code: string; message: string }>;
};

export type ReviseBriefResult =
  | {
      status: "completed" | "existing";
      brief: VideoProjectBrief;
      previousRevision: number;
      projectRevision: number;
      changes: BriefFieldChange[];
      staleTypes: ArtifactType[];
      restartPoint: ArtifactType;
    }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 404 | 409 | 422 | 503;
    };

export type ReviseProjectBrief = {
  dryRun(
    input: {
      projectId: string;
      fields: Partial<VideoProjectBriefFields>;
    },
    context: DirectorRunContext,
  ): Promise<ReviseBriefDryRunResult>;
  execute(
    input: {
      projectId: string;
      fields: Partial<VideoProjectBriefFields>;
      expectedBriefRevision: number;
      expectedProjectRevision: number;
      confirmation: true;
    },
    context: DirectorRunContext,
  ): Promise<ReviseBriefResult>;
  listRevisions(projectId: string): Promise<BriefRevisionView[]>;
  listStale(projectId: string): Promise<StaleArtifactView[]>;
  compare(
    projectId: string,
    opts?: { leftRevision?: number; rightRevision?: number },
  ): Promise<{
    left: BriefRevisionView | null;
    right: BriefRevisionView | null;
    changes: BriefFieldChange[];
  }>;
};

function failed(
  code: string,
  publicMessage: string,
  httpHint: 400 | 404 | 409 | 422 | 503,
): Extract<ReviseBriefResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false };
}

function asArtifactTypes(types: string[]): ArtifactType[] {
  return types.filter((t): t is ArtifactType => typeof t === "string") as ArtifactType[];
}

export function createReviseProjectBrief(deps: {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  briefRevisions: BriefRevisePort;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
  nowIso?: () => string;
}): ReviseProjectBrief {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  async function loadActiveBrief(projectId: string): Promise<{
    brief: VideoProjectBrief;
    artifactId: string;
    revision: number;
  } | null> {
    const active = await deps.artifacts.getActive(projectId, "video_project_brief");
    if (!active) return null;
    const loaded = await deps.artifacts.load(active.artifactId);
    if (!loaded) return null;
    return {
      brief: loaded.value as VideoProjectBrief,
      artifactId: active.artifactId,
      revision: active.revision,
    };
  }

  async function dry(
    input: { projectId: string; fields: Partial<VideoProjectBriefFields> },
    context: DirectorRunContext,
  ): Promise<ReviseBriefDryRunResult> {
    const empty: ReviseBriefDryRunResult = {
      executable: false,
      providerCalled: false,
      currentRevision: 0,
      projectRevision: 0,
      changes: [],
      identical: true,
      wouldInvalidate: [],
      restartPoint: "marketing_plan",
      validations: [],
      warnings: [],
      missingInformation: [],
    };
    if (!canUseDirectorV2Persistence(env)) {
      return {
        ...empty,
        validations: [{ code: "persistence", passed: false, message: "Persistance désactivée." }],
      };
    }
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) {
      return {
        ...empty,
        missingInformation: [{ code: "project_missing", message: "Projet introuvable." }],
        validations: [{ code: "project", passed: false, message: "Projet introuvable." }],
      };
    }
    const current = await loadActiveBrief(input.projectId);
    if (!current) {
      return {
        ...empty,
        projectRevision: project.activeRevision,
        missingInformation: [{ code: "brief_missing", message: "Brief actif introuvable." }],
        validations: [{ code: "brief", passed: false, message: "Brief actif introuvable." }],
      };
    }

    let candidate: VideoProjectBrief;
    try {
      candidate = finalizeBrief(
        {
          draftVersion: "1.0.0",
          updatedAt: nowIso(),
          currentStep: 5,
          fields: { ...current.brief, ...input.fields },
        },
        {
          id: "dry-run-brief",
          projectId: input.projectId,
          createdBy: context.createdBy ?? "shared-password-user",
          correlationId: context.correlationId,
          createdAt: nowIso(),
          revision: current.revision + 1,
        },
      );
    } catch (e) {
      return {
        ...empty,
        currentRevision: current.revision,
        projectRevision: project.activeRevision,
        validations: [
          {
            code: "invalid_brief",
            passed: false,
            message: e instanceof Error ? e.message : "Brief invalide.",
          },
        ],
        missingInformation: [
          {
            code: "invalid_brief",
            message: e instanceof Error ? e.message : "Brief invalide.",
          },
        ],
      };
    }

    const changes = diffBriefFields(current.brief, candidate);
    const identical = briefsAreIdentical(current.brief, candidate);
    const restartPoint = determineRestartPoint("video_project_brief");
    const wouldInvalidate = descendantsOf("video_project_brief");

    return {
      executable: !identical,
      providerCalled: false,
      currentRevision: current.revision,
      projectRevision: project.activeRevision,
      changes,
      identical,
      wouldInvalidate,
      restartPoint,
      validations: [
        {
          code: "has_changes",
          passed: !identical,
          message: identical
            ? "Aucun changement métier — révision refusée."
            : `${changes.length} champ(s) modifié(s).`,
        },
      ],
      warnings: identical
        ? [{ code: "identical_payload", message: "Payload identique au brief actif." }]
        : [
            {
              code: "downstream_invalidation",
              message:
                "Les artifacts descendants dont la provenance dépend de ce brief seront marqués stale.",
            },
          ],
      missingInformation: [],
    };
  }

  return {
    dryRun: dry,

    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failed("confirmation_required", "Confirmation requise.", 400);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failed("not_found", "Projet introuvable.", 404);
      }
      if (project.activeRevision !== input.expectedProjectRevision) {
        return failed("optimistic_conflict", "Conflit de révision projet.", 409);
      }
      const current = await loadActiveBrief(input.projectId);
      if (!current) return failed("brief_missing", "Brief actif introuvable.", 404);
      if (current.revision !== input.expectedBriefRevision) {
        return failed("optimistic_conflict", "Conflit de révision brief.", 409);
      }

      let candidate: VideoProjectBrief;
      const newId = id();
      try {
        candidate = finalizeBrief(
          {
            draftVersion: "1.0.0",
            updatedAt: nowIso(),
            currentStep: 5,
            fields: { ...current.brief, ...input.fields },
          },
          {
            id: newId,
            projectId: input.projectId,
            createdBy: context.createdBy ?? "shared-password-user",
            correlationId: context.correlationId,
            createdAt: nowIso(),
            revision: current.revision + 1,
          },
        );
      } catch (e) {
        return failed(
          "invalid_brief",
          e instanceof Error ? e.message : "Brief invalide.",
          422,
        );
      }

      const changes = diffBriefFields(current.brief, candidate);
      if (changes.length === 0) {
        return failed("identical_payload", "Aucun changement — révision refusée.", 422);
      }

      const fields = [
        input.projectId,
        String(input.expectedBriefRevision),
        String(input.expectedProjectRevision),
        createHash("sha256").update(JSON.stringify(changes)).digest("hex"),
      ];
      const idempotencyKey = `brf:${fields.join(":")}`.slice(0, 200);
      const fingerprint = createHash("sha256").update(fields.join("|")).digest("hex");

      try {
        const persisted = await deps.briefRevisions.revise({
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          newArtifactId: newId,
          brief: candidate as unknown as Record<string, unknown>,
          schemaVersion: BRIEF_SCHEMA_VERSION,
          expectedBriefRevision: input.expectedBriefRevision,
          expectedProjectRevision: input.expectedProjectRevision,
          idempotencyKey,
          commandFingerprint: fingerprint,
          correlationId: context.correlationId,
          createdBy: context.createdBy ?? "shared-password-user",
          actorType: "shared_password",
          actorId: context.createdBy ?? "shared-password-user",
        });

        const loaded = await deps.artifacts.load(persisted.artifactId);
        const brief = (loaded?.value ?? candidate) as VideoProjectBrief;
        return {
          status: persisted.status === "existing" ? "existing" : "completed",
          brief,
          previousRevision: persisted.previousRevision ?? current.revision,
          projectRevision: persisted.projectRevision,
          changes,
          staleTypes: asArtifactTypes(persisted.staleTypes),
          restartPoint: determineRestartPoint("video_project_brief"),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Échec révision.";
        if (/optimistic_conflict/i.test(msg)) {
          return failed("optimistic_conflict", "Conflit de révision.", 409);
        }
        if (/production_run_active/i.test(msg)) {
          return failed(
            "production_run_active",
            "Une production est en cours — révision refusée.",
            409,
          );
        }
        if (/project_not_found|brief_not_found/i.test(msg)) {
          return failed("not_found", "Projet ou brief introuvable.", 404);
        }
        return failed("revise_failed", "Échec de la révision du brief.", 422);
      }
    },

    async listRevisions(projectId) {
      return deps.briefRevisions.listBriefRevisions({
        workspaceId: deps.workspaceId,
        projectId,
      });
    },

    async listStale(projectId) {
      return deps.briefRevisions.listStale({
        workspaceId: deps.workspaceId,
        projectId,
      });
    },

    async compare(projectId, opts = {}) {
      const revisions = await deps.briefRevisions.listBriefRevisions({
        workspaceId: deps.workspaceId,
        projectId,
      });
      if (revisions.length === 0) {
        return { left: null, right: null, changes: [] };
      }
      const active = revisions.find((r) => r.isActive) ?? revisions[revisions.length - 1]!;
      const rightRev = opts.rightRevision ?? active.revision;
      const leftRev =
        opts.leftRevision ??
        (revisions.filter((r) => r.revision < rightRev).sort((a, b) => b.revision - a.revision)[0]
          ?.revision ?? rightRev);
      const leftMeta = revisions.find((r) => r.revision === leftRev) ?? null;
      const rightMeta = revisions.find((r) => r.revision === rightRev) ?? null;
      if (!leftMeta || !rightMeta) {
        return { left: leftMeta, right: rightMeta, changes: [] };
      }
      const leftArt = await deps.artifacts.load(leftMeta.artifactId);
      const rightArt = await deps.artifacts.load(rightMeta.artifactId);
      if (!leftArt || !rightArt) {
        return { left: leftMeta, right: rightMeta, changes: [] };
      }
      return {
        left: leftMeta,
        right: rightMeta,
        changes: diffBriefFields(
          leftArt.value as VideoProjectBrief,
          rightArt.value as VideoProjectBrief,
        ),
      };
    },
  };
}
