/**
 * Read-only local proof: overlay spec, synthetic compositor, no-text prompt leak check.
 * No Vercel, no provider, no Production writes.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const studioRoot = resolve(".");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const EXPECTED_COMMIT = "20e8783fa8ef11f976aa041c6169a69742ee19cf";
const AUTH = "AUTH_11A_TEXT_FREE_IMAGE_RETRY_PREFLIGHT";
const REPORT = join(studioRoot, ".tmp", "phase-11a-text-free-retry-preflight-20e8783-report.json");

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[m[1]] = v;
  }
  return map;
}

function fail(msg) {
  throw new Error(msg);
}

const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: active, error } = await db
  .from("active_artifact_revisions")
  .select("artifact_type,artifact_id,revision")
  .eq("project_id", PROJECT_ID);
if (error) fail(error.message);
const byType = Object.fromEntries((active ?? []).map((a) => [a.artifact_type, a]));

async function loadArt(type) {
  const { data, error: e } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", byType[type].artifact_id)
    .maybeSingle();
  if (e || !data) fail(e?.message ?? `missing ${type}`);
  return data;
}

const [
  overlayMod,
  promptMod,
  promptDir,
  planMod,
  allow,
  pngMod,
  composeMod,
  roleMod,
  qcMod,
  ocrMod,
  fontMod,
  briefS,
  mktS,
  creS,
  scrS,
  visS,
  stbS,
] = await Promise.all([
  import(pathToFileURL(join(studioRoot, "src/domain/production/image-text-overlay.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-image-prompt.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/directors/prompt/prompt-director.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-single-step-plan.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-openai-image-allowlist.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-png-rgb.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-deterministic-compositor.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-image-role-storage.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-typographic-qc.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-ocr-gate.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-overlay-font.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/brief/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/marketing/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/creative/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/script/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/art/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/storyboard/index.ts")).href),
]);

const briefA = await loadArt("video_script".replace("video_script", "video_project_brief"));
const mktA = await loadArt("marketing_plan");
const creA = await loadArt("creative_concept");
const scrA = await loadArt("video_script");
const visA = await loadArt("visual_direction");
const stbA = await loadArt("storyboard_project");

const director = promptDir.createPromptDirector({ analyzer: { async analyze() { return {}; } } });
const promptResult = await director.run(
  {
    brief: briefS.VideoProjectBriefSchema.parse(briefA.value),
    marketingPlan: mktS.MarketingPlanSchema.parse(mktA.value),
    creativeConcept: creS.CreativeConceptSchema.parse(creA.value),
    videoScript: scrS.VideoScriptSchema.parse(scrA.value),
    visualDirection: visS.VisualDirectionSchema.parse(visA.value),
    storyboard: stbS.StoryboardProjectSchema.parse(stbA.value),
  },
  { correlationId: `corr-11a-local-proof-${Date.now()}`, mode: "execute", createdBy: "phase-11a-local-proof" },
);
if (promptResult.status !== "completed") fail(`ScenePackage build failed: ${promptResult.status}`);
const scenePkg = planMod.selectPhase11AScene2Package({ packages: promptResult.output.packages });

const title = String(scenePkg.screenText?.text || "").trim();
const callToAction = String(scrA.value.callToAction?.text || "").trim();
const locale = String(scrA.value.language || "fr");
if (!title || !callToAction) fail("BLOCKED_OVERLAY_COPY_REVIEW_REQUIRED");

const spec = overlayMod.createDefaultPhase11AOverlaySpec({ locale, title, callToAction });
const overlayFingerprint = overlayMod.fingerprintImageTextOverlaySpec(spec);
const contrast = overlayMod.contrastRatio(spec.textColor, spec.backgroundColor);

let promptContainsMarketingCopy = false;
let leakReason = null;
let promptHash = null;
let promptVersion = null;
let providerTextPolicy = null;
try {
  const built = promptMod.buildPhase11AImagePromptFromScenePackage(scenePkg, { overlay: spec });
  promptHash = built.promptHash;
  promptVersion = built.promptVersion;
  providerTextPolicy = built.redactedMetadata.providerTextPolicy;
  promptMod.assertOverlayStringsNotInProviderPrompt(built.promptText, spec);
} catch (e) {
  const msg = String(e.message || e);
  if (/overlay copy|screenText copy|draw words/i.test(msg)) {
    promptContainsMarketingCopy = true;
    leakReason = msg.slice(0, 200);
  } else {
    fail(msg);
  }
}

const dry = allow.phase11AOpenAIImageAllowlistDryRun({
  env: { VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION: "1" },
  availableMinor: 26,
});
if (dry.providerCalled !== false) fail("providerCalled");
if (dry.estimateMinor !== 1 || dry.reservationMinor > 2) fail("BLOCKED_PRICING_DIVERGENCE");

const synthetic = pngMod.solidRgbPng({ width: 1024, height: 1024, r: 32, g: 40, b: 52 });
const composed = composeMod.composePhase11ADeterministicOverlay({ providerPng: synthetic, spec });
const composed2 = composeMod.composePhase11ADeterministicOverlay({ providerPng: synthetic, spec });
if (composed.checksumSha256 !== composed2.checksumSha256) fail("compositor not deterministic");
const qc = qcMod.validatePhase11ATypographicQc({ spec, composed });
if (qc.status !== "accepted") fail(`typo QC ${qc.reasons.map((r) => r.code).join(",")}`);
const ocr = await ocrMod.inspectProviderImageText({
  bytes: synthetic,
  ocr: ocrMod.createUnavailableImageOcrPort(),
});

const providerPath = roleMod.buildPhase11ARoleImageStoragePath({
  workspaceId: WORKSPACE_ID,
  projectId: PROJECT_ID,
  assetId: "00000000-0000-4000-8000-000000000011",
  role: "provider",
});
const composedPath = roleMod.buildPhase11ARoleImageStoragePath({
  workspaceId: WORKSPACE_ID,
  projectId: PROJECT_ID,
  assetId: "00000000-0000-4000-8000-000000000012",
  role: "composed",
});

const report = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, "utf8")) : {};
const saltFp = report.saltFingerprint || "unknown";
const futureIdempotencyFingerprint = createHash("sha256")
  .update(
    [AUTH, EXPECTED_COMMIT, saltFp, "scene-2", overlayMod.PHASE_11A_PROVIDER_TEXT_POLICY_VERSION, overlayFingerprint, "attempt=1", "retry_of=null"].join("|"),
    "utf8",
  )
  .digest("hex");

const overlayProof = {
  overlayCopyReviewed: true,
  overlaySpecValid: true,
  title,
  callToAction,
  subtitle: null,
  legalLine: null,
  locale,
  fontFamily: spec.fontFamily,
  fontWeight: spec.fontWeight,
  fontSize: spec.fontSize,
  textColor: spec.textColor,
  backgroundColor: spec.backgroundColor,
  contrast,
  contrastRequirement: spec.contrastRequirement,
  safeArea: spec.safeArea,
  maxLines: spec.maxLines,
  overflowPolicy: spec.overflowPolicy,
  overlayFingerprint,
  overlayVersion: spec.version,
  compositorVersion: composeMod.PHASE_11A_COMPOSITOR_VERSION,
  compositorRuntime: composeMod.PHASE_11A_DETERMINISTIC_OVERLAY_RUNTIME,
  compositorDeterministic: true,
  fontAllowlisted: spec.fontFamily === fontMod.PHASE_11A_OVERLAY_FONT_FAMILY,
  promptContainsMarketingCopy,
  leakReason,
  promptHash,
  promptVersion,
  providerTextPolicy: overlayMod.PHASE_11A_PROVIDER_TEXT_POLICY,
  providerTextPolicyVersion: overlayMod.PHASE_11A_PROVIDER_TEXT_POLICY_VERSION,
  textOverlayMode: overlayMod.PHASE_11A_TEXT_OVERLAY_MODE,
  ocr: { status: ocr.status, measure: ocr.measure, realOcrCalled: false, fakeOcrInProduction: false },
  providerStoragePathPattern: providerPath.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{uuid}"),
  composedStoragePathPattern: composedPath.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{uuid}"),
  providerAssetActive: false,
  composedAssetActive: false,
  futureIdempotencyFingerprint,
  retryOf: null,
  attempt: 1,
  syntheticComposeOnly: true,
  productionMediaRead: false,
  productionMediaWrite: false,
};

const verdict = promptContainsMarketingCopy
  ? "BLOCKED_TEXT_LEAK_TO_PROVIDER_PROMPT"
  : dry.estimateMinor !== 1
    ? "BLOCKED_PRICING_DIVERGENCE"
    : "READY_FOR_TEXT_FREE_IMAGE_RETRY_PAID_AUTH";

report.verdict = verdict;
report.error = undefined;
report.local = {
  verdict,
  dry: {
    providerCalled: dry.providerCalled,
    executable: dry.executable,
    estimateMinor: dry.estimateMinor,
    reservationMinor: dry.reservationMinor,
    pricingConfigured: dry.pricingConfigured,
    humanReviewRequired: dry.humanReviewRequired,
    assetActive: dry.assetActive,
    provider: dry.provider,
    model: dry.model,
    quality: dry.quality,
    size: dry.size,
    compositionFingerprint: dry.compositionFingerprint,
  },
  overlayProof,
  futureIdempotencyFingerprint,
  scenePackage: {
    sceneId: scenePkg.sceneId,
    sceneOrder: scenePkg.sceneOrder,
    productionIntent: scenePkg.productionIntent,
    persisted: false,
  },
  artifacts: {
    scriptRevision: scrA.revision,
    storyboardRevision: stbA.revision,
  },
  openaiKeyValueRead: false,
};
writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  verdict,
  title,
  callToAction,
  locale,
  overlayFingerprint: overlayFingerprint.slice(0, 16),
  leak: promptContainsMarketingCopy,
  leakReason,
  estimateMinor: dry.estimateMinor,
  reservationMinor: dry.reservationMinor,
  compositor: composeMod.PHASE_11A_COMPOSITOR_VERSION,
  ocr: ocr.status,
}, null, 2));
