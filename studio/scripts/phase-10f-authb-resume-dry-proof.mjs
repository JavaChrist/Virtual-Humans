/**
 * Phase 10F-AUTH-B RESUME — live dry-run salt proof (no execute).
 * Exits 0 only when contract + idempotencySaltPresent + key fingerprints match.
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
const SALT = process.env.DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT || "10f-auth-b-20260810";
const EXPECT_NEW_FP = "3f39f808e266649c";
const EXPECT_OLD_FP = "abaa9c2886ef3d59";

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

const tmp = resolve(studioRoot, ".env.vercel.10f.resume.tmp");
const pull = spawnSync(
  "npx",
  ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
  { encoding: "utf8", shell: true, cwd: studioRoot }
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
const corr = `corr-10f-resume-${Date.now()}-dry`;

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
  }
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
const oldK = storyboardIdempotencyFields(base);
const newK = storyboardIdempotencyFields({ ...base, idempotencySalt: SALT });
const newFp = fp(newK.key);
const oldFp = fp(oldK.key);

const checks = {
  httpOk: dryRes.status === 200,
  providerCalled: dry.providerCalled === false,
  executable: dry.executable === true && dry.executionAvailable === true,
  idempotencySaltPresent: dry.idempotencySaltPresent === true,
  prompt: dry.promptVersion === "storyboard-analyzer-v2",
  schema: dry.schemaVersion === "1.0.0",
  model: dry.model === "gpt-5.6",
  reasoning: dry.reasoningEffort === "medium",
  maxOutputTokens: dry.maxOutputTokens === 4096,
  estimate: dry.estimatedCostMinor === 13,
  noExisting: !dry.existingStoryboard,
  newKeyFingerprintMatch: newFp === EXPECT_NEW_FP,
  oldKeyFingerprintMatch: oldFp === EXPECT_OLD_FP,
  fingerprintsDistinct: newFp !== oldFp,
};
const pass = Object.values(checks).every(Boolean);

const evidence = {
  phase: "10F-AUTH-B-RESUME",
  correlationId: corr,
  deploymentExpectedLineage: "d2mth5hp7->im5dy49ry",
  dryRun: {
    http: dryRes.status,
    providerCalled: dry.providerCalled ?? null,
    executable: dry.executable ?? null,
    executionAvailable: dry.executionAvailable ?? null,
    idempotencySaltPresent: dry.idempotencySaltPresent ?? null,
    promptVersion: dry.promptVersion ?? null,
    schemaVersion: dry.schemaVersion ?? null,
    model: dry.model ?? null,
    reasoningEffort: dry.reasoningEffort ?? null,
    maxOutputTokens: dry.maxOutputTokens ?? null,
    estimatedCostMinor: dry.estimatedCostMinor ?? null,
    provider: dry.provider ?? null,
    pricingConfigured: dry.pricingConfigured ?? null,
    existingStoryboard: dry.existingStoryboard ? true : false,
  },
  keyProof: {
    salt: SALT,
    oldKeyFp: oldFp,
    newKeyFp: newFp,
    expectNew: EXPECT_NEW_FP,
    expectOld: EXPECT_OLD_FP,
  },
  checks,
  pass,
  verdict: pass ? "DRY_PROOF_PASS" : "BLOCKED_SALT_NOT_APPLIED",
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const path = resolve(studioRoot, ".tmp/phase-10f-authb-resume-dry.json");
writeFileSync(path, JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({ ...evidence, evidencePath: path }, null, 2));
process.exit(pass ? 0 : 2);
