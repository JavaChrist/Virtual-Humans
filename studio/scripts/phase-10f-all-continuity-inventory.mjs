/**
 * Phase 10F-ALL-CONTINUITY-DIAG — Production VisualDirection continuity inventory (read-only).
 * Requires: CONFIRM_PHASE_10F_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { VisualDirectionSchema } from "../src/domain/art/index.ts";
import {
  defaultContinuityKeys,
  inventoryRequiredContinuity,
} from "../src/domain/storyboard/continuity.ts";

if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
  console.error("Refused: CONFIRM_PHASE_10F_REMOTE_READ=1");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const VISUAL_ID = "49481462-6444-41f9-8c48-7e7d32c09f1b";

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

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: art } = await db
  .from("project_artifacts")
  .select("id,revision,value")
  .eq("id", VISUAL_ID)
  .maybeSingle();
const parsed = VisualDirectionSchema.safeParse(art.value);
if (!parsed.success) {
  console.error("Zod VisualDirection FAIL");
  process.exit(2);
}
const visual = parsed.data;

const rules = visual.continuityRules.map((r) => ({
  id: r.id,
  scope: r.scope,
  severity: r.severity,
  appliesToSegmentIdsCount: r.appliesToSegmentIds.length,
  descriptionLen: r.description.length,
}));

const requiredRules = rules.filter((r) => r.severity === "required");
const preferredRules = rules.filter((r) => r.severity === "preferred");

const bySegment = Object.fromEntries(
  visual.segments.map((seg) => {
    const keys = defaultContinuityKeys(visual, seg.id);
    return [
      seg.id,
      {
        scriptSegmentId: seg.scriptSegmentId,
        requiredTokens: keys,
        tokenCount: keys.length,
        scopes: keys.map((k) => k.split(":")[0]),
        lightingToken: keys.find((k) => k.startsWith("lighting:")) ?? null,
        locationToken: keys.find((k) => k.startsWith("location:")) ?? null,
      },
    ];
  }),
);

const allTokens = Object.values(bySegment).flatMap((s) => s.requiredTokens);
const uniqueTokens = [...new Set(allTokens)];
const scopes = [...new Set(allTokens.map((k) => k.split(":")[0]))].sort();
const inv = inventoryRequiredContinuity(visual);
const fingerprint = inv.requiredContinuityTokensFingerprint;

const lightingSample = bySegment[visual.segments[0].id]?.lightingToken;
const pipeIsLiteral =
  typeof lightingSample === "string" &&
  lightingSample.includes("|") &&
  lightingSample ===
    `lighting:${visual.segments[0].lighting.source}|${visual.segments[0].lighting.temperature}`;

const out = {
  visualArtifactId: VISUAL_ID,
  revision: art.revision,
  segmentCount: visual.segments.length,
  rules,
  requiredRuleCount: requiredRules.length,
  preferredRuleCount: preferredRules.length,
  projectedScopesFromValidator: scopes,
  requiredTokensPerSegmentCount: Object.fromEntries(
    Object.entries(bySegment).map(([id, s]) => [id, s.tokenCount]),
  ),
  uniqueRequiredTokenCount: uniqueTokens.length,
  totalProjectedTokenSlots: allTokens.length,
  requiredContinuityTokensFingerprint: fingerprint,
  lightingOpaqueTokenProof: {
    sampleRedactedShape: lightingSample
      ? `lighting:${lightingSample.split(":")[1]?.replace(/[A-Za-z0-9_-]+/g, "x")}`
      : null,
    containsPipe: Boolean(lightingSample?.includes("|")),
    pipeIsCanonicalConcatenation: pipeIsLiteral,
    exactMatchValidatorConstruction: pipeIsLiteral,
  },
  segmentSummaries: Object.fromEntries(
    Object.entries(bySegment).map(([id, s]) => [
      id,
      {
        scriptSegmentId: s.scriptSegmentId,
        tokenCount: s.tokenCount,
        scopes: s.scopes,
        locationToken: s.locationToken,
        lightingToken: s.lightingToken,
      },
    ]),
  ),
};

// Read-only: stdout only (no .tmp write in V4-PREP).
// Continuity tokens are opaque identifiers required for PREP parity — emit exact list.
const matrix = Object.fromEntries(
  visual.segments.map((seg) => [
    seg.id,
    {
      mandatory: defaultContinuityKeys(visual, seg.id),
      advisory: [],
      mandatoryCount: defaultContinuityKeys(visual, seg.id).length,
    },
  ]),
);
console.log(
  JSON.stringify(
    {
      ...out,
      uniqueTokensSorted: [...uniqueTokens].sort(),
      matrix,
      mandatorySlots: allTokens.length,
      advisoryTokenSlots: 0,
      domainFingerprint: inv.mandatoryContinuityTokensFingerprint,
      fingerprintAlgo: "segId|token,token;segId|...",
    },
    null,
    2,
  ),
);
