/**
 * VHS-119B persisted Script Writer. Sources are exclusively active server artifacts.
 */
import { createHash, randomUUID } from "node:crypto";
import { VideoProjectBriefSchema } from "@/domain/brief";
import { CreativeConceptSchema } from "@/domain/creative";
import { MarketingPlanSchema } from "@/domain/marketing";
import { SPEECH_TIMING_ENGINE_VERSION, VIDEO_SCRIPT_SCHEMA_VERSION, VideoScriptSchema, type VideoScript } from "@/domain/script";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import { canExecuteScriptAi, canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import {
  e2eFakeOpenAiConfig,
  isDirectorE2eFakeMode,
  textDirectorExecutionAvailable,
} from "@/infrastructure/e2e/e2e-text-director-gate";
import { DEFAULT_OPENAI_SCRIPT_MODEL, parseOpenAIScriptConfig } from "@/infrastructure/ai/openai/config";
import { runOpenAIScriptDryRun, SCRIPT_ANALYZER_PROMPT_VERSION, SCRIPT_CANDIDATE_SCHEMA_VERSION } from "@/infrastructure/ai/openai/script";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import { httpStatusForMarketingFailure } from "@/application/directors/marketing/failures";
import {
  meteringCostStatusForFail,
  meteringKnownCostMinor,
  meteringUsageRecord,
} from "@/application/directors/shared/analyzer-metering";
import { createScriptWriter } from "./script-writer";
import type { ScriptAnalyzerPort } from "./analyzer-port";
import type { DirectorRunContext } from "./result";

type Warning = { code: string; message: string };
export type VideoScriptView = { revision: number; status: "ready" | "absent"; title?: string; summary?: string; hook?: string; segments?: Array<{ purpose: string; text: string }>; cta?: string; targetDuration?: number; calculatedDuration?: number; toleranceStatus?: string; warnings: Warning[] };
export type ScriptProjectInput = { projectId: string; expectedCreativeConceptRevision?: number; expectedMarketingPlanRevision?: number };
export type ScriptProjectDryRunResult = { executable: boolean; providerCalled: false; executionAvailable: boolean; briefRevision: number; briefArtifactId: string; marketingPlanRevision: number; marketingPlanArtifactId: string; creativeConceptRevision: number; creativeConceptArtifactId: string; model: string; promptVersion: string; schemaVersion: string; timingEngineVersion: typeof SPEECH_TIMING_ENGINE_VERSION; pricingConfigured: boolean; estimatedCostMinor?: number; currency?: string; validations: Array<{code:string;passed:boolean;message:string}>; warnings: Warning[]; missingInformation: Array<{code:string;message:string;field?:string}>; targetDuration?: number; estimatedDuration?: number; toleranceStatus?: string; existingScript?: VideoScriptView };
export type ScriptProjectResult =
  | { status: "completed" | "existing"; script: VideoScriptView; directorRunId: string }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | { status: "needs_input"; missingInformation: Array<{code:string;message:string;field?:string}>; warnings: Warning[]; directorRunId?: string }
  | { status: "failed"; code: string; publicMessage: string; retryable: boolean; httpHint: 400|402|409|422|429|500|502|503|504; retryAfterSeconds?: number; provider?: "openai"; directorRunId?: string };

export type ScriptDirectorRunPort = {
  beginOrGet(input: { id:string;workspaceId:string;projectId:string;creativeConceptArtifactId:string;creativeConceptRevision:number;marketingPlanArtifactId:string;marketingPlanRevision:number;briefArtifactId:string;briefRevision:number;modelId:string;promptVersion:string;schemaVersion:string;idempotencyKey:string;commandFingerprint:string;correlationId:string;estimatedCostMinor?:number;currency?:string }): Promise<{status:"created";directorRunId:string;revision:number}|{status:"existing";directorRunId:string;revision:number;outputArtifactId:string}|{status:"already_running";directorRunId:string;revision:number}>;
  reserveBudget(input: {reservationId:string;workspaceId:string;projectId:string;directorRunId:string;attemptId:string;amountMinor:number;currency:string;correlationId:string;ledgerIdempotencyKey:string}): Promise<void>;
  persistScript(input: {workspaceId:string;projectId:string;directorRunId:string;artifactId:string;creativeConceptArtifactId:string;creativeConceptRevision:number;marketingPlanArtifactId:string;marketingPlanRevision:number;briefArtifactId:string;briefRevision:number;script:Record<string,unknown>;schemaVersion:string;correlationId:string;reservationId?:string;actualCostMinor?:number;costStatus:string;usage?:Record<string,unknown>;expectedRunRevision:number;ledgerIdempotencyKey?:string}): Promise<{status:"created"|"existing";artifactId:string;revision:number}>;
  failRun(input: {directorRunId:string;workspaceId:string;expectedRevision:number;errorCode:string;status:"failed"|"needs_input"|"cancelled";reservationId?:string;correlationId:string;usage?:Record<string,unknown>;actualCostMinor?:number;costStatus?:string}): Promise<void>;
  loadActiveVideoScript(projectId:string): Promise<{revision:number;value:unknown}|null>;
};
export type WriteScriptForProjectDeps = { workspaceId:string; projects:ProjectRepository; artifacts:ArtifactRepository; directorRuns:ScriptDirectorRunPort; analyzer:ScriptAnalyzerPort; pricing?:AiTokenPricingPort; env?:Record<string,string|undefined>; idFactory?:()=>string };
export type WriteScriptForProject = { dryRun(input:ScriptProjectInput, context:DirectorRunContext):Promise<ScriptProjectDryRunResult>; execute(input:ScriptProjectInput, context:DirectorRunContext):Promise<ScriptProjectResult> };

function view(script: VideoScript, revision: number, warnings: Warning[] = []): VideoScriptView {
  return { revision, status:"ready", title:script.title, summary:script.summary, hook:script.hook.text, segments:script.segments.map(s=>({purpose:s.purpose,text:s.dialogue ?? s.voiceOver ?? s.screenText ?? ""})), cta:script.callToAction.text, targetDuration:script.timing.targetDurationSeconds, calculatedDuration:script.timing.estimatedTotalSeconds, toleranceStatus:script.timing.status, warnings };
}
function stored(value:unknown, revision:number) { const parsed=VideoScriptSchema.safeParse(value); return parsed.success ? view(parsed.data,revision) : undefined; }
async function active<T>(artifacts:ArtifactRepository, projectId:string, type:"video_project_brief"|"marketing_plan"|"creative_concept", schema:{safeParse(value:unknown):{success:true;data:T}|{success:false}}) { const current=await artifacts.getActive(projectId,type); if(!current)return null; const item=await artifacts.load(current.artifactId); if(!item)return null; const parsed=schema.safeParse(item.value); return parsed.success?{value:parsed.data,artifactId:current.artifactId,revision:current.revision}:null; }
function failed(code:string, publicMessage:string, httpHint:ScriptProjectResult extends infer T ? T extends {httpHint:infer H}?H:never : never, extra:Partial<Extract<ScriptProjectResult,{status:"failed"}>>={}) { return {status:"failed" as const,code,publicMessage,httpHint,retryable:false,...extra}; }
function empty(partial:Partial<ScriptProjectDryRunResult>&Pick<ScriptProjectDryRunResult,"validations"|"missingInformation">):ScriptProjectDryRunResult { return {executable:false,providerCalled:false,executionAvailable:false,briefRevision:0,briefArtifactId:"",marketingPlanRevision:0,marketingPlanArtifactId:"",creativeConceptRevision:0,creativeConceptArtifactId:"",model:DEFAULT_OPENAI_SCRIPT_MODEL,promptVersion:SCRIPT_ANALYZER_PROMPT_VERSION,schemaVersion:SCRIPT_CANDIDATE_SCHEMA_VERSION,timingEngineVersion:SPEECH_TIMING_ENGINE_VERSION,pricingConfigured:false,warnings:[],...partial}; }

export function createWriteScriptForProject(deps:WriteScriptForProjectDeps):WriteScriptForProject {
  const env=deps.env??(process.env as Record<string,string|undefined>), id=deps.idFactory??randomUUID;
  async function sources(projectId:string) { return Promise.all([active(deps.artifacts,projectId,"video_project_brief",VideoProjectBriefSchema),active(deps.artifacts,projectId,"marketing_plan",MarketingPlanSchema),active(deps.artifacts,projectId,"creative_concept",CreativeConceptSchema)]); }
  async function dry(input:ScriptProjectInput):Promise<ScriptProjectDryRunResult> {
    if(!canUseDirectorV2Persistence(env)) return empty({validations:[{code:"persistence",passed:false,message:"Persistance Director désactivée."}],missingInformation:[]});
    const project=await deps.projects.load(input.projectId); if(!project||project.workspaceId!==deps.workspaceId)return empty({validations:[{code:"project",passed:false,message:"Projet introuvable."}],missingInformation:[{code:"project_missing",message:"Projet introuvable."}]});
    const [brief,plan,concept]=await sources(input.projectId);
    if(!brief||!plan||!concept) { const missing=!brief?"brief":!plan?"marketing_plan":"creative_concept"; return empty({briefRevision:brief?.revision??0,briefArtifactId:brief?.artifactId??"",marketingPlanRevision:plan?.revision??0,marketingPlanArtifactId:plan?.artifactId??"",creativeConceptRevision:concept?.revision??0,creativeConceptArtifactId:concept?.artifactId??"",validations:[{code:missing,passed:false,message:`${missing==="brief"?"Brief":missing==="marketing_plan"?"Marketing Plan":"Creative Concept"} actif introuvable.`}],missingInformation:[{code:`${missing}_missing`,message:"Pré-requis actif introuvable."}]}); }
    const ai=runOpenAIScriptDryRun(brief.value,plan.value,concept.value,{env,pricing:deps.pricing}); const existing=await deps.directorRuns.loadActiveVideoScript(input.projectId);
    const price=deps.pricing?.getPriceBook(ai.model); const estimated=price?Math.floor(((ai.approximateInputTokens??0)*price.inputPerMillionMinor)/1_000_000)+Math.floor((ai.maxOutputTokens*price.outputPerMillionMinor)/1_000_000):undefined;
    const e2e=isDirectorE2eFakeMode(env); const domainExecutable=e2e?true:ai.executable;
    return {executable:domainExecutable,providerCalled:false,executionAvailable:textDirectorExecutionAvailable({env,domainExecutable,paidPathAvailable:canExecuteScriptAi(env),pricingConfigured:ai.pricingConfigured}),briefRevision:brief.revision,briefArtifactId:brief.artifactId,marketingPlanRevision:plan.revision,marketingPlanArtifactId:plan.artifactId,creativeConceptRevision:concept.revision,creativeConceptArtifactId:concept.artifactId,model:e2e?e2eFakeOpenAiConfig().model:ai.model,promptVersion:ai.promptVersion,schemaVersion:ai.schemaVersion,timingEngineVersion:SPEECH_TIMING_ENGINE_VERSION,pricingConfigured:e2e?true:ai.pricingConfigured,estimatedCostMinor:estimated,currency:price?.currency,validations:ai.validations,warnings:ai.warnings,missingInformation:ai.validations.filter(v=>!v.passed).map(v=>({code:v.code,message:v.message})),targetDuration:brief.value.durationSeconds,existingScript:existing?stored(existing.value,existing.revision):undefined};
  }
  return { dryRun: async(input)=>dry(input), async execute(input,context) {
    if(!canUseDirectorV2Persistence(env))return failed("persistence_disabled","Persistance Director désactivée.",503);
    const e2e=isDirectorE2eFakeMode(env);
    if(!e2e&&!canExecuteScriptAi(env))return failed("script_ai_disabled","Rédaction Script IA désactivée.",503);
    let config; if(e2e){config=e2eFakeOpenAiConfig()} else { try{config=parseOpenAIScriptConfig(env)}catch{return failed("invalid_config","Configuration Script IA invalide.",503)} if(!config.apiKeyPresent)return failed("openai_not_configured","OpenAI n’est pas configuré.",503); }
    const project=await deps.projects.load(input.projectId);if(!project||project.workspaceId!==deps.workspaceId)return failed("not_found","Projet introuvable.",400);
    const [brief,plan,concept]=await sources(input.projectId);if(!brief)return failed("brief_missing","Brief actif introuvable.",422);if(!plan)return failed("marketing_plan_missing","Marketing Plan actif introuvable.",422);if(!concept)return failed("creative_concept_missing","Creative Concept actif introuvable.",422);
    if(input.expectedCreativeConceptRevision!=null&&input.expectedCreativeConceptRevision!==concept.revision)return failed("creative_concept_revision_conflict","Le Creative Concept a changé depuis la vérification.",409);
    if(input.expectedMarketingPlanRevision!=null&&input.expectedMarketingPlanRevision!==plan.revision)return failed("marketing_plan_revision_conflict","Le Marketing Plan a changé depuis la vérification.",409);
    const check=await dry(input);if(!check.executable)return {status:"needs_input",missingInformation:check.missingInformation,warnings:check.warnings};
    const estimated=Math.max(1,check.estimatedCostMinor??1), currency=check.currency??"USD";
    const fields=[input.projectId,brief.artifactId,String(brief.revision),plan.artifactId,String(plan.revision),concept.artifactId,String(concept.revision),config.model,SCRIPT_ANALYZER_PROMPT_VERSION,SCRIPT_CANDIDATE_SCHEMA_VERSION,SPEECH_TIMING_ENGINE_VERSION];
    const raw=["scr",...fields].join(":"); const key=raw.length<=200?raw:createHash("sha256").update(raw).digest("hex"); const fingerprint=createHash("sha256").update(fields.join("|")).digest("hex");
    const begin=await deps.directorRuns.beginOrGet({id:id(),workspaceId:deps.workspaceId,projectId:input.projectId,creativeConceptArtifactId:concept.artifactId,creativeConceptRevision:concept.revision,marketingPlanArtifactId:plan.artifactId,marketingPlanRevision:plan.revision,briefArtifactId:brief.artifactId,briefRevision:brief.revision,modelId:config.model,promptVersion:SCRIPT_ANALYZER_PROMPT_VERSION,schemaVersion:SCRIPT_CANDIDATE_SCHEMA_VERSION,idempotencyKey:key,commandFingerprint:fingerprint,correlationId:context.correlationId,estimatedCostMinor:estimated,currency});
    if(begin.status==="already_running")return {status:"already_running",directorRunId:begin.directorRunId,publicMessage:"Une rédaction de script est déjà en cours."};
    if(begin.status==="existing"){const artifact=await deps.artifacts.load(begin.outputArtifactId);const prior=artifact&&stored(artifact.value,artifact.revision);if(prior)return {status:"existing",script:prior,directorRunId:begin.directorRunId};}
    const runId=begin.directorRunId,reservationId=id();
    try{
      await deps.directorRuns.reserveBudget({reservationId,workspaceId:deps.workspaceId,projectId:input.projectId,directorRunId:runId,attemptId:"script-1",amountMinor:estimated,currency,correlationId:context.correlationId,ledgerIdempotencyKey:`dir-reserve-${runId}`});
    }catch{
      await deps.directorRuns.failRun({directorRunId:runId,workspaceId:deps.workspaceId,expectedRevision:begin.revision,errorCode:"budget_exceeded",status:"failed",correlationId:context.correlationId}).catch(()=>undefined);
      return failed("budget_exceeded","Réservation budget impossible.",402,{directorRunId:runId});
    }
    const run=await createScriptWriter({analyzer:deps.analyzer}).run({brief:brief.value,marketingPlan:plan.value,creativeConcept:concept.value},{...context,mode:"execute",planId:id(),createdBy:"shared-password-user"});
    const meteringUsage=meteringUsageRecord(run.metering);
    const meteringKnownCost=meteringKnownCostMinor(run.metering);
    const failMetering={usage:meteringUsage,actualCostMinor:meteringKnownCost,costStatus:meteringCostStatusForFail(run.metering)};
    if(run.status==="needs_input"){await deps.directorRuns.failRun({directorRunId:runId,workspaceId:deps.workspaceId,expectedRevision:begin.revision+1,errorCode:"needs_input",status:"needs_input",reservationId,correlationId:context.correlationId,...failMetering});return {status:"needs_input",missingInformation:run.missingInformation,warnings:run.warnings,directorRunId:runId};}
    if(run.status==="provider_failed"){
      await deps.directorRuns.failRun({directorRunId:runId,workspaceId:deps.workspaceId,expectedRevision:begin.revision+1,errorCode:run.failure.code,status:"failed",reservationId,correlationId:context.correlationId,...failMetering});
      const mapped=httpStatusForMarketingFailure(run.failure.code);
      return failed(run.failure.code,run.failure.publicMessage,mapped===202?500:mapped,{retryable:run.failure.retryable,retryAfterSeconds:run.failure.retryAfterSeconds,provider:run.failure.provider,directorRunId:runId});
    }
    if(run.status==="invalid"){await deps.directorRuns.failRun({directorRunId:runId,workspaceId:deps.workspaceId,expectedRevision:begin.revision+1,errorCode:"invalid_candidate",status:"failed",reservationId,correlationId:context.correlationId,...failMetering});return failed("invalid_candidate",run.errors[0]?.message??"Script invalide.",422,{directorRunId:runId});}
    try{const actualCostMinor=meteringKnownCost??estimated;const persisted=await deps.directorRuns.persistScript({workspaceId:deps.workspaceId,projectId:input.projectId,directorRunId:runId,artifactId:run.script.id,creativeConceptArtifactId:concept.artifactId,creativeConceptRevision:concept.revision,marketingPlanArtifactId:plan.artifactId,marketingPlanRevision:plan.revision,briefArtifactId:brief.artifactId,briefRevision:brief.revision,script:run.script as unknown as Record<string,unknown>,schemaVersion:VIDEO_SCRIPT_SCHEMA_VERSION,correlationId:context.correlationId,reservationId,actualCostMinor,costStatus:e2e||check.pricingConfigured||meteringKnownCost!=null?"committed":"provisional",usage:meteringUsage,expectedRunRevision:begin.revision+1,ledgerIdempotencyKey:`dir-commit-${runId}`});return {status:persisted.status==="existing"?"existing":"completed",script:view(run.script,persisted.revision,run.warnings),directorRunId:runId};}catch{await deps.directorRuns.failRun({directorRunId:runId,workspaceId:deps.workspaceId,expectedRevision:begin.revision+1,errorCode:"persist_failed",status:"failed",reservationId,correlationId:context.correlationId}).catch(()=>undefined);return failed("persist_failed","La persistance du script a échoué.",503,{directorRunId:runId});}
  }};
}
