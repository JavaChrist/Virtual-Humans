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
import { httpStatusForMarketingFailure } from "@/application/directors/marketing/failures";
import {
  meteringCostStatusForFail,
  meteringKnownCostMinor,
  meteringUsageRecord,
} from "@/application/directors/shared/analyzer-metering";
import {
  resolveCharacterCapabilitiesForBrief,
  type CharacterPackageLookup,
} from "@/application/runtime/resolve-character-capabilities";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CharacterCapabilitiesSnapshot } from "@/domain/art";
import { createArtDirector } from "./art-director";
import type { ArtAnalyzerPort } from "./analyzer-port";
import type { DirectorRunContext } from "./result";

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
  promptVersion: string;
  schemaVersion: string;
  pricingConfigured: boolean;
  estimatedCostMinor?: number;
  currency?: string;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Warning[];
  missingInformation: Array<{ code: string; message: string; field?: string }>;
  existingVisualDirection?: VisualDirectionView;
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
};
export type AnalyzeArtForProjectDeps = {
  workspaceId: string; projects: ProjectRepository; artifacts: ArtifactRepository;
  directorRuns: ArtDirectorRunPort; analyzer: ArtAnalyzerPort;
  pricing?: AiTokenPricingPort; env?: Record<string, string | undefined>; idFactory?: () => string;
  /** Optional CharacterRegistry override (tests). Default: Runtime characterRegistry. */
  characterLookup?: CharacterPackageLookup;
};
export type AnalyzeArtForProject = { dryRun(input: ArtProjectInput, context: DirectorRunContext): Promise<ArtProjectDryRunResult>; execute(input: ArtProjectInput, context: DirectorRunContext): Promise<ArtProjectResult> };

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
    model: DEFAULT_OPENAI_ART_MODEL, promptVersion: ART_ANALYZER_PROMPT_VERSION, schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
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
        model: DEFAULT_OPENAI_ART_MODEL, promptVersion: ART_ANALYZER_PROMPT_VERSION, schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
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
    const price = deps.pricing?.getPriceBook(ai.model);
    const estimated = price ? Math.floor(((ai.approximateInputTokens ?? 0) * price.inputPerMillionMinor) / 1_000_000) + Math.floor((ai.maxOutputTokens * price.outputPerMillionMinor) / 1_000_000) : undefined;
    const e2e = isDirectorE2eFakeMode(env);
    const domainExecutable = e2e ? true : ai.executable;
    const missingFromValidations = ai.validations.filter((v) => !v.passed).map((v) => ({ code: v.code, message: v.message }));
    const missingCodes = new Set(missingFromValidations.map((m) => m.code));
    const missingInformation = [
      ...missingFromValidations,
      ...ai.readinessMissing.filter((m) => !missingCodes.has(m.code)),
    ];
    return {
      executable: domainExecutable, providerCalled: false, executionAvailable: textDirectorExecutionAvailable({
        env, domainExecutable, paidPathAvailable: canExecuteArtAi(env), pricingConfigured: ai.pricingConfigured,
      }),
      briefRevision: brief.revision, briefArtifactId: brief.artifactId,
      marketingPlanRevision: plan.revision, marketingPlanArtifactId: plan.artifactId,
      creativeConceptRevision: concept.revision, creativeConceptArtifactId: concept.artifactId,
      videoScriptRevision: script.revision, videoScriptArtifactId: script.artifactId,
      model: e2e ? e2eFakeOpenAiConfig().model : ai.model, promptVersion: ai.promptVersion, schemaVersion: ai.schemaVersion,
      pricingConfigured: e2e ? true : ai.pricingConfigured, estimatedCostMinor: estimated, currency: price?.currency,
      validations: ai.validations, warnings: ai.warnings,
      missingInformation,
      existingVisualDirection: existing ? stored(existing.value, existing.revision) : undefined,
    };
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
      // Same Character resolution as dry-run (deterministic for identical Brief + registry).
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
      const fields = [
        input.projectId, brief.artifactId, String(brief.revision),
        plan.artifactId, String(plan.revision),
        concept.artifactId, String(concept.revision),
        script.artifactId, String(script.revision),
        config.model, ART_ANALYZER_PROMPT_VERSION, ART_CANDIDATE_SCHEMA_VERSION,
        // Capability identity: new Art key when character assets/version change without Brief rev bump.
        // Omitted when Brief has no character — preserves historical keys for character-less runs.
        ...(character.identityFingerprint && character.snapshot
          ? [character.snapshot.characterId, character.snapshot.snapshotVersion, character.identityFingerprint]
          : []),
      ];
      const raw = ["art", ...fields].join(":");
      const key = raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
      const fingerprint = createHash("sha256").update(fields.join("|")).digest("hex");
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
      if (begin.status === "already_running") return { status: "already_running", directorRunId: begin.directorRunId, publicMessage: "Une direction art est déjà en cours." };
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        const prior = artifact && stored(artifact.value, artifact.revision);
        if (prior) return { status: "existing", visualDirection: prior, directorRunId: begin.directorRunId };
      }
      const runId = begin.directorRunId, reservationId = id();
      try {
        await deps.directorRuns.reserveBudget({ reservationId, workspaceId: deps.workspaceId, projectId: input.projectId, directorRunId: runId, attemptId: "art-1", amountMinor: estimated, currency, correlationId: context.correlationId, ledgerIdempotencyKey: `dir-reserve-${runId}` });
      } catch {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision, errorCode: "budget_exceeded", status: "failed", correlationId: context.correlationId }).catch(() => undefined);
        return failed("budget_exceeded", "Réservation budget impossible.", 402, { directorRunId: runId });
      }
      const run = await createArtDirector({ analyzer: deps.analyzer }).run(
        {
          brief: character.brief,
          marketingPlan: plan.value,
          creativeConcept: concept.value,
          videoScript: script.value,
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
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: "needs_input", status: "needs_input", reservationId, correlationId: context.correlationId, ...failMetering });
        return { status: "needs_input", missingInformation: run.missingInformation, warnings: run.warnings, directorRunId: runId };
      }
      if (run.status === "provider_failed") {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: run.failure.code, status: "failed", reservationId, correlationId: context.correlationId, ...failMetering });
        const mapped = httpStatusForMarketingFailure(run.failure.code);
        return failed(run.failure.code, run.failure.publicMessage, mapped === 202 ? 500 : mapped, { retryable: run.failure.retryable, retryAfterSeconds: run.failure.retryAfterSeconds, provider: run.failure.provider, directorRunId: runId });
      }
      if (run.status === "invalid") {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: "invalid_candidate", status: "failed", reservationId, correlationId: context.correlationId, ...failMetering });
        return failed("invalid_candidate", run.errors[0]?.message ?? "Direction art invalide.", 422, { directorRunId: runId });
      }
      try {
        const actualCostMinor = meteringKnownCost ?? estimated;
        const persisted = await deps.directorRuns.persistVisualDirection({
          workspaceId: deps.workspaceId, projectId: input.projectId, directorRunId: runId, artifactId: run.visualDirection.id,
          videoScriptArtifactId: script.artifactId, videoScriptRevision: script.revision,
          creativeConceptArtifactId: concept.artifactId, creativeConceptRevision: concept.revision,
          marketingPlanArtifactId: plan.artifactId, marketingPlanRevision: plan.revision,
          briefArtifactId: brief.artifactId, briefRevision: brief.revision,
          visualDirection: run.visualDirection as unknown as Record<string, unknown>,
          schemaVersion: VISUAL_DIRECTION_SCHEMA_VERSION, correlationId: context.correlationId,
          reservationId, actualCostMinor, costStatus: e2e || check.pricingConfigured || meteringKnownCost != null ? "committed" : "provisional",
          usage: meteringUsage,
          expectedRunRevision: begin.revision + 1, ledgerIdempotencyKey: `dir-commit-${runId}`,
        });
        return { status: persisted.status === "existing" ? "existing" : "completed", visualDirection: view(run.visualDirection, persisted.revision, run.warnings), directorRunId: runId };
      } catch {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: "persist_failed", status: "failed", reservationId, correlationId: context.correlationId }).catch(() => undefined);
        return failed("persist_failed", "La persistance de la direction art a échoué.", 503, { directorRunId: runId });
      }
    },
  };
}
