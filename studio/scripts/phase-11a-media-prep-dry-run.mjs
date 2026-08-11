/**
 * Phase 11A — local media prep dry-run (NO provider, NO remote write).
 * Loads Production artifacts read-only, builds ScenePackages + GenerationPlan
 * in memory, compares smoke options, never persists.
 *
 * Requires: CONFIRM_PHASE_11A_REMOTE_READ=1
 * Forbids: PHASE_11A_ALLOW_EXECUTE / PAID_GENERATION execute env
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VideoProjectBriefSchema } from "../src/domain/brief/index.ts";
import { MarketingPlanSchema } from "../src/domain/marketing/index.ts";
import { CreativeConceptSchema } from "../src/domain/creative/index.ts";
import { VideoScriptSchema } from "../src/domain/script/index.ts";
import { VisualDirectionSchema } from "../src/domain/art/index.ts";
import { StoryboardProjectSchema } from "../src/domain/storyboard/index.ts";
import { createPromptDirector } from "../src/application/directors/prompt/prompt-director.ts";
import { routeModelPlan } from "../src/domain/routing/router/route-engine.ts";
import { createDefaultRoutingPolicy } from "../src/domain/routing/router/policy.ts";
import { buildRegistryFromStudioPricing } from "../src/application/routing/build-from-studio-pricing.ts";
import { createBudgetPolicy, createBudgetSnapshot } from "../src/domain/cost/budget.ts";
import { money } from "../src/domain/cost/money.ts";
import {
  estimateImage,
  estimateSceneImage,
  estimateVoice,
  VIDEO_MODELS,
} from "../src/lib/pricing.ts";

if (process.env.CONFIRM_PHASE_11A_REMOTE_READ !== "1") {
  console.error("Refused: CONFIRM_PHASE_11A_REMOTE_READ=1");
  process.exit(2);
}
if (process.env.PHASE_11A_ALLOW_EXECUTE === "1") {
  console.error("Refused: PHASE_11A_ALLOW_EXECUTE forbidden during PREP.");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT = "984507af-a89e-4644-8ea3-344797baa974";
const AVAILABLE = 10;
const HARD = 122;
const COMMITTED = 112;

function loadEnv(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

function usdToCents(usd) {
  return Math.round(usd * 100);
}

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: active } = await db
  .from("active_artifact_revisions")
  .select("artifact_type,artifact_id,revision")
  .eq("project_id", PROJECT);
const byType = Object.fromEntries((active ?? []).map((a) => [a.artifact_type, a]));
const need = [
  "video_project_brief",
  "marketing_plan",
  "creative_concept",
  "video_script",
  "visual_direction",
  "storyboard_project",
];
for (const t of need) {
  if (!byType[t]) {
    console.error(JSON.stringify({ error: `missing active ${t}` }));
    process.exit(1);
  }
}

async function loadArt(id) {
  const { data, error } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? `missing ${id}`);
  return data;
}

const briefA = await loadArt(byType.video_project_brief.artifact_id);
const mktA = await loadArt(byType.marketing_plan.artifact_id);
const creA = await loadArt(byType.creative_concept.artifact_id);
const scrA = await loadArt(byType.video_script.artifact_id);
const visA = await loadArt(byType.visual_direction.artifact_id);
const stbA = await loadArt(byType.storyboard_project.artifact_id);

const brief = VideoProjectBriefSchema.parse(briefA.value);
const marketingPlan = MarketingPlanSchema.parse(mktA.value);
const creativeConcept = CreativeConceptSchema.parse(creA.value);
const videoScript = VideoScriptSchema.parse(scrA.value);
const visualDirection = VisualDirectionSchema.parse(visA.value);
const storyboard = StoryboardProjectSchema.parse(stbA.value);

const analyzer = {
  async analyze() {
    return {};
  },
};
const director = createPromptDirector({ analyzer });
const promptResult = await director.run(
  {
    brief,
    marketingPlan,
    creativeConcept,
    videoScript,
    visualDirection,
    storyboard,
  },
  {
    // In-memory only (no persistence stack) — mode execute builds packages locally
    // without remote writes or provider calls (deterministic analyzer).
    correlationId: `corr-11a-prep-${Date.now()}`,
    mode: "execute",
    createdBy: "phase-11a-prep",
  },
);

if (promptResult.status !== "completed") {
  console.error(
    JSON.stringify({
      error: "prompt_director_failed",
      status: promptResult.status,
      detail:
        promptResult.status === "invalid"
          ? promptResult.errors?.slice(0, 5)
          : promptResult,
    }),
  );
  process.exit(1);
}

const packages = promptResult.output.packages;
const registry = buildRegistryFromStudioPricing({
  createdAt: "2026-08-11T00:00:00.000Z",
  registryVersion: "phase-11a-prep",
  expiresAt: "2027-01-01T00:00:00.000Z",
});

const limit = money(HARD, "USD");
const route = routeModelPlan(
  {
    storyboard,
    scenePackages: packages,
    registry,
    routingPolicy: createDefaultRoutingPolicy({ maximumFallbacksPerStep: 0 }),
    budgetPolicy: createBudgetPolicy(limit),
    budgetSnapshot: createBudgetSnapshot({
      limit,
      reserved: money(0, "USD"),
      spent: money(COMMITTED, "USD"),
    }),
    metadata: {
      id: randomUUID(),
      createdBy: "phase-11a-prep",
      createdAt: "2026-08-11T00:00:00.000Z",
    },
  },
  { at: "2026-08-11T00:00:00.000Z", correlationId: "corr-11a-route" },
);

const sceneSafe = storyboard.scenes.map((s) => ({
  idPrefix: String(s.id).slice(0, 8),
  order: s.order,
  purpose: s.purpose,
  productionIntent: s.productionIntent,
  durationSeconds: s.durationSeconds,
}));

const packageSafe = packages.map((p) => ({
  sceneIdPrefix: String(p.sceneId).slice(0, 8),
  sceneOrder: p.sceneOrder,
  productionIntent: p.productionIntent,
  capabilityProfiles: [
    ...new Set((p.variants ?? []).map((v) => v.capabilityProfile)),
  ],
  variantCount: p.variants?.length ?? 0,
  referenceCount: p.references?.length ?? 0,
  hasDialogue: Boolean(p.dialogue),
  hasScreenText: Boolean(p.screenText),
}));

let planSummary = null;
if (route.status === "completed") {
  planSummary = {
    status: route.status,
    estimatedCostMinor: route.plan.estimatedCost.amountMinor,
    fallbackExposureMinor: route.plan.fallbackExposure?.amountMinor ?? 0,
    sceneCount: route.plan.scenePlans.length,
    scenes: route.plan.scenePlans.map((sp) => ({
      sceneIdPrefix: String(sp.sceneId).slice(0, 8),
      stepCount: sp.steps.length,
      estimatedCostMinor: sp.estimatedCost.amountMinor,
      steps: sp.steps.map((st) => ({
        action: st.action,
        providerId: st.providerId,
        modelId: st.modelId,
        estimatedCostMinor: st.estimate.total.amountMinor,
        fallbackCount: st.fallbacks?.length ?? 0,
      })),
    })),
  };
} else {
  planSummary = {
    status: route.status,
    reason: route.reason ?? route.publicMessage ?? null,
  };
}

const scene1 = storyboard.scenes.find((s) => s.order === 1) ?? storyboard.scenes[0];
const sceneImageOnly =
  storyboard.scenes.find((s) => s.order === 2) ??
  storyboard.scenes.find((s) => s.productionIntent === "text_motion") ??
  scene1;
const spokenChars = JSON.stringify(sceneImageOnly?.spokenContent ?? "").length;

const optionImageOpenAI = {
  id: "opt-image-openai-still",
  capability: "image.text_to_image / scene_image",
  provider: "openai",
  model: "gpt-image-1",
  size: "1024x1024",
  quality: "low",
  syncAsync: "sync",
  estimateUsd: estimateImage("1024x1024", "low", 1),
  estimateMinor: usdToCents(estimateImage("1024x1024", "low", 1)),
  reservationMinor: usdToCents(estimateImage("1024x1024", "low", 1)),
  maxCalls: 1,
  maxJobs: 1,
  maxAssets: 1,
  wait: "seconds",
  value: "proves OpenAI image adapter + asset persist + ledger",
  identityRisk: "low (no identity ref required for text-to-image)",
  chainRisk: "low if single-step allowlist",
  cancel: "n/a sync",
};
const optionImageFal = {
  id: "opt-image-fal-pulid",
  capability: "image.reference_identity (scene still)",
  provider: "fal",
  model: "fal-ai/flux-pulid",
  syncAsync: "sync",
  estimateUsd: estimateSceneImage(),
  estimateMinor: usdToCents(estimateSceneImage()),
  reservationMinor: usdToCents(estimateSceneImage()),
  maxCalls: 1,
  maxJobs: 1,
  maxAssets: 1,
  wait: "seconds",
  value: "proves fal image path; needs identity ref",
  identityRisk: "medium (PuLID identity)",
  chainRisk: "low if single-step",
  cancel: "n/a sync",
  note: "storyboard scenes currently report refCount=0 — may be blocked without ref asset",
};
const optionVideo = {
  id: "opt-video-hailuo-min",
  capability: "video.text_to_video",
  provider: "fal",
  model: "fal-ai/minimax/hailuo-02/standard/text-to-video",
  syncAsync: "async",
  seconds: 6,
  estimateUsd: VIDEO_MODELS.find((m) => m.id.includes("hailuo"))?.usdPerSecond
    ? VIDEO_MODELS.find((m) => m.id.includes("hailuo")).usdPerSecond * 6
    : 0.3,
  estimateMinor: usdToCents(
    (VIDEO_MODELS.find((m) => m.id.includes("hailuo"))?.usdPerSecond ?? 0.05) *
      6,
  ),
  reservationMinor: usdToCents(
    (VIDEO_MODELS.find((m) => m.id.includes("hailuo"))?.usdPerSecond ?? 0.05) *
      6,
  ),
  maxCalls: 1,
  maxJobs: 1,
  maxAssets: 1,
  wait: "minutes + polling",
  value: "proves async video queue",
  identityRisk: "low",
  chainRisk: "medium (async orphan risk)",
  cancel: "fal cancel limited/unsupported",
};
const optionVoice = {
  id: "opt-voice-elevenlabs",
  capability: "voice.tts",
  provider: "elevenlabs",
  model: "eleven_multilingual_v2",
  syncAsync: "sync",
  estimateUsd: estimateVoice(Math.max(spokenChars, 80)).usd,
  estimateMinor: usdToCents(estimateVoice(Math.max(spokenChars, 80)).usd),
  reservationMinor: usdToCents(estimateVoice(Math.max(spokenChars, 80)).usd),
  maxCalls: 1,
  maxJobs: 1,
  maxAssets: 1,
  wait: "seconds",
  value: "proves voice adapter; weaker proof of visual pipeline",
  identityRisk: "low",
  chainRisk: "low",
  cancel: "n/a sync",
};

const options = [
  optionImageOpenAI,
  optionImageFal,
  optionVideo,
  optionVoice,
].map((o) => ({
  ...o,
  fitsAvailable: o.estimateMinor <= AVAILABLE,
  shortfallMinor: Math.max(0, o.estimateMinor - AVAILABLE),
}));

const recommended = options.find((o) => o.id === "opt-image-openai-still");
const fullPlanMinor =
  route.status === "completed" ? route.plan.estimatedCost.amountMinor : null;

const architecture = {
  directorPathUsesFakesOnly: true,
  vhs124: "assertDirectorProductionUsesFakes forbids providerMode=real on /director",
  realAdaptersExistButUnwired: [
    "openai-image-adapter",
    "fal-adapter",
    "elevenlabs-voice-adapter",
  ],
  intermediateArtifactsAbsent: {
    scene_package_set: !byType.scene_package_set,
    generation_plan: !byType.generation_plan,
  },
  decisionRequired: [
    "Authorize VHS-124 exception to wire ONE real OpenAI image adapter on a bounded smoke path",
    "OR accept legacy /api/generate/image smoke (does NOT prove production_jobs/runs)",
  ],
};

const out = {
  phase: "11A-MEDIA-PREP",
  providerCalled: false,
  remoteWrites: 0,
  budget: {
    hardLimitMinor: HARD,
    committedMinor: COMMITTED,
    reservedMinor: 0,
    availableMinor: AVAILABLE,
  },
  storyboard: {
    idPrefix: String(stbA.id).slice(0, 8),
    revision: stbA.revision,
    sceneCount: storyboard.scenes.length,
    scenes: sceneSafe,
  },
  recommendedShot: {
    sceneIdPrefix: String(sceneImageOnly.id).slice(0, 8),
    order: sceneImageOnly.order,
    purpose: sceneImageOnly.purpose,
    productionIntent: sceneImageOnly.productionIntent,
    capabilityHint: "image.text_to_image",
    reason:
      "text_motion scene — Prompt variants image-only (no video/voice chain); representative mid-funnel; independent of other scenes",
    rejectedHookScene: {
      sceneIdPrefix: String(scene1.id).slice(0, 8),
      productionIntent: scene1.productionIntent,
      whyNot:
        "voice_over_visual variants include video.text_to_video + audio.voice — higher chain risk for first smoke",
    },
  },
  promptDirector: {
    status: promptResult.status,
    providerCalled: false,
    packageCount: packages.length,
    packages: packageSafe,
  },
  routing: planSummary,
  fullPlanEstimateMinor: fullPlanMinor,
  fullPlanFitsAvailable:
    fullPlanMinor == null ? false : fullPlanMinor <= AVAILABLE,
  options,
  recommended: {
    ...recommended,
    pricingSource: "studio/src/lib/pricing.ts estimateImage(1024x1024, low)",
    reservationWithMarginMinor: Math.max(recommended.reservationMinor, 2),
    strictMinHardLimitMinor: COMMITTED + recommended.estimateMinor,
    recommendedHardLimitMinor: Math.max(
      HARD,
      COMMITTED + recommended.estimateMinor + 5,
    ),
    recommendedDeltaMinor: Math.max(
      0,
      COMMITTED + recommended.estimateMinor + 5 - HARD,
    ),
    shortfallMinor: recommended.shortfallMinor,
  },
  architecture,
  killSwitchesFuture: {
    DIRECTOR_V2_ENABLED: 1,
    DIRECTOR_V2_PERSISTENCE_ENABLED: 1,
    DIRECTOR_V2_PAID_GENERATION_ENABLED: 1,
    DIRECTOR_V2_WORKER_ENABLED: 1,
    DIRECTOR_V2_PAID_AI_ENABLED: 0,
    textDirectors: 0,
    otherMedia: "allowlist openai image only",
    cron: 0,
    fallback: 0,
    mergeExportAuto: 0,
  },
  backupP1: {
    status: "BACKUP_PRESENT_RESTORE_UNPROVEN",
    decision: "DOES_NOT_BLOCK_BOUNDED_MEDIA_SMOKE",
    rationale:
      "bounded additive asset/job/ledger writes are reversible via flags OFF + no destructive mutation of upstream artifacts; invasive schema/delete not in smoke scope",
  },
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const path = resolve(studioRoot, ".tmp/phase-11a-media-prep-dry-run.json");
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, evidencePath: path }, null, 2));
process.exit(0);
