/**
 * VHS-122 — persisted deterministic Prompt Director.
 * Builds ScenePackage[] from active server artifacts; no provider, no budget.
 */
import { createHash, randomUUID } from "node:crypto";
import { createArtifactMetadata } from "@/domain/shared";
import { VideoProjectBriefSchema } from "@/domain/brief";
import { CreativeConceptSchema } from "@/domain/creative";
import { MarketingPlanSchema } from "@/domain/marketing";
import { VideoScriptSchema } from "@/domain/script";
import { VisualDirectionSchema } from "@/domain/art";
import { StoryboardProjectSchema } from "@/domain/storyboard";
import {
  PROMPT_RENDERER_VERSION,
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  SCENE_PACKAGE_SET_SCHEMA_VERSION,
  ScenePackageSetSchema,
  type ScenePackageSet,
} from "@/domain/prompt";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createPromptDirector } from "./prompt-director";
import type { PromptAnalyzerPort } from "./analyzer-port";
import type { DirectorRunContext } from "./result";
import { runPromptDryRun } from "./dry-run";

type Warning = { code: string; message: string };

export type ScenePackageSafeView = {
  sceneId: string;
  sceneOrder: number;
  productionIntent: string;
  capabilityProfiles: string[];
  blocks: string[];
  constraintCount: number;
  referenceCount: number;
  hasDialogue: boolean;
  hasScreenText: boolean;
};

export type ScenePackageSetView = {
  revision: number;
  status: "ready" | "absent";
  storyboardRevisionId?: string;
  rendererVersion?: string;
  sceneCount?: number;
  packages?: ScenePackageSafeView[];
  warnings: Warning[];
};

export type PromptProjectInput = {
  projectId: string;
  expectedStoryboardRevision?: number;
  expectedVisualDirectionRevision?: number;
  expectedVideoScriptRevision?: number;
};

export type PromptProjectDryRunResult = {
  executable: boolean;
  providerCalled: false;
  executionAvailable: boolean;
  briefRevision: number;
  briefArtifactId: string;
  marketingPlanRevision: number;
  marketingPlanArtifactId: string;
  creativeConceptRevision: number;
  creativeConceptArtifactId: string;
  videoScriptRevision: number;
  videoScriptArtifactId: string;
  visualDirectionRevision: number;
  visualDirectionArtifactId: string;
  storyboardRevision: number;
  storyboardArtifactId: string;
  rendererVersion: typeof PROMPT_RENDERER_VERSION;
  schemaVersion: typeof SCENE_PACKAGE_SET_SCHEMA_VERSION;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Warning[];
  missingInformation: Array<{ code: string; message: string; field?: string }>;
  existingPackageSet?: ScenePackageSetView;
};

export type PromptProjectResult =
  | { status: "completed" | "existing"; packageSet: ScenePackageSetView; directorRunId: string }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | {
      status: "needs_input";
      missingInformation: Array<{ code: string; message: string; field?: string }>;
      warnings: Warning[];
      directorRunId?: string;
    }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 402 | 409 | 422 | 429 | 500 | 502 | 503 | 504;
      directorRunId?: string;
    };

export type PromptDirectorRunPort = {
  beginOrGet(input: {
    id: string;
    workspaceId: string;
    projectId: string;
    storyboardArtifactId: string;
    storyboardRevision: number;
    visualDirectionArtifactId: string;
    visualDirectionRevision: number;
    videoScriptArtifactId: string;
    videoScriptRevision: number;
    creativeConceptArtifactId: string;
    creativeConceptRevision: number;
    marketingPlanArtifactId: string;
    marketingPlanRevision: number;
    briefArtifactId: string;
    briefRevision: number;
    modelId: string;
    promptVersion: string;
    schemaVersion: string;
    idempotencyKey: string;
    commandFingerprint: string;
    correlationId: string;
  }): Promise<
    | { status: "created"; directorRunId: string; revision: number }
    | { status: "existing"; directorRunId: string; revision: number; outputArtifactId: string }
    | { status: "already_running"; directorRunId: string; revision: number }
  >;
  persistScenePackageSet(input: {
    workspaceId: string;
    projectId: string;
    directorRunId: string;
    artifactId: string;
    storyboardArtifactId: string;
    storyboardRevision: number;
    visualDirectionArtifactId: string;
    visualDirectionRevision: number;
    videoScriptArtifactId: string;
    videoScriptRevision: number;
    creativeConceptArtifactId: string;
    creativeConceptRevision: number;
    marketingPlanArtifactId: string;
    marketingPlanRevision: number;
    briefArtifactId: string;
    briefRevision: number;
    packageSet: Record<string, unknown>;
    schemaVersion: string;
    correlationId: string;
    expectedRunRevision: number;
  }): Promise<{ status: "created" | "existing"; artifactId: string; revision: number }>;
  failRun(input: {
    directorRunId: string;
    workspaceId: string;
    expectedRevision: number;
    errorCode: string;
    status: "failed" | "needs_input" | "cancelled";
    correlationId: string;
  }): Promise<void>;
  loadActiveScenePackageSet(projectId: string): Promise<{ revision: number; value: unknown } | null>;
};

export type BuildScenePackagesForProjectDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  directorRuns: PromptDirectorRunPort;
  /** Optional; defaults to deterministic empty-candidate analyzer. */
  analyzer?: PromptAnalyzerPort;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
};

export type BuildScenePackagesForProject = {
  dryRun(input: PromptProjectInput, context: DirectorRunContext): Promise<PromptProjectDryRunResult>;
  execute(input: PromptProjectInput, context: DirectorRunContext): Promise<PromptProjectResult>;
};

/** Deterministic analyzer — domain rebuilds all blocks from sources. */
export function createDeterministicPromptAnalyzer(): PromptAnalyzerPort {
  return {
    async analyze() {
      return {};
    },
  };
}

function toSafeView(set: ScenePackageSet, revision: number, warnings: Warning[] = []): ScenePackageSetView {
  return {
    revision,
    status: "ready",
    storyboardRevisionId: set.storyboardRevisionId,
    rendererVersion: set.rendererVersion,
    sceneCount: set.packages.length,
    packages: set.packages.map((p) => ({
      sceneId: p.sceneId,
      sceneOrder: p.sceneOrder,
      productionIntent: p.productionIntent,
      capabilityProfiles: p.variants.map((v) => v.capabilityProfile),
      blocks: [
        "subject",
        "action",
        "environment",
        "camera",
        "lighting",
        "style",
        "composition",
        ...(p.dialogue ? ["dialogue"] : []),
        ...(p.audio ? ["audio"] : []),
        ...(p.screenText ? ["screenText"] : []),
      ],
      constraintCount:
        p.constraints.required.length +
        p.constraints.forbidden.length +
        p.constraints.continuity.length +
        p.constraints.safety.length,
      referenceCount: p.references.length,
      hasDialogue: Boolean(p.dialogue),
      hasScreenText: Boolean(p.screenText),
    })),
    warnings,
  };
}

function stored(value: unknown, revision: number): ScenePackageSetView | undefined {
  const parsed = ScenePackageSetSchema.safeParse(value);
  return parsed.success ? toSafeView(parsed.data, revision) : undefined;
}

async function active<T>(
  artifacts: ArtifactRepository,
  projectId: string,
  type:
    | "video_project_brief"
    | "marketing_plan"
    | "creative_concept"
    | "video_script"
    | "visual_direction"
    | "storyboard_project",
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
) {
  const current = await artifacts.getActive(projectId, type);
  if (!current) return null;
  const item = await artifacts.load(current.artifactId);
  if (!item) return null;
  const parsed = schema.safeParse(item.value);
  return parsed.success
    ? { value: parsed.data, artifactId: current.artifactId, revision: current.revision }
    : null;
}

function failed(
  code: string,
  publicMessage: string,
  httpHint: Extract<PromptProjectResult, { status: "failed" }>["httpHint"],
  extra: Partial<Extract<PromptProjectResult, { status: "failed" }>> = {},
): Extract<PromptProjectResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false, ...extra };
}

function empty(
  partial: Partial<PromptProjectDryRunResult> & Pick<PromptProjectDryRunResult, "validations" | "missingInformation">,
): PromptProjectDryRunResult {
  return {
    executable: false,
    providerCalled: false,
    executionAvailable: false,
    briefRevision: 0,
    briefArtifactId: "",
    marketingPlanRevision: 0,
    marketingPlanArtifactId: "",
    creativeConceptRevision: 0,
    creativeConceptArtifactId: "",
    videoScriptRevision: 0,
    videoScriptArtifactId: "",
    visualDirectionRevision: 0,
    visualDirectionArtifactId: "",
    storyboardRevision: 0,
    storyboardArtifactId: "",
    rendererVersion: PROMPT_RENDERER_VERSION,
    schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
    warnings: [],
    ...partial,
  };
}

function wrapPackageSet(
  output: { storyboardRevisionId: string; packages: ScenePackageSet["packages"] },
  meta: { id: string; projectId: string; createdBy: string; correlationId: string },
): ScenePackageSet {
  const metadata = createArtifactMetadata({
    id: meta.id,
    projectId: meta.projectId,
    createdBy: meta.createdBy,
    correlationId: meta.correlationId,
    schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
  });
  const set: ScenePackageSet = {
    ...metadata,
    artifactType: SCENE_PACKAGE_SET_ARTIFACT_TYPE,
    storyboardRevisionId: output.storyboardRevisionId,
    rendererVersion: PROMPT_RENDERER_VERSION,
    packages: output.packages,
  };
  return ScenePackageSetSchema.parse(set);
}

export function createBuildScenePackagesForProject(
  deps: BuildScenePackagesForProjectDeps,
): BuildScenePackagesForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const analyzer = deps.analyzer ?? createDeterministicPromptAnalyzer();

  async function sources(projectId: string) {
    return Promise.all([
      active(deps.artifacts, projectId, "video_project_brief", VideoProjectBriefSchema),
      active(deps.artifacts, projectId, "marketing_plan", MarketingPlanSchema),
      active(deps.artifacts, projectId, "creative_concept", CreativeConceptSchema),
      active(deps.artifacts, projectId, "video_script", VideoScriptSchema),
      active(deps.artifacts, projectId, "visual_direction", VisualDirectionSchema),
      active(deps.artifacts, projectId, "storyboard_project", StoryboardProjectSchema),
    ]);
  }

  async function dry(input: PromptProjectInput): Promise<PromptProjectDryRunResult> {
    if (!canUseDirectorV2Persistence(env)) {
      return empty({
        validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }],
        missingInformation: [],
      });
    }
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) {
      return empty({
        validations: [{ code: "project", passed: false, message: "Projet introuvable." }],
        missingInformation: [{ code: "project_missing", message: "Projet introuvable." }],
      });
    }
    const [brief, plan, concept, script, visual, storyboard] = await sources(input.projectId);
    if (!brief || !plan || !concept || !script || !visual || !storyboard) {
      const missing = !brief
        ? "brief"
        : !plan
          ? "marketing_plan"
          : !concept
            ? "creative_concept"
            : !script
              ? "video_script"
              : !visual
                ? "visual_direction"
                : "storyboard_project";
      return empty({
        briefRevision: brief?.revision ?? 0,
        briefArtifactId: brief?.artifactId ?? "",
        marketingPlanRevision: plan?.revision ?? 0,
        marketingPlanArtifactId: plan?.artifactId ?? "",
        creativeConceptRevision: concept?.revision ?? 0,
        creativeConceptArtifactId: concept?.artifactId ?? "",
        videoScriptRevision: script?.revision ?? 0,
        videoScriptArtifactId: script?.artifactId ?? "",
        visualDirectionRevision: visual?.revision ?? 0,
        visualDirectionArtifactId: visual?.artifactId ?? "",
        storyboardRevision: storyboard?.revision ?? 0,
        storyboardArtifactId: storyboard?.artifactId ?? "",
        validations: [{ code: missing, passed: false, message: `Pré-requis actif introuvable (${missing}).` }],
        missingInformation: [{ code: `${missing}_missing`, message: "Pré-requis actif introuvable." }],
      });
    }
    const readiness = runPromptDryRun(
      brief.value,
      plan.value,
      concept.value,
      script.value,
      visual.value,
      storyboard.value,
    );
    const existing = await deps.directorRuns.loadActiveScenePackageSet(input.projectId);
    return {
      executable: readiness.executable,
      providerCalled: false,
      executionAvailable: readiness.executable,
      briefRevision: brief.revision,
      briefArtifactId: brief.artifactId,
      marketingPlanRevision: plan.revision,
      marketingPlanArtifactId: plan.artifactId,
      creativeConceptRevision: concept.revision,
      creativeConceptArtifactId: concept.artifactId,
      videoScriptRevision: script.revision,
      videoScriptArtifactId: script.artifactId,
      visualDirectionRevision: visual.revision,
      visualDirectionArtifactId: visual.artifactId,
      storyboardRevision: storyboard.revision,
      storyboardArtifactId: storyboard.artifactId,
      rendererVersion: PROMPT_RENDERER_VERSION,
      schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
      validations: readiness.validations,
      warnings: readiness.warnings,
      missingInformation: readiness.missingInformation.map((m) => ({
        code: m.code,
        message: m.message,
        field: m.field,
      })),
      existingPackageSet: existing ? stored(existing.value, existing.revision) : undefined,
    };
  }

  return {
    dryRun: async (input) => dry(input),
    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failed("not_found", "Projet introuvable.", 400);
      }
      const [brief, plan, concept, script, visual, storyboard] = await sources(input.projectId);
      if (!brief) return failed("brief_missing", "Brief actif introuvable.", 422);
      if (!plan) return failed("marketing_plan_missing", "Marketing Plan actif introuvable.", 422);
      if (!concept) return failed("creative_concept_missing", "Creative Concept actif introuvable.", 422);
      if (!script) return failed("video_script_missing", "Script actif introuvable.", 422);
      if (!visual) return failed("visual_direction_missing", "Direction art active introuvable.", 422);
      if (!storyboard) return failed("storyboard_missing", "Storyboard actif introuvable.", 422);
      if (
        input.expectedStoryboardRevision != null &&
        input.expectedStoryboardRevision !== storyboard.revision
      ) {
        return failed(
          "storyboard_revision_conflict",
          "Le Storyboard a changé depuis la vérification.",
          409,
        );
      }
      if (
        input.expectedVisualDirectionRevision != null &&
        input.expectedVisualDirectionRevision !== visual.revision
      ) {
        return failed(
          "visual_direction_revision_conflict",
          "La Direction art a changé depuis la vérification.",
          409,
        );
      }
      if (
        input.expectedVideoScriptRevision != null &&
        input.expectedVideoScriptRevision !== script.revision
      ) {
        return failed(
          "video_script_revision_conflict",
          "Le Script a changé depuis la vérification.",
          409,
        );
      }
      const check = await dry(input);
      if (!check.executable) {
        return {
          status: "needs_input",
          missingInformation: check.missingInformation,
          warnings: check.warnings,
        };
      }
      const fields = [
        input.projectId,
        brief.artifactId,
        String(brief.revision),
        plan.artifactId,
        String(plan.revision),
        concept.artifactId,
        String(concept.revision),
        script.artifactId,
        String(script.revision),
        visual.artifactId,
        String(visual.revision),
        storyboard.artifactId,
        String(storyboard.revision),
        PROMPT_RENDERER_VERSION,
        SCENE_PACKAGE_SET_SCHEMA_VERSION,
      ];
      const raw = ["prm", ...fields].join(":");
      const key = raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
      const fingerprint = createHash("sha256").update(fields.join("|")).digest("hex");
      const begin = await deps.directorRuns.beginOrGet({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        storyboardArtifactId: storyboard.artifactId,
        storyboardRevision: storyboard.revision,
        visualDirectionArtifactId: visual.artifactId,
        visualDirectionRevision: visual.revision,
        videoScriptArtifactId: script.artifactId,
        videoScriptRevision: script.revision,
        creativeConceptArtifactId: concept.artifactId,
        creativeConceptRevision: concept.revision,
        marketingPlanArtifactId: plan.artifactId,
        marketingPlanRevision: plan.revision,
        briefArtifactId: brief.artifactId,
        briefRevision: brief.revision,
        modelId: "deterministic",
        promptVersion: PROMPT_RENDERER_VERSION,
        schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
        idempotencyKey: key,
        commandFingerprint: fingerprint,
        correlationId: context.correlationId,
      });
      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Une construction de packages est déjà en cours.",
        };
      }
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        const prior = artifact && stored(artifact.value, artifact.revision);
        if (prior) {
          return { status: "existing", packageSet: prior, directorRunId: begin.directorRunId };
        }
      }
      const runId = begin.directorRunId;
      const run = await createPromptDirector({ analyzer }).run(
        {
          brief: brief.value,
          marketingPlan: plan.value,
          creativeConcept: concept.value,
          videoScript: script.value,
          visualDirection: visual.value,
          storyboard: storyboard.value,
        },
        {
          ...context,
          mode: "execute",
          planId: id(),
          createdBy: "shared-password-user",
        },
      );
      if (run.status === "needs_input") {
        await deps.directorRuns.failRun({
          directorRunId: runId,
          workspaceId: deps.workspaceId,
          expectedRevision: begin.revision,
          errorCode: "needs_input",
          status: "needs_input",
          correlationId: context.correlationId,
        });
        return {
          status: "needs_input",
          missingInformation: run.missingInformation,
          warnings: run.warnings,
          directorRunId: runId,
        };
      }
      if (run.status === "invalid") {
        await deps.directorRuns.failRun({
          directorRunId: runId,
          workspaceId: deps.workspaceId,
          expectedRevision: begin.revision,
          errorCode: "invalid_candidate",
          status: "failed",
          correlationId: context.correlationId,
        });
        return failed(
          "invalid_candidate",
          run.errors[0]?.message ?? "Packages invalides.",
          422,
          { directorRunId: runId },
        );
      }
      try {
        const packageSet = wrapPackageSet(run.output, {
          id: id(),
          projectId: input.projectId,
          createdBy: "shared-password-user",
          correlationId: context.correlationId,
        });
        const persisted = await deps.directorRuns.persistScenePackageSet({
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          directorRunId: runId,
          artifactId: packageSet.id,
          storyboardArtifactId: storyboard.artifactId,
          storyboardRevision: storyboard.revision,
          visualDirectionArtifactId: visual.artifactId,
          visualDirectionRevision: visual.revision,
          videoScriptArtifactId: script.artifactId,
          videoScriptRevision: script.revision,
          creativeConceptArtifactId: concept.artifactId,
          creativeConceptRevision: concept.revision,
          marketingPlanArtifactId: plan.artifactId,
          marketingPlanRevision: plan.revision,
          briefArtifactId: brief.artifactId,
          briefRevision: brief.revision,
          packageSet: packageSet as unknown as Record<string, unknown>,
          schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
          correlationId: context.correlationId,
          expectedRunRevision: begin.revision,
        });
        return {
          status: persisted.status === "existing" ? "existing" : "completed",
          packageSet: toSafeView(packageSet, persisted.revision, run.warnings),
          directorRunId: runId,
        };
      } catch {
        await deps.directorRuns
          .failRun({
            directorRunId: runId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: "persist_failed",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failed("persist_failed", "La persistance des packages a échoué.", 503, {
          directorRunId: runId,
        });
      }
    },
  };
}
