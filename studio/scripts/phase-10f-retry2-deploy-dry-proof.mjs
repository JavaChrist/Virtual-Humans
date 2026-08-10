/**
 * Phase 10F-RETRY2-DEPLOY-PREFLIGHT — live dry-run gates (NO execute).
 * Exits 0 only when schema/metadata/salt/budget gates match.
 */
import { createHash } from "node:crypto";
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { storyboardIdempotencyFields } from "../src/application/directors/storyboard/analyze-for-project.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const BASE =
  process.env.PHASE_10F_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID =
  process.env.PHASE_10F_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const SALT =
  process.env.DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT ||
  "10f-auth-b-retry2-20260810";
const EXPECT_RETRY2_FP = "0b7e8fb44e0acd4d";
const EXPECT_AUTH_B_FP = "3f39f808e266649c";
const EXPECT_NONE_FP = "abaa9c2886ef3d59";
const EXPECT_SALT_FP = createHash("sha256")
  .update(SALT)
  .digest("hex")
  .slice(0, 16);

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

const tmp = resolve(studioRoot, ".env.vercel.10f.retry2.tmp");
const pull = spawnSync(
  "npx",
  ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
  { encoding: "utf8", shell: true, cwd: studioRoot },
);
if (pull.status !== 0) {
  console.error("FAIL: vercel env pull");
  process.exit(1);
}
const vercel = loadEnv(tmp);
try {
  unlinkSync(tmp);
} catch {
  /* ignore */
}

const password = vercel.APP_PASSWORD;
if (!password) {
  console.error("FAIL: APP_PASSWORD missing");
  process.exit(1);
}

const login = await fetch(`${BASE}/api/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password }),
});
if (!login.ok) {
  console.error(`FAIL: login ${login.status}`);
  process.exit(1);
}
const setCookies =
  typeof login.headers.getSetCookie === "function"
    ? login.headers.getSetCookie()
    : [login.headers.get("set-cookie")].filter(Boolean);
const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
const corr = `corr-10f-retry2-${Date.now()}-dry`;

const dryRes = await fetch(
  `${BASE}/api/director/projects/${PROJECT_ID}/storyboard`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: BASE,
      referer: `${BASE}/director`,
      "x-correlation-id": corr,
    },
    body: JSON.stringify({ mode: "dry-run" }),
  },
);
const dryRaw = await dryRes.json().catch(() => ({}));
const dry =
  dryRaw.dryRun && typeof dryRaw.dryRun === "object" ? dryRaw.dryRun : dryRaw;

const base = {
  projectId: PROJECT_ID,
  briefArtifactId: "95c24837-ab61-4bd1-9f47-d576e259d018",
  briefRevision: 1,
  marketingPlanArtifactId: "199284d6-7126-4383-b85f-1ecd74d9528e",
  marketingPlanRevision: 1,
  creativeConceptArtifactId: "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a",
  creativeConceptRevision: 1,
  videoScriptArtifactId: "349e2792-3235-4c00-a1da-9e087b0b4d1c",
  videoScriptRevision: 1,
  visualDirectionArtifactId: "49481462-6444-41f9-8c48-7e7d32c09f1b",
  visualDirectionRevision: 1,
  model: "gpt-5.6",
  promptVersion: "storyboard-analyzer-v2",
  schemaVersion: "1.0.0",
};
const fp = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const noneK = storyboardIdempotencyFields(base);
const authBK = storyboardIdempotencyFields({
  ...base,
  idempotencySalt: "10f-auth-b-20260810",
});
const retry2K = storyboardIdempotencyFields({
  ...base,
  idempotencySalt: SALT,
});
const noneFp = fp(noneK.key);
const authBFp = fp(authBK.key);
const retry2Fp = fp(retry2K.key);
const saltFp = EXPECT_SALT_FP;

const anyOfOk =
  dry.structuredSchemaProjection === "anyOf-compatible" ||
  dry.structuredSchemaAnyOfCompatible === true;

const checks = {
  httpOk: dryRes.status === 200,
  providerCalled: dry.providerCalled === false,
  executable: dry.executable === true && dry.executionAvailable === true,
  prompt: dry.promptVersion === "storyboard-analyzer-v2",
  schema: dry.schemaVersion === "1.0.0",
  idempotencyKeyVersion:
    dry.idempotencyKeyVersion === "storyboard-analyzer-v2:1.0.0",
  provider: dry.provider === "openai",
  model: dry.model === "gpt-5.6",
  reasoning: dry.reasoningEffort === "medium",
  maxOutputTokens: dry.maxOutputTokens === 4096,
  estimate: dry.estimatedCostMinor === 13,
  pricingConfigured: dry.pricingConfigured === true,
  noExisting: !dry.existingStoryboard,
  oneOfZero: dry.structuredSchemaOneOfCount === 0,
  anyOfCompatible: anyOfOk,
  metadataReady: dry.providerErrorMetadataCapture === "ready",
  idempotencySaltPresent: dry.idempotencySaltPresent === true,
  retry2KeyMatch: retry2Fp === EXPECT_RETRY2_FP,
  noneKeyMatch: noneFp === EXPECT_NONE_FP,
  authBKeyMatch: authBFp === EXPECT_AUTH_B_FP,
  threeDistinct:
    retry2Fp !== noneFp && retry2Fp !== authBFp && noneFp !== authBFp,
};

const pass = Object.values(checks).every(Boolean);
const evidence = {
  phase: "10F-RETRY2-DEPLOY-PREFLIGHT",
  correlationId: corr,
  dryRun: {
    http: dryRes.status,
    providerCalled: dry.providerCalled ?? null,
    executable: dry.executable ?? null,
    executionAvailable: dry.executionAvailable ?? null,
    promptVersion: dry.promptVersion ?? null,
    schemaVersion: dry.schemaVersion ?? null,
    idempotencyKeyVersion: dry.idempotencyKeyVersion ?? null,
    provider: dry.provider ?? null,
    model: dry.model ?? null,
    reasoningEffort: dry.reasoningEffort ?? null,
    maxOutputTokens: dry.maxOutputTokens ?? null,
    estimatedCostMinor: dry.estimatedCostMinor ?? null,
    pricingConfigured: dry.pricingConfigured ?? null,
    existingStoryboard: dry.existingStoryboard ? true : false,
    structuredSchemaOneOfCount: dry.structuredSchemaOneOfCount ?? null,
    structuredSchemaProjection: dry.structuredSchemaProjection ?? null,
    providerErrorMetadataCapture: dry.providerErrorMetadataCapture ?? null,
    idempotencySaltPresent: dry.idempotencySaltPresent ?? null,
  },
  keyProof: {
    saltPresent: true,
    saltFingerprint: saltFp,
    noneKeyFp: noneFp,
    authBKeyFp: authBFp,
    retry2KeyFp: retry2Fp,
    expectRetry2: EXPECT_RETRY2_FP,
  },
  checks,
  pass,
  verdict: pass ? "DRY_PROOF_PASS" : "BLOCKED_LIVE_GATE",
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const path = resolve(studioRoot, ".tmp/phase-10f-retry2-deploy-dry.json");
writeFileSync(path, JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({ ...evidence, evidencePath: path }, null, 2));
process.exit(pass ? 0 : 2);
