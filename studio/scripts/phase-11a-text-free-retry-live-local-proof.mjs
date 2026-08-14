/**
 * Read-only: rebuild scene-2 no-text package from Production artifacts.
 * No Vercel, no provider, no writes.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const studioRoot = resolve(".");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const EXPECTED = {
  scenePackage: "be47788f8c685a70b3802da5aa10a0ee44600f7e43e313072a108b82e74c7384",
  generationPlan: "86a86087a32c80e5de86e2ce4748f7f6f0cc0c25b380514d5a227d71a00f57a8",
  overlay: "fdfae63fe1c7d003d9e4190bf0aea904fdab59caa2ddad5c2972cb6c39a423b9",
  promptHash: "19628b08e2fda6e8e396f798c3dd5bb6ec8431b996c5eaf520d7e1bd478d75de",
  title: "De l\u2019idée à la structure",
  cta: "Découvrir Virtual Humans Studio",
};

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

function fail(msg) {
  throw new Error(msg);
}

const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
  fail("missing .env.remote.local");
}
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: active, error } = await db
  .from("active_artifact_revisions")
  .select("artifact_type,artifact_id,revision")
  .eq("project_id", PROJECT_ID);
if (error) fail(error.message);
const byType = Object.fromEntries((active ?? []).map((a) => [a.artifact_type, a]));
for (const t of [
  "video_project_brief",
  "marketing_plan",
  "creative_concept",
  "video_script",
  "visual_direction",
  "storyboard_project",
]) {
  if (!byType[t]) fail(`missing active ${t}`);
}

async function loadArt(id) {
  const { data, error: e } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", id)
    .maybeSingle();
  if (e || !data) fail(e?.message ?? `missing ${id}`);
  return data;
}

const [
  overlayMod,
  promptMod,
  promptDir,
  planMod,
  pkgMod,
  leakMod,
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
  import(pathToFileURL(join(studioRoot, "src/application/production/phase-11a-scene2-visual-package.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/production/overlay-copy-leak.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/brief/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/marketing/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/creative/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/script/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/art/index.ts")).href),
  import(pathToFileURL(join(studioRoot, "src/domain/storyboard/index.ts")).href),
]);

const briefA = await loadArt(byType.video_project_brief.artifact_id);
const mktA = await loadArt(byType.marketing_plan.artifact_id);
const creA = await loadArt(byType.creative_concept.artifact_id);
const scrA = await loadArt(byType.video_script.artifact_id);
const visA = await loadArt(byType.visual_direction.artifact_id);
const stbA = await loadArt(byType.storyboard_project.artifact_id);

const director = promptDir.createPromptDirector({
  analyzer: { async analyze() { return {}; } },
});
const promptResult = await director.run(
  {
    brief: briefS.VideoProjectBriefSchema.parse(briefA.value),
    marketingPlan: mktS.MarketingPlanSchema.parse(mktA.value),
    creativeConcept: creS.CreativeConceptSchema.parse(creA.value),
    videoScript: scrS.VideoScriptSchema.parse(scrA.value),
    visualDirection: visS.VisualDirectionSchema.parse(visA.value),
    storyboard: stbS.StoryboardProjectSchema.parse(stbA.value),
  },
  {
    correlationId: "corr-11a-live-local-proof",
    mode: "execute",
    createdBy: "phase-11a-live-local-proof",
  },
);
if (promptResult.status !== "completed") fail(`prompt director ${promptResult.status}`);
const scenePkg = planMod.selectPhase11AScene2Package({ packages: promptResult.output.packages });

const title = EXPECTED.title;
const cta = EXPECTED.cta;
const overlay = overlayMod.createDefaultPhase11AOverlaySpec({
  locale: "fr",
  title,
  callToAction: cta,
});
const overlayFp = overlayMod.fingerprintImageTextOverlaySpec(overlay);
const set = pkgMod.buildPhase11AScene2VisualPackageSet({
  scenePackage: scenePkg,
  overlay,
  projectId: PROJECT_ID,
  createdBy: "phase-11a-live-local-proof",
  correlationId: "corr-11a-live-local-proof",
});
const prompt = promptMod.buildPhase11AImagePromptFromScenePackage(set.scenePackageSet.packages[0], {
  overlay,
});
const plan = planMod.buildPhase11ASingleStepGenerationPlan({
  projectId: PROJECT_ID,
  storyboardRevisionId: stbA.id,
  scenePackageRevisionIds: [set.scenePackageSet.id],
  scenePackage: set.scenePackageSet.packages[0],
  createdAt: "2026-08-14T00:00:00.000Z",
  createdBy: "phase-11a-live-local-proof",
  correlationId: "corr-11a-live-local-proof",
  overlay,
});

const copy = leakMod.overlayCopyFromSpec(overlay);
const visualBlob = JSON.stringify({
  subject: scenePkg.subject,
  visualVariant: set.visualVariant,
  variants: scenePkg.variants,
});
let overlayCopyInVisualVariant = false;
let overlayCopyInProviderPrompt = false;
for (const s of copy) {
  if (visualBlob.includes(s)) overlayCopyInVisualVariant = true;
  if (prompt.promptText.includes(s)) overlayCopyInProviderPrompt = true;
}

const report = {
  persist: false,
  providerCalled: false,
  visualSubject: set.visualVariant.visualSubject,
  overlayFingerprint: overlayFp,
  promptHash: prompt.promptHash,
  promptVersion: prompt.promptVersion,
  scenePackageFingerprint: set.fingerprint,
  generationPlanFingerprint: plan.fingerprint,
  overlayCopyInVisualVariant,
  overlayCopyInProviderPrompt,
  providerPromptNoText: /no text/i.test(prompt.promptText) && /no letters/i.test(prompt.promptText),
  estimateMinor: plan.estimateMinor,
  reservationMinor: plan.reservationMinor,
  match: {
    overlay: overlayFp === EXPECTED.overlay,
    promptHash: prompt.promptHash === EXPECTED.promptHash,
    scenePackage: set.fingerprint === EXPECTED.scenePackage,
    generationPlan: plan.fingerprint === EXPECTED.generationPlan,
  },
  artifacts: {
    marketingRev: mktA.revision,
    creativeRev: creA.revision,
    scriptRev: scrA.revision,
    visualRev: visA.revision,
    storyboardRev: stbA.revision,
    storyboardPrefix: String(stbA.id).slice(0, 8),
  },
};
if (/sk-|data:image\/|base64,/.test(JSON.stringify(report))) fail("secret/media leaked");
mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
writeFileSync(
  join(studioRoot, ".tmp", "phase-11a-text-free-retry-live-local-proof.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
