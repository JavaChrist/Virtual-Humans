/**
 * VHS-120B persisted Art Director. Sources are exclusively active server artifacts.
 */
import { createHash, randomUUID } from "node:crypto";
import { VideoProjectBriefSchema } from "@/domain/brief";
import { CreativeConceptSchema } from "@/domain/creative";
import { MarketingPlanSchema } from "@/domain/marketing";
import { VideoScriptSchema } from "@/domain/script";
import {
  VISUAL_DIRECTION_SCHEMA_VERSION,
  VisualDirectionSchema,
  type VisualDirection,
} from "@/domain/art";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import { canExecuteArtAi, canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import {
  e2eFakeOpenAiConfig,
  isDirectorE2eFakeMode,
  textDirectorExecutionAvailable,
} from "@/infrastructure/e2e/e2e-text-director-gate";
import { DEFAULT_OPENAI_ART_MODEL, parseOpenAIArtConfig } from "@/infrastructure/ai/openai/config";
import { runOpenAIArtDryRun, ART_ANALYZER_PROMPT_VERSION, ART_CANDIDATE_SCHEMA_VERSION } from "@/infrastructure/ai/openai/art";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import {
  ART_FAILURE_PUBLIC_MESSAGES,
  artFailure,
  withArtPublicMessage,
} from "@/application/directors/art/failures";
import {
  httpStatusForMarketingFailure,
  type MarketingAnalysisFailureCode,
} from "@/application/directors/marketing/failures";
import {
  meteringCostStatusForFail,
  meteringKnownCostMinor,
  meteringUsageRecord,
} from "@/application/directors/shared/analyzer-metering";
import {
  resolveCharacterCapabilitiesForBrief,
  type CharacterPackageLookup,
} from "@/application/runtime/resolve-character-capabilities";
import {
  isArtHumanRetryEligible,
  LEGACY_ART_TIMEOUT_RETRY_REASON,
} from "@/domain/directors/legacy-art-timeout-misclassified";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CharacterCapabilitiesSnapshot } from "@/domain/art";
import { createArtDirector } from "./art-director";
import type { ArtAnalyzerPort } from "./analyzer-port";
import type { DirectorRunContext } from "./result";
import { createLogContext, logger } from "@/infrastructure/observability";

type CharacterResolution =
  | {
      status: "ok";
      brief: VideoProjectBrief;
      snapshot: CharacterCapabilitiesSnapshot | undefined;
      identityFingerprint: string | undefined;
    }
  | {
      status: "error";
      brief: VideoProjectBrief;
      code: string;
      message: string;
      field?: string;
    };

function resolveArtCharacter(
  brief: VideoProjectBrief,
  lookup?: CharacterPackageLookup,
): CharacterResolution {
  const resolved = lookup
    ? resolveCharacterCapabilitiesForBrief(brief, lookup)
    : resolveCharacterCapabilitiesForBrief(brief);
  if (resolved.status === "none") {
    return { status: "ok", brief, snapshot: undefined, identityFingerprint: undefined };
  }
  if (resolved.status === "resolved") {
    return {
      status: "ok",
      brief: resolved.value.brief,
      snapshot: resolved.value.snapshot,
      identityFingerprint: resolved.value.identityFingerprint,
    };
  }
  return {
    status: "error",
    brief,
    code: resolved.status === "not_found" ? "character_not_found" : "character_package_invalid",
    message: resolved.publicMessage,
    field: "characterId",
  };
}

type Warning = { code: string; message: string };
export type VisualDirectionView = {
  revision: number;
  status: "ready" | "absent";
  globalStyle?: { style: string; mood: string; realism: string; colorIntent: string };
  palette?: Array<{ name: string; hex: string; role: string }>;
  segments?: Array<{ id: string; shotSize: string; location: string }>;
  warnings: Warning[];
};
export type ArtProjectInput = {
  projectId: string;
  expectedVideoScriptRevision?: number;
  expectedCreativeConceptRevision?: number;
  expectedMarketingPlanRevision?: number;
};
export type ArtProjectRetryInput = {
  projectId: string;
  previousRunId: string;
  retryRequestId: string;
  expectedVideoScriptRevision: number;
  expectedCreativeConceptRevision?: number;
  expectedMarketingPlanRevision?: number;
};
export type ArtRetryCandidate = {
  previousRunId: string;
  previousAttemptNumber: number;
  nextAttemptNumber: number;
  errorCode: string;
  model: string;
  retryAvailable: boolean;
  /** Present only for Porte 8P-B legacy Art timeout misclassification. */
  legacyRetryReason?: typeof LEGACY_ART_TIMEOUT_RETRY_REASON;
};
export type ArtProjectDryRunResult = {
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
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  promptVersion: string;
  schemaVersion: string;
  pricingConfigured: boolean;
  estimatedCostMinor?: number;
  currency?: string;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Warning[];
  missingInformation: Array<{ code: string; message: string; field?: string }>;
  existingVisualDirection?: VisualDirectionView;
  /** Present when a human retry is eligible (failed retryable, no active visual direction). */
  retryCandidate?: ArtRetryCandidate;
};
export type ArtProjectResult =
  | { status: "completed" | "existing"; visualDirection: VisualDirectionView; directorRunId: string }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | { status: "needs_input"; missingInformation: Array<{ code: string; message: string; field?: string }>; warnings: Warning[]; directorRunId?: string }
  | { status: "failed"; code: string; publicMessage: string; retryable: boolean; httpHint: 400 | 402 | 409 | 422 | 429 | 500 | 502 | 503 | 504; retryAfterSeconds?: number; provider?: "openai"; directorRunId?: string };

export type ArtDirectorRunPort = {
  beginOrGet(input: {
    id: string; workspaceId: string; projectId: string;
    videoScriptArtifactId: string; videoScriptRevision: number;
    creativeConceptArtifactId: string; creativeConceptRevision: number;
    marketingPlanArtifactId: string; marketingPlanRevision: number;
    briefArtifactId: string; briefRevision: number;
    modelId: string; promptVersion: string; schemaVersion: string;
    idempotencyKey: string; commandFingerprint: string; correlationId: string;
    estimatedCostMinor?: number; currency?: string;
  }): Promise<{ status: "created"; directorRunId: string; revision: number } | { status: "existing"; directorRunId: string; revision: number; outputArtifactId: string } | { status: "already_running"; directorRunId: string; revision: number }>;
  beginOrRetry(input: {
    id: string;
    workspaceId: string;
    projectId: string;
    previousRunId: string;
    retryRequestId: string;
    inputArtifactId: string;
    inputRevision: number;
    modelId: string;
    promptVersion: string;
    schemaVersion: string;
    commandFingerprint: string;
    correlationId: string;
    estimatedCostMinor?: number;
    currency?: string;
  }): Promise<
    | {
        status: "created";
        directorRunId: string;
        revision: number;
        attemptNumber: number;
        retryOfRunId: string;
        legacyRetryReason?: typeof LEGACY_ART_TIMEOUT_RETRY_REASON;
      }
    | {
        status: "existing";
        directorRunId: string;
        revision: number;
        attemptNumber: number;
        retryOfRunId: string;
        outputArtifactId: string;
        legacyRetryReason?: typeof LEGACY_ART_TIMEOUT_RETRY_REASON;
      }
    | {
        status: "already_running";
        directorRunId: string;
        revision: number;
        attemptNumber: number;
        retryOfRunId: string;
        legacyRetryReason?: typeof LEGACY_ART_TIMEOUT_RETRY_REASON;
      }
    | {
        status: "terminal_replay";
        directorRunId: string;
        revision: number;
        attemptNumber: number;
        retryOfRunId: string;
        runStatus: string;
        errorCode?: string;
        outputArtifactId?: string;
        legacyRetryReason?: typeof LEGACY_ART_TIMEOUT_RETRY_REASON;
      }
  >;
  reserveBudget(input: { reservationId: string; workspaceId: string; projectId: string; directorRunId: string; attemptId: string; amountMinor: number; currency: string; correlationId: string; ledgerIdempotencyKey: string }): Promise<void>;
  persistVisualDirection(input: {
    workspaceId: string; projectId: string; directorRunId: string; artifactId: string;
    videoScriptArtifactId: string; videoScriptRevision: number;
    creativeConceptArtifactId: string; creativeConceptRevision: number;
    marketingPlanArtifactId: string; marketingPlanRevision: number;
    briefArtifactId: string; briefRevision: number;
    visualDirection: Record<string, unknown>; schemaVersion: string; correlationId: string;
    reservationId?: string; actualCostMinor?: number; costStatus: string;
    usage?: Record<string, unknown>; expectedRunRevision: number; ledgerIdempotencyKey?: string;
  }): Promise<{ status: "created" | "existing"; artifactId: string; revision: number }>;
  failRun(input: { directorRunId: string; workspaceId: string; expectedRevision: number; errorCode: string; status: "failed" | "needs_input" | "cancelled"; reservationId?: string; correlationId: string; usage?: Record<string, unknown>; actualCostMinor?: number; costStatus?: string }): Promise<void>;
  loadActiveVisualDirection(projectId: string): Promise<{ revision: number; value: unknown } | null>;
  loadRetryableFailedRun(projectId: string): Promise<{
    directorRunId: string;
    attemptNumber: number;
    errorCode: string;
    modelId: string;
    promptVersion: string;
    schemaVersion: string;
    inputArtifactId: string;
    inputRevision: number;
    legacyRetryReason?: typeof LEGACY_ART_TIMEOUT_RETRY_REASON;
  } | null>;
};
export type AnalyzeArtForProjectDeps = {
  workspaceId: string; projects: ProjectRepository; artifacts: ArtifactRepository;
  directorRuns: ArtDirectorRunPort; analyzer: ArtAnalyzerPort;
  pricing?: AiTokenPricingPort; env?: Record<string, string | undefined>; idFactory?: () => string;
  /** Optional CharacterRegistry override (tests). Default: Runtime characterRegistry. */
  characterLookup?: CharacterPackageLookup;
};
export type AnalyzeArtForProject = {
  dryRun(input: ArtProjectInput, context: DirectorRunContext): Promise<ArtProjectDryRunResult>;
  execute(input: ArtProjectInput, context: DirectorRunContext): Promise<ArtProjectResult>;
  executeRetry(input: ArtProjectRetryInput, context: DirectorRunContext): Promise<ArtProjectResult>;
};

function view(vd: VisualDirection, revision: number, warnings: Warning[] = []): VisualDirectionView {
  return {
    revision, status: "ready",
    globalStyle: { style: vd.globalStyle.style, mood: vd.globalStyle.mood, realism: vd.globalStyle.realism, colorIntent: vd.globalStyle.colorIntent },
    palette: vd.palette.map((c) => ({ name: c.name, hex: c.hex, role: c.role })),
    segments: vd.segments.map((s) => ({ id: s.id, shotSize: s.camera.shotSize, location: s.location.description })),
    warnings,
  };
}
function stored(value: unknown, revision: number) {
  const parsed = VisualDirectionSchema.safeParse(value);
  return parsed.success ? view(parsed.data, revision) : undefined;
}
async function active<T>(artifacts: ArtifactRepository, projectId: string, type: "video_project_brief" | "marketing_plan" | "creative_concept" | "video_script", schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }) {
  const current = await artifacts.getActive(projectId, type);
  if (!current) return null;
  const item = await artifacts.load(current.artifactId);
  if (!item) return null;
  const parsed = schema.safeParse(item.value);
  return parsed.success ? { value: parsed.data, artifactId: current.artifactId, revision: current.revision } : null;
}
function failed(code: string, publicMessage: string, httpHint: ArtProjectResult extends infer T ? T extends { httpHint: infer H } ? H : never : never, extra: Partial<Extract<ArtProjectResult, { status: "failed" }>> = {}) {
  return { status: "failed" as const, code, publicMessage, httpHint, retryable: false, ...extra };
}
function empty(partial: Partial<ArtProjectDryRunResult> & Pick<ArtProjectDryRunResult, "validations" | "missingInformation">): ArtProjectDryRunResult {
  return {
    executable: false, providerCalled: false, executionAvailable: false,
    briefRevision: 0, briefArtifactId: "", marketingPlanRevision: 0, marketingPlanArtifactId: "",
    creativeConceptRevision: 0, creativeConceptArtifactId: "", videoScriptRevision: 0, videoScriptArtifactId: "",
    model: DEFAULT_OPENAI_ART_MODEL, reasoningEffort: "unknown", maxOutputTokens: 0,
    promptVersion: ART_ANALYZER_PROMPT_VERSION, schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
    pricingConfigured: false, warnings: [], ...partial,
  };
}

export function createAnalyzeArtForProject(deps: AnalyzeArtForProjectDeps): AnalyzeArtForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>), id = deps.idFactory ?? randomUUID;
  async function sources(projectId: string) {
    return Promise.all([
      active(deps.artifacts, projectId, "video_project_brief", VideoProjectBriefSchema),
      active(deps.artifacts, projectId, "marketing_plan", MarketingPlanSchema),
      active(deps.artifacts, projectId, "creative_concept", CreativeConceptSchema),
      active(deps.artifacts, projectId, "video_script", VideoScriptSchema),
    ]);
  }
  async function dry(input: ArtProjectInput): Promise<ArtProjectDryRunResult> {
    if (!canUseDirectorV2Persistence(env)) return empty({ validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }], missingInformation: [] });
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) return empty({ validations: [{ code: "project", passed: false, message: "Projet introuvable." }], missingInformation: [{ code: "project_missing", message: "Projet introuvable." }] });
    const [brief, plan, concept, script] = await sources(input.projectId);
    if (!brief || !plan || !concept || !script) {
      const missing = !brief ? "brief" : !plan ? "marketing_plan" : !concept ? "creative_concept" : "video_script";
      return empty({
        briefRevision: brief?.revision ?? 0, briefArtifactId: brief?.artifactId ?? "",
        marketingPlanRevision: plan?.revision ?? 0, marketingPlanArtifactId: plan?.artifactId ?? "",
        creativeConceptRevision: concept?.revision ?? 0, creativeConceptArtifactId: concept?.artifactId ?? "",
        videoScriptRevision: script?.revision ?? 0, videoScriptArtifactId: script?.artifactId ?? "",
        validations: [{ code: missing, passed: false, message: `Pré-requis actif introuvable (${missing}).` }],
        missingInformation: [{ code: `${missing}_missing`, message: "Pré-requis actif introuvable." }],
      });
    }
    const character = resolveArtCharacter(brief.value, deps.characterLookup);
    if (character.status === "error") {
      return {
        executable: false, providerCalled: false, executionAvailable: false,
        briefRevision: brief.revision, briefArtifactId: brief.artifactId,
        marketingPlanRevision: plan.revision, marketingPlanArtifactId: plan.artifactId,
        creativeConceptRevision: concept.revision, creativeConceptArtifactId: concept.artifactId,
        videoScriptRevision: script.revision, videoScriptArtifactId: script.artifactId,
        model: DEFAULT_OPENAI_ART_MODEL, reasoningEffort: "unknown", maxOutputTokens: 0,
        promptVersion: ART_ANALYZER_PROMPT_VERSION, schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
        pricingConfigured: false, warnings: [],
        validations: [{ code: character.code, passed: false, message: character.message }],
        missingInformation: [{ code: character.code, message: character.message, field: character.field }],
      };
    }
    const ai = runOpenAIArtDryRun(
      character.brief, plan.value, concept.value, script.value, character.snapshot,
      { env, pricing: deps.pricing },
    );
    const existing = await deps.directorRuns.loadActiveVisualDirection(input.projectId);
    const existingVisualDirection = existing ? stored(existing.value, existing.revision) : undefined;
    const price = deps.pricing?.getPriceBook(ai.model);
    const estimated = price ? Math.floor(((ai.approximateInputTokens ?? 0) * price.inputPerMillionMinor) / 1_000_000) + Math.floor((ai.maxOutputTokens * price.outputPerMillionMinor) / 1_000_000) : undefined;
    const e2e = isDirectorE2eFakeMode(env);
    const domainExecutable = e2e ? true : ai.executable;
    const executionAvailable = textDirectorExecutionAvailable({
      env, domainExecutable, paidPathAvailable: canExecuteArtAi(env), pricingConfigured: ai.pricingConfigured,
    });
    const missingFromValidations = ai.validations.filter((v) => !v.passed).map((v) => ({ code: v.code, message: v.message }));
    const missingCodes = new Set(missingFromValidations.map((m) => m.code));
    const missingInformation = [
      ...missingFromValidations,
      ...ai.readinessMissing.filter((m) => !missingCodes.has(m.code)),
    ];
    let retryCandidate: ArtRetryCandidate | undefined;
    if (!existingVisualDirection) {
      const failedRun = await deps.directorRuns.loadRetryableFailedRun(input.projectId);
      if (
        failedRun &&
        failedRun.inputArtifactId === script.artifactId &&
        failedRun.inputRevision === script.revision &&
        isArtHumanRetryEligible({
          errorCode: failedRun.errorCode,
          legacyTimeoutMisclassified: failedRun.legacyRetryReason === LEGACY_ART_TIMEOUT_RETRY_REASON,
        })
      ) {
        const model = e2e ? e2eFakeOpenAiConfig().model : ai.model;
        const pricingOk = e2e ? true : ai.pricingConfigured;
        retryCandidate = {
          previousRunId: failedRun.directorRunId,
          previousAttemptNumber: failedRun.attemptNumber,
          nextAttemptNumber: failedRun.attemptNumber + 1,
          errorCode: failedRun.errorCode,
          model,
          retryAvailable:
            executionAvailable &&
            pricingOk &&
            failedRun.modelId === model &&
            failedRun.promptVersion === ai.promptVersion &&
            failedRun.schemaVersion === ai.schemaVersion,
          legacyRetryReason: failedRun.legacyRetryReason,
        };
      }
    }
    const e2eCfg = e2e ? e2eFakeOpenAiConfig() : null;
    return {
      executable: domainExecutable, providerCalled: false, executionAvailable,
      briefRevision: brief.revision, briefArtifactId: brief.artifactId,
      marketingPlanRevision: plan.revision, marketingPlanArtifactId: plan.artifactId,
      creativeConceptRevision: concept.revision, creativeConceptArtifactId: concept.artifactId,
      videoScriptRevision: script.revision, videoScriptArtifactId: script.artifactId,
      model: e2eCfg?.model ?? ai.model,
      reasoningEffort: e2eCfg?.reasoningEffort ?? ai.reasoningEffort,
      maxOutputTokens: e2eCfg?.maxOutputTokens ?? ai.maxOutputTokens,
      promptVersion: ai.promptVersion, schemaVersion: ai.schemaVersion,
      pricingConfigured: e2e ? true : ai.pricingConfigured, estimatedCostMinor: estimated, currency: price?.currency,
      validations: ai.validations, warnings: ai.warnings,
      missingInformation,
      existingVisualDirection,
      retryCandidate,
    };
  }

  function artKeyAndFingerprint(args: {
    projectId: string;
    brief: { artifactId: string; revision: number };
    plan: { artifactId: string; revision: number };
    concept: { artifactId: string; revision: number };
    script: { artifactId: string; revision: number };
    model: string;
    character: Extract<CharacterResolution, { status: "ok" }>;
  }) {
    const fields = [
      args.projectId, args.brief.artifactId, String(args.brief.revision),
      args.plan.artifactId, String(args.plan.revision),
      args.concept.artifactId, String(args.concept.revision),
      args.script.artifactId, String(args.script.revision),
      args.model, ART_ANALYZER_PROMPT_VERSION, ART_CANDIDATE_SCHEMA_VERSION,
      ...(args.character.identityFingerprint && args.character.snapshot
        ? [args.character.snapshot.characterId, args.character.snapshot.snapshotVersion, args.character.identityFingerprint]
        : []),
    ];
    const raw = ["art", ...fields].join(":");
    return {
      key: raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex"),
      fingerprint: createHash("sha256").update(fields.join("|")).digest("hex"),
    };
  }

  async function finishArtExecute(args: {
    directorRunId: string;
    runRevision: number;
    attemptNumber: number;
    projectId: string;
    brief: { value: VideoProjectBrief; artifactId: string; revision: number };
    plan: { value: unknown; artifactId: string; revision: number };
    concept: { value: unknown; artifactId: string; revision: number };
    script: { value: unknown; artifactId: string; revision: number };
    character: Extract<CharacterResolution, { status: "ok" }>;
    estimated: number;
    currency: string;
    e2e: boolean;
    pricingConfigured: boolean;
    context: DirectorRunContext;
  }): Promise<ArtProjectResult> {
    const {
      directorRunId: runId, runRevision, attemptNumber, projectId,
      brief, plan, concept, script, character, estimated, currency, e2e, pricingConfigured, context,
    } = args;
    const reservationId = id();
    try {
      await deps.directorRuns.reserveBudget({
        reservationId, workspaceId: deps.workspaceId, projectId, directorRunId: runId,
        attemptId: `art-${attemptNumber}`, amountMinor: estimated, currency,
        correlationId: context.correlationId, ledgerIdempotencyKey: `dir-reserve-${runId}`,
      });
    } catch {
      await deps.directorRuns.failRun({
        directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: runRevision,
        errorCode: "budget_exceeded", status: "failed", correlationId: context.correlationId,
      }).catch(() => undefined);
      return failed("budget_exceeded", ART_FAILURE_PUBLIC_MESSAGES.budget_exceeded, 402, { directorRunId: runId });
    }
    const run = await createArtDirector({ analyzer: deps.analyzer }).run(
      {
        brief: character.brief,
        marketingPlan: plan.value as never,
        creativeConcept: concept.value as never,
        videoScript: script.value as never,
        characterCapabilities: character.snapshot,
      },
      { ...context, mode: "execute", planId: id(), createdBy: "shared-password-user" },
    );
    const meteringUsage = meteringUsageRecord(run.metering);
    const meteringKnownCost = meteringKnownCostMinor(run.metering);
    const failMetering = {
      usage: meteringUsage,
      actualCostMinor: meteringKnownCost,
      costStatus: meteringCostStatusForFail(run.metering),
    };
    if (run.status === "needs_input") {
      await deps.directorRuns.failRun({
        directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: runRevision + 1,
        errorCode: "needs_input", status: "needs_input", reservationId, correlationId: context.correlationId, ...failMetering,
      });
      return { status: "needs_input", missingInformation: run.missingInformation, warnings: run.warnings, directorRunId: runId };
    }
    if (run.status === "provider_failed") {
      const failure = withArtPublicMessage(run.failure);
      await deps.directorRuns.failRun({
        directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: runRevision + 1,
        errorCode: failure.code, status: "failed", reservationId, correlationId: context.correlationId, ...failMetering,
      });
      const mapped = httpStatusForMarketingFailure(failure.code);
      return failed(failure.code, failure.publicMessage, mapped === 202 ? 500 : mapped, {
        retryable: failure.retryable, retryAfterSeconds: failure.retryAfterSeconds,
        provider: failure.provider, directorRunId: runId,
      });
    }
    if (run.status === "invalid") {
      await deps.directorRuns.failRun({
        directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: runRevision + 1,
        errorCode: "invalid_candidate", status: "failed", reservationId, correlationId: context.correlationId, ...failMetering,
      });
      return failed("invalid_candidate", run.errors[0]?.message ?? ART_FAILURE_PUBLIC_MESSAGES.invalid_candidate, 422, { directorRunId: runId });
    }
    try {
      const actualCostMinor = meteringKnownCost ?? estimated;
      const persisted = await deps.directorRuns.persistVisualDirection({
        workspaceId: deps.workspaceId, projectId, directorRunId: runId, artifactId: run.visualDirection.id,
        videoScriptArtifactId: script.artifactId, videoScriptRevision: script.revision,
        creativeConceptArtifactId: concept.artifactId, creativeConceptRevision: concept.revision,
        marketingPlanArtifactId: plan.artifactId, marketingPlanRevision: plan.revision,
        briefArtifactId: brief.artifactId, briefRevision: brief.revision,
        visualDirection: run.visualDirection as unknown as Record<string, unknown>,
        schemaVersion: VISUAL_DIRECTION_SCHEMA_VERSION, correlationId: context.correlationId,
        reservationId, actualCostMinor,
        costStatus: e2e || pricingConfigured || meteringKnownCost != null ? "committed" : "provisional",
        usage: meteringUsage,
        expectedRunRevision: runRevision + 1, ledgerIdempotencyKey: `dir-commit-${runId}`,
      });
      return {
        status: persisted.status === "existing" ? "existing" : "completed",
        visualDirection: view(run.visualDirection, persisted.revision, run.warnings),
        directorRunId: runId,
      };
    } catch {
      await deps.directorRuns.failRun({
        directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: runRevision + 1,
        errorCode: "persist_failed", status: "failed", reservationId, correlationId: context.correlationId,
      }).catch(() => undefined);
      return failed("persist_failed", "La persistance de la direction art a échoué.", 503, { directorRunId: runId });
    }
  }

  return {
    dryRun: async (input) => dry(input),
    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      const e2e = isDirectorE2eFakeMode(env);
      if (!e2e && !canExecuteArtAi(env)) return failed("art_ai_disabled", "Direction Art IA désactivée.", 503);
      let config;
      if (e2e) { config = e2eFakeOpenAiConfig(); }
      else {
        try { config = parseOpenAIArtConfig(env); } catch { return failed("invalid_config", "Configuration Art IA invalide.", 503); }
        if (!config.apiKeyPresent) return failed("openai_not_configured", "OpenAI n'est pas configuré.", 503);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) return failed("not_found", "Projet introuvable.", 400);
      const [brief, plan, concept, script] = await sources(input.projectId);
      if (!brief) return failed("brief_missing", "Brief actif introuvable.", 422);
      if (!plan) return failed("marketing_plan_missing", "Marketing Plan actif introuvable.", 422);
      if (!concept) return failed("creative_concept_missing", "Creative Concept actif introuvable.", 422);
      if (!script) return failed("video_script_missing", "Script actif introuvable.", 422);
      if (input.expectedVideoScriptRevision != null && input.expectedVideoScriptRevision !== script.revision) return failed("video_script_revision_conflict", "Le Script a changé depuis la vérification.", 409);
      if (input.expectedCreativeConceptRevision != null && input.expectedCreativeConceptRevision !== concept.revision) return failed("creative_concept_revision_conflict", "Le Creative Concept a changé depuis la vérification.", 409);
      if (input.expectedMarketingPlanRevision != null && input.expectedMarketingPlanRevision !== plan.revision) return failed("marketing_plan_revision_conflict", "Le Marketing Plan a changé depuis la vérification.", 409);
      const character = resolveArtCharacter(brief.value, deps.characterLookup);
      if (character.status === "error") {
        return {
          status: "needs_input",
          missingInformation: [{ code: character.code, message: character.message, field: character.field }],
          warnings: [],
        };
      }
      const check = await dry(input);
      if (!check.executable) return { status: "needs_input", missingInformation: check.missingInformation, warnings: check.warnings };
      const estimated = Math.max(1, check.estimatedCostMinor ?? 1), currency = check.currency ?? "USD";
      const { key, fingerprint } = artKeyAndFingerprint({
        projectId: input.projectId, brief, plan, concept, script, model: config.model, character,
      });
      const begin = await deps.directorRuns.beginOrGet({
        id: id(), workspaceId: deps.workspaceId, projectId: input.projectId,
        videoScriptArtifactId: script.artifactId, videoScriptRevision: script.revision,
        creativeConceptArtifactId: concept.artifactId, creativeConceptRevision: concept.revision,
        marketingPlanArtifactId: plan.artifactId, marketingPlanRevision: plan.revision,
        briefArtifactId: brief.artifactId, briefRevision: brief.revision,
        modelId: config.model, promptVersion: ART_ANALYZER_PROMPT_VERSION, schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
        idempotencyKey: key, commandFingerprint: fingerprint, correlationId: context.correlationId,
        estimatedCostMinor: estimated, currency,
      });
      if (begin.status === "already_running") {
        return { status: "already_running", directorRunId: begin.directorRunId, publicMessage: ART_FAILURE_PUBLIC_MESSAGES.run_in_progress };
      }
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        const prior = artifact && stored(artifact.value, artifact.revision);
        if (prior) return { status: "existing", visualDirection: prior, directorRunId: begin.directorRunId };
      }
      return finishArtExecute({
        directorRunId: begin.directorRunId, runRevision: begin.revision, attemptNumber: 1,
        projectId: input.projectId, brief, plan, concept, script, character,
        estimated, currency, e2e, pricingConfigured: check.pricingConfigured, context,
      });
    },

    async executeRetry(input, context) {
      if (!canUseDirectorV2Persistence(env)) return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      const e2e = isDirectorE2eFakeMode(env);
      if (!e2e && !canExecuteArtAi(env)) return failed("art_ai_disabled", "Direction Art IA désactivée.", 503);
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(input.retryRequestId)) return failed("invalid_retry_request", "Demande de retry invalide.", 400);
      if (!uuidRe.test(input.previousRunId)) return failed("invalid_previous_run", "Run précédent invalide.", 400);
      let config;
      if (e2e) { config = e2eFakeOpenAiConfig(); }
      else {
        try { config = parseOpenAIArtConfig(env); } catch { return failed("invalid_config", "Configuration Art IA invalide.", 503); }
        if (!config.apiKeyPresent) return failed("openai_not_configured", "OpenAI n'est pas configuré.", 503);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) return failed("not_found", "Projet introuvable.", 400);
      const [brief, plan, concept, script] = await sources(input.projectId);
      if (!brief) return failed("brief_missing", "Brief actif introuvable.", 422);
      if (!plan) return failed("marketing_plan_missing", "Marketing Plan actif introuvable.", 422);
      if (!concept) return failed("creative_concept_missing", "Creative Concept actif introuvable.", 422);
      if (!script) return failed("video_script_missing", "Script actif introuvable.", 422);
      if (input.expectedVideoScriptRevision !== script.revision) {
        return failed("video_script_revision_conflict", "Le Script a changé depuis la vérification.", 409);
      }
      if (input.expectedCreativeConceptRevision != null && input.expectedCreativeConceptRevision !== concept.revision) {
        return failed("creative_concept_revision_conflict", "Le Creative Concept a changé depuis la vérification.", 409);
      }
      if (input.expectedMarketingPlanRevision != null && input.expectedMarketingPlanRevision !== plan.revision) {
        return failed("marketing_plan_revision_conflict", "Le Marketing Plan a changé depuis la vérification.", 409);
      }
      const character = resolveArtCharacter(brief.value, deps.characterLookup);
      if (character.status === "error") {
        return {
          status: "needs_input",
          missingInformation: [{ code: character.code, message: character.message, field: character.field }],
          warnings: [],
        };
      }
      const check = await dry({ projectId: input.projectId });
      if (!check.executable) return { status: "needs_input", missingInformation: check.missingInformation, warnings: check.warnings };
      if (!e2e && !check.pricingConfigured) {
        try {
          const cfg = parseOpenAIArtConfig(env);
          if (cfg.requireFirmPricing) {
            return failed("pricing_unknown", "Tarification indisponible pour un appel payant.", 402);
          }
        } catch {
          return failed("invalid_config", "Configuration Art IA invalide.", 503);
        }
      }
      const estimated = Math.max(1, check.estimatedCostMinor ?? 1), currency = check.currency ?? "USD";
      const { fingerprint } = artKeyAndFingerprint({
        projectId: input.projectId, brief, plan, concept, script, model: config.model, character,
      });
      let begin;
      try {
        begin = await deps.directorRuns.beginOrRetry({
          id: id(),
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          previousRunId: input.previousRunId,
          retryRequestId: input.retryRequestId,
          inputArtifactId: script.artifactId,
          inputRevision: script.revision,
          modelId: config.model,
          promptVersion: ART_ANALYZER_PROMPT_VERSION,
          schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
          commandFingerprint: fingerprint,
          correlationId: context.correlationId,
          estimatedCostMinor: estimated,
          currency,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/retry_not_allowed|retry_reservation_active|retry_config_mismatch/i.test(msg)) {
          return failed("retry_not_allowed", ART_FAILURE_PUBLIC_MESSAGES.retry_not_allowed, 422);
        }
        if (/retry_superseded|retry_conflict/i.test(msg)) {
          return failed("retry_conflict", ART_FAILURE_PUBLIC_MESSAGES.retry_conflict, 409);
        }
        if (/brief_revision|video_script_revision|creative_concept_revision|marketing_plan_revision/i.test(msg)) {
          return failed("video_script_revision_conflict", "Les prérequis actifs ont changé.", 409);
        }
        if (/fingerprint/i.test(msg)) {
          return failed("idempotency_conflict", ART_FAILURE_PUBLIC_MESSAGES.idempotency_conflict, 409);
        }
        return failed("director_run_failed", "Impossible de démarrer le retry art.", 503);
      }

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: ART_FAILURE_PUBLIC_MESSAGES.run_in_progress,
        };
      }

      if (
        begin.status === "created" &&
        begin.legacyRetryReason === LEGACY_ART_TIMEOUT_RETRY_REASON
      ) {
        logger.info(
          "director.art.retry.legacy_timeout",
          createLogContext(context.correlationId, {
            projectId: input.projectId,
            operation: "director.art.retry",
          }),
          {
            legacy_retry_reason: LEGACY_ART_TIMEOUT_RETRY_REASON,
            previousRunId: input.previousRunId,
            directorRunId: begin.directorRunId,
            attemptNumber: begin.attemptNumber,
            retryOfRunId: begin.retryOfRunId,
          }
        );
      }

      if (begin.status === "created") {
        const existingVd = await deps.directorRuns.loadActiveVisualDirection(input.projectId);
        if (existingVd) {
          await deps.directorRuns.failRun({
            directorRunId: begin.directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: "retry_not_allowed",
            status: "failed",
            correlationId: context.correlationId,
          }).catch(() => undefined);
          return failed("retry_not_allowed", ART_FAILURE_PUBLIC_MESSAGES.retry_not_allowed, 422, {
            directorRunId: begin.directorRunId,
          });
        }
      }

      if (begin.status === "terminal_replay") {
        if (begin.outputArtifactId) {
          const artifact = await deps.artifacts.load(begin.outputArtifactId);
          const prior = artifact && stored(artifact.value, artifact.revision);
          if (prior) {
            return { status: "existing", visualDirection: prior, directorRunId: begin.directorRunId };
          }
        }
        const code = begin.errorCode ?? "request_failed";
        const replayableCodes: readonly string[] = [
          "rate_limited", "timeout", "provider_unavailable", "request_failed",
          "invalid_candidate", "invalid_structured_output", "quota_exceeded",
        ];
        const canonical: MarketingAnalysisFailureCode = replayableCodes.includes(code)
          ? (code as MarketingAnalysisFailureCode)
          : "request_failed";
        const taxonomy = artFailure(canonical);
        const httpHint = httpStatusForMarketingFailure(canonical);
        return failed(canonical, taxonomy.publicMessage, httpHint === 202 ? 500 : httpHint, {
          retryable: taxonomy.retryable,
          directorRunId: begin.directorRunId,
        });
      }

      if (begin.status === "existing") {
        const artifact = begin.outputArtifactId
          ? await deps.artifacts.load(begin.outputArtifactId)
          : null;
        const prior = artifact && stored(artifact.value, artifact.revision);
        if (prior) {
          return { status: "existing", visualDirection: prior, directorRunId: begin.directorRunId };
        }
        return failed("retry_conflict", ART_FAILURE_PUBLIC_MESSAGES.retry_conflict, 409, {
          directorRunId: begin.directorRunId,
        });
      }

      return finishArtExecute({
        directorRunId: begin.directorRunId,
        runRevision: begin.revision,
        attemptNumber: begin.attemptNumber,
        projectId: input.projectId,
        brief, plan, concept, script, character,
        estimated, currency, e2e, pricingConfigured: check.pricingConfigured, context,
      });
    },
  };
}
