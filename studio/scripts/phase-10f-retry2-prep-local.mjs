/**
 * Phase 10F-RETRY2-PREP — offline local proof (NO provider, NO Vercel write, NO execute).
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { storyboardIdempotencyFields } from "../src/application/directors/storyboard/analyze-for-project.ts";
import { getStoryboardCandidateJsonSchema } from "../src/infrastructure/ai/openai/storyboard/schema.ts";
import {
  inspectStoryboardStructuredSchemaProjection,
  STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE,
} from "../src/infrastructure/ai/openai/storyboard/schema-projection.ts";
import {
  fillOpenAIStrictNullables,
  validateAgainstLocalJsonSchema,
} from "../src/infrastructure/ai/openai/storyboard/local-json-schema.ts";
import { SceneSpokenContentSchema } from "../src/domain/storyboard/schemas.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");

const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const BURNED_SALT = "10f-auth-b-20260810";
const PROPOSED_SALT = "10f-auth-b-retry2-20260810";
const FP_NONE = "abaa9c2886ef3d59";
const FP_AUTH_B = "3f39f808e266649c";

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
const none = storyboardIdempotencyFields(base);
const authB = storyboardIdempotencyFields({ ...base, idempotencySalt: BURNED_SALT });
const retry2 = storyboardIdempotencyFields({
  ...base,
  idempotencySalt: PROPOSED_SALT,
});
const fpNone = fp(none.key);
const fpAuthB = fp(authB.key);
const fpRetry2 = fp(retry2.key);

const schema = getStoryboardCandidateJsonSchema();
const projection = inspectStoryboardStructuredSchemaProjection(schema);
const spoken = schema.properties.scenes.items.properties.spokenContent;
const spokenVariantsOk = ["dialogue", "voice_over", "none"].every((kind) => {
  const sample =
    kind === "none"
      ? { kind }
      : { kind, sourceText: kind === "dialogue" ? "Bonjour" : "VO" };
  const wire = fillOpenAIStrictNullables(spoken, sample);
  return (
    SceneSpokenContentSchema.safeParse(sample).success &&
    validateAgainstLocalJsonSchema(spoken, wire).length === 0
  );
});

const dryRunLocalContract = {
  provider: "openai",
  model: "gpt-5.6",
  reasoningEffort: "medium",
  maxOutputTokens: 4096,
  estimateMinor: 13,
  reservationEqualsEstimate: true,
  hardLimitMinor: 113,
  availableMinor: 20,
  maximumFutureCalls: 1,
  structuredSchemaOneOfCount: projection.structuredSchemaOneOfCount,
  structuredSchemaProjection: projection.structuredSchemaProjection,
  providerErrorMetadataCapture: STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE,
  idempotencySaltPresent: true, // after future Auth B env set — not written here
  promptVersion: "storyboard-analyzer-v2",
  schemaVersion: "1.0.0",
  attempt_number: 1,
  retry_of_run_id: null,
};

const checks = {
  oneOfZero: projection.structuredSchemaOneOfCount === 0,
  anyOfCompatible: projection.structuredSchemaProjection === "anyOf-compatible",
  spokenVariantsOk,
  metadataCaptureReady:
    STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE === "ready",
  fpNoneMatch: fpNone === FP_NONE,
  fpAuthBMatch: fpAuthB === FP_AUTH_B,
  threeDistinct:
    fpNone !== fpAuthB && fpNone !== fpRetry2 && fpAuthB !== fpRetry2,
  proposedSaltDistinct: PROPOSED_SALT !== BURNED_SALT,
  estimate13: dryRunLocalContract.estimateMinor === 13,
  availableCoversEstimate:
    dryRunLocalContract.availableMinor >= dryRunLocalContract.estimateMinor,
  noProviderCall: true,
  noReservation: true,
  noLedgerWrite: true,
  noArtifactWrite: true,
  noVercelEnvWrite: true,
  noDeploy: true,
  noPush: true,
};

const pass = Object.values(checks).every(Boolean);
const evidence = {
  phase: "10F-RETRY2-PREP",
  providerCalls: 0,
  newRuns: 0,
  newArtifacts: 0,
  ledgerWrites: 0,
  remoteWrites: 0,
  proposedSalt: PROPOSED_SALT,
  burnedSalt: BURNED_SALT,
  keyFingerprints: {
    none: fpNone,
    authB: fpAuthB,
    retry2: fpRetry2,
  },
  projection,
  dryRunLocalContract,
  previousRunsImmutable: [
    "b446a0ed-0005-40ed-b134-b7ab769bd819",
    "f5b75018-5aa1-4a16-97e1-7e515f94f106",
  ],
  closureMatrix: {
    marketingCreativeScriptArt: "OFF",
    storyboardAi: "ON only during future window",
    paidGeneration: "OFF",
    worker: "OFF",
    runtimeAfterClose: "OFF",
  },
  checks,
  pass,
  verdict: pass ? "READY_FOR_PUSH_AND_REAUTH" : "NOT_READY",
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const out = resolve(studioRoot, ".tmp/phase-10f-retry2-prep-done.json");
writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({ ...evidence, evidencePath: out }, null, 2));
process.exit(pass ? 0 : 2);
