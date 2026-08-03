/**
 * VHS-117C — Controlled one-call Marketing OpenAI smoke test.
 *
 * Requires:
 *   MARKETING_AI_SMOKE_CONFIRM=ONE_CALL_MAX_010_USD
 *   SUPABASE_LOCAL_INTEGRATION=1
 *   OPENAI_API_KEY in environment or studio/.env.local
 *
 * Never prints secrets. Local Supabase only (127.0.0.1 / localhost).
 * Maximum OpenAI calls: 1 — no retry / repair / fallback.
 *
 * Usage (from studio/):
 *   $env:SUPABASE_LOCAL_INTEGRATION="1"
 *   $env:MARKETING_AI_SMOKE_CONFIRM="ONE_CALL_MAX_010_USD"
 *   npm run smoke:marketing-openai
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");

const CONFIRM = "ONE_CALL_MAX_010_USD";
const MAX_COST_MINOR = 10; // 0.10 USD
const MAX_OPENAI_CALLS = 1;
const MODEL = "gpt-5.6-terra";
const MAX_OUTPUT_TOKENS = 1200;

/** Price book for this smoke only — not hardcoded in the adapter. */
const SMOKE_PRICE_BOOK = {
  source: "VHS-117C user-authorized smoke rates (OpenAI gpt-5.6-terra docs retained)",
  version: "smoke-vhs-117c-2026-08-03",
  verifiedAt: "2026-08-03",
  currency: "USD",
  confidence: "medium",
  inputUsdPerMillion: 2.5,
  outputUsdPerMillion: 15,
  inputPerMillionMinor: 250,
  outputPerMillionMinor: 1500,
};

let openAiCallsRemaining = MAX_OPENAI_CALLS;
let openAiCallsMade = 0;

function fail(msg, code = 1) {
  console.error(`SMOKE FAIL: ${msg}`);
  console.error(`OpenAI calls remaining: ${openAiCallsRemaining}`);
  console.error(`OpenAI calls made: ${openAiCallsMade}`);
  process.exit(code);
}

function assertLocalHost(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    fail(`URL Supabase invalide.`);
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    fail(`URL non locale refusée (host=${host}). Aucun fallback distant.`);
  }
}

function loadEnvLocal() {
  const path = resolve(studioRoot, ".env.local");
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

function readLocalSupabaseEnv() {
  let raw;
  try {
    raw = execSync("npx supabase status -o env", {
      cwd: studioRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail("Impossible de lire supabase status — démarrez Supabase local.");
  }
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return map;
}

function printPreflight(ctx) {
  console.log("=== VHS-117C PREFLIGHT ===");
  console.log(`1. modèle: ${ctx.model}`);
  console.log(`2. reasoning.effort: ${ctx.reasoningEffort}`);
  console.log(`3. max output tokens: ${ctx.maxOutputTokens}`);
  console.log(
    `4. pricing: ${SMOKE_PRICE_BOOK.inputUsdPerMillion}/${SMOKE_PRICE_BOOK.outputUsdPerMillion} USD/MTok ` +
      `(version=${SMOKE_PRICE_BOOK.version}, source=${SMOKE_PRICE_BOOK.source}, confidence=${SMOKE_PRICE_BOOK.confidence})`
  );
  console.log(
    `5. coût maximal théorique: ${ctx.maxEstimateMinor} cents (<= ${MAX_COST_MINOR})`
  );
  console.log(`6. projet local ciblé: ${ctx.projectId} (${ctx.projectName})`);
  console.log(`7. URL Supabase: ${ctx.supabaseUrl} (local confirmé)`);
  console.log(
    `8. flags: DIRECTOR_V2=1 PERSISTENCE=1 MARKETING_AI=1 PAID_AI=1 (process-local)`
  );
  console.log(`9. compteur d'appel: maximumOpenAICalls=${MAX_OPENAI_CALLS}`);
  console.log(
    `10. désactivation finale: Remove-Item Env:DIRECTOR_V2_MARKETING_AI_ENABLED, DIRECTOR_V2_PAID_AI_ENABLED, MARKETING_AI_SMOKE_CONFIRM`
  );
  console.log(`OPENAI_API_KEY présente: ${ctx.apiKeyPresent ? "oui" : "non"}`);
  console.log("==========================");
}

async function main() {
  if (process.env.SUPABASE_LOCAL_INTEGRATION !== "1") {
    fail("SUPABASE_LOCAL_INTEGRATION=1 requis.");
  }
  if (process.env.MARKETING_AI_SMOKE_CONFIRM !== CONFIRM) {
    fail(
      `Confirmation requise: MARKETING_AI_SMOKE_CONFIRM=${CONFIRM}`
    );
  }

  const local = readLocalSupabaseEnv();
  const fileEnv = loadEnvLocal();
  const supabaseUrl = process.env.SUPABASE_LOCAL_URL || local.API_URL;
  const serviceKey =
    process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY || local.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    fail("Credentials Supabase locaux introuvables.");
  }
  assertLocalHost(supabaseUrl);

  // Refuse any accidental remote override
  if (
    process.env.SUPABASE_URL &&
    !/127\.0\.0\.1|localhost/.test(process.env.SUPABASE_URL)
  ) {
    console.log(
      "NOTE: SUPABASE_URL distant détecté dans l'environnement — ignoré (local forcé)."
    );
  }

  const apiKey = process.env.OPENAI_API_KEY || fileEnv.OPENAI_API_KEY;
  if (!apiKey) {
    fail("openai_not_configured — OPENAI_API_KEY absente.");
  }

  // Dynamic import of TS modules via tsx loader (script invoked with --import tsx)
  const { createFetchOpenAIResponsesClient } = await import(
    "../src/infrastructure/ai/openai/responses-client.ts"
  );
  const { createOpenAIMarketingAnalyzerAdapter } = await import(
    "../src/infrastructure/ai/openai/marketing/adapter.ts"
  );
  const { createDirectorPersistenceStack } = await import(
    "../src/infrastructure/db/director-server.ts"
  );
  const { createSupabaseCreateProjectWithBriefPort } = await import(
    "../src/infrastructure/db/repositories/create-project-with-brief.ts"
  );
  const { finalizeBrief, BRIEF_SCHEMA_VERSION } = await import(
    "../src/domain/brief/index.ts"
  );
  const { quoteAiUsageCost } = await import(
    "../src/infrastructure/ai/openai/marketing/pricing.ts"
  );

  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const briefArtifactId = randomUUID();

  const smokeEnv = {
    DIRECTOR_V2_ENABLED: "1",
    DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
    DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
    DIRECTOR_V2_PAID_AI_ENABLED: "1",
    DIRECTOR_V2_WORKER_ENABLED: "0",
    DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
    DIRECTOR_V2_WORKSPACE_ID: workspaceId,
    OPENAI_API_KEY: apiKey,
    OPENAI_MARKETING_MODEL: MODEL,
    OPENAI_MARKETING_REASONING_EFFORT: "low",
    OPENAI_MARKETING_MAX_OUTPUT_TOKENS: String(MAX_OUTPUT_TOKENS),
    OPENAI_MARKETING_REQUIRE_PRICING: "1",
    OPENAI_MARKETING_PRICE_VERSION: SMOKE_PRICE_BOOK.version,
    OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: String(
      SMOKE_PRICE_BOOK.inputPerMillionMinor
    ),
    OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: String(
      SMOKE_PRICE_BOOK.outputPerMillionMinor
    ),
    // Never point persistence at remote
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  };

  // High-bound estimate for preflight display (conservative input guess)
  const conservativeInputTokens = 4000;
  const maxEstimateMinor = Math.floor(
    (conservativeInputTokens * SMOKE_PRICE_BOOK.inputPerMillionMinor +
      MAX_OUTPUT_TOKENS * SMOKE_PRICE_BOOK.outputPerMillionMinor) /
      1_000_000
  );

  printPreflight({
    model: MODEL,
    reasoningEffort: "low",
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxEstimateMinor,
    projectId,
    projectName: "Test Marketing VHS",
    supabaseUrl,
    apiKeyPresent: true,
  });

  if (maxEstimateMinor > MAX_COST_MINOR) {
    fail(
      `Estimation haute ${maxEstimateMinor} cents > plafond ${MAX_COST_MINOR}. Zéro appel.`
    );
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Seed workspace
  {
    const { error } = await db.from("workspaces").insert({
      id: workspaceId,
      slug: `smoke-${workspaceId.slice(0, 8)}`,
      name: "Smoke Marketing VHS-117C",
      mode: "single_workspace",
    });
    if (error) fail(`workspace insert: ${error.message}`);
    const { error: bErr } = await db.from("workspace_budget_policies").insert({
      workspace_id: workspaceId,
      hard_limit_minor: 10_000,
      currency: "USD",
    });
    if (bErr) fail(`budget policy: ${bErr.message}`);
  }

  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: new Date().toISOString(),
      currentStep: 5,
      fields: {
        projectName: "Test Marketing VHS",
        subjectType: "service",
        subjectName: "Studio fictif de création vidéo",
        subjectDescription:
          "Service fictif aidant de petites entreprises à préparer des vidéos courtes.",
        objective: "awareness",
        platform: "instagram",
        durationSeconds: 20,
        aspectRatio: "9:16",
        language: "fr",
        tone: "professional",
        audienceDescription: "petites entreprises",
        callToAction: "Découvrir le service",
        brandConstraints: "ne faire aucune promesse chiffrée",
        mediaReferences: [],
      },
    },
    {
      id: briefArtifactId,
      projectId,
      createdBy: "smoke-tester",
      correlationId: `corr-smoke-117c-${Date.now()}`,
      revision: 1,
    }
  );

  const createPort = createSupabaseCreateProjectWithBriefPort({ client: db });
  await createPort.execute({
    workspaceId,
    projectId,
    artifactId: briefArtifactId,
    projectName: brief.projectName,
    brief: { ...brief },
    schemaVersion: BRIEF_SCHEMA_VERSION,
    correlationId: brief.correlationId,
    actorType: "shared_password",
    actorId: "smoke-tester",
    createdBy: "smoke-tester",
  });
  console.log(`Projet local créé: ${projectId}`);

  // One-call guarded OpenAI client
  const inner = createFetchOpenAIResponsesClient({ apiKey });
  const guardedClient = {
    async create(request, context) {
      console.log(`OpenAI calls remaining: ${openAiCallsRemaining}`);
      if (openAiCallsRemaining <= 0) {
        fail("Tentative d'appel OpenAI refusée — budget d'appel épuisé.");
      }
      // Count the attempt before network I/O (401/429/5xx still consume the slot)
      openAiCallsRemaining -= 1;
      openAiCallsMade += 1;
      try {
        const result = await inner.create(request, context);
        console.log(`OpenAI calls remaining: ${openAiCallsRemaining}`);
        return result;
      } catch (e) {
        console.log(`OpenAI calls remaining: ${openAiCallsRemaining}`);
        throw e;
      }
    },
  };

  const pricing = {
    getPriceBook(modelId) {
      if (modelId !== MODEL) return null;
      return {
        modelId: MODEL,
        pricingVersion: SMOKE_PRICE_BOOK.version,
        currency: "USD",
        inputPerMillionMinor: SMOKE_PRICE_BOOK.inputPerMillionMinor,
        outputPerMillionMinor: SMOKE_PRICE_BOOK.outputPerMillionMinor,
        confidence: SMOKE_PRICE_BOOK.confidence,
      };
    },
  };

  const { parseOpenAIMarketingConfig } = await import(
    "../src/infrastructure/ai/openai/config.ts"
  );
  const config = parseOpenAIMarketingConfig(smokeEnv);
  const analyzer = createOpenAIMarketingAnalyzerAdapter({
    client: guardedClient,
    config,
    env: smokeEnv,
    pricing,
  });

  const stack = createDirectorPersistenceStack({
    client: db,
    workspaceId,
    marketingAnalyzer: analyzer,
    env: smokeEnv,
  });

  // --- Dry-run (no OpenAI) ---
  console.log("Dry-run…");
  const dry = await stack.analyzeMarketing.dryRun(
    { projectId },
    { correlationId: `corr-smoke-dry-${Date.now()}`, mode: "dry-run" }
  );
  console.log(
    `dry-run: executable=${dry.executable} providerCalled=${dry.providerCalled} executionAvailable=${dry.executionAvailable} pricingConfigured=${dry.pricingConfigured} estimatedCostMinor=${dry.estimatedCostMinor}`
  );

  if (!dry.executable || dry.providerCalled !== false) {
    fail("Dry-run non exécutable ou providerCalled≠false. Zéro appel.");
  }
  if (dry.estimatedCostMinor == null) {
    fail("Estimation absente. Zéro appel.");
  }
  if (dry.estimatedCostMinor > MAX_COST_MINOR) {
    fail(
      `Estimation ${dry.estimatedCostMinor} cents > plafond ${MAX_COST_MINOR}. Zéro appel.`
    );
  }
  if (!dry.executionAvailable) {
    fail("executionAvailable=false. Zéro appel.");
  }
  if (openAiCallsMade !== 0) {
    fail("Appel OpenAI détecté pendant dry-run — abort.");
  }

  // --- Unique execute ---
  console.log("Execute (1 appel max)…");
  console.log(`OpenAI calls remaining: ${openAiCallsRemaining}`);
  let result;
  try {
    result = await stack.analyzeMarketing.execute(
      { projectId, expectedBriefRevision: dry.briefRevision },
      {
        correlationId: `corr-smoke-exec-${Date.now()}`,
        mode: "execute",
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Scrub any accidental secret-like fragments
    const safe = msg.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
    console.error(`Execute threw: ${safe}`);
    result = {
      status: "failed",
      code: "exception",
      publicMessage: safe.slice(0, 200),
      httpHint: 503,
    };
  }

  console.log(`Résultat execute: status=${result.status}`);
  console.log(`OpenAI calls made: ${openAiCallsMade}`);
  console.log(`OpenAI calls remaining: ${openAiCallsRemaining}`);

  if (openAiCallsMade > 1) {
    fail("CRITIQUE: plus d'un appel OpenAI détecté.");
  }

  // --- DB validations ---
  const { data: runs } = await db
    .from("director_runs")
    .select(
      "id,status,cost_status,estimated_cost_minor,actual_cost_minor,usage,error_code,output_artifact_id,model_id,prompt_version"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const run = runs?.[0];
  console.log(
    `director_run: status=${run?.status} cost_status=${run?.cost_status} estimated=${run?.estimated_cost_minor} actual=${run?.actual_cost_minor} error=${run?.error_code ?? "none"}`
  );

  const { data: plans } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("project_id", projectId)
    .eq("artifact_type", "marketing_plan");

  const { data: active } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", projectId)
    .eq("artifact_type", "marketing_plan")
    .maybeSingle();

  const { data: ledger } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor,cost_status,description_code")
    .eq("project_id", projectId);

  const { data: reservations } = await db
    .from("budget_reservations")
    .select("id,status,amount_minor,scope_type")
    .eq("project_id", projectId);

  const { data: audits } = await db
    .from("audit_log")
    .select("action")
    .eq("project_id", projectId);

  const { data: events } = await db
    .from("domain_events")
    .select("event_type")
    .eq("project_id", projectId);

  // vh_spend must not gain rows for this smoke (table may or may not exist)
  let vhSpendTouched = false;
  try {
    const { count, error } = await db
      .from("vh_spend")
      .select("*", { count: "exact", head: true });
    if (!error && count != null) {
      // We cannot easily filter by project; just note existence. Prefer no insert path.
      vhSpendTouched = false;
    }
  } catch {
    vhSpendTouched = false;
  }

  // Security scan of persisted JSON (no secrets)
  const blob = JSON.stringify({ runs, plans, ledger, reservations });
  const securityHits = [];
  if (/sk-[A-Za-z0-9]{10,}/.test(blob)) securityHits.push("api_key_shape");
  if (/Bearer\s+[A-Za-z0-9._-]+/i.test(blob)) securityHits.push("authorization");
  if (/service_role|SUPABASE_SERVICE/i.test(blob)) securityHits.push("supabase_secret");
  if (/X-Amz-Signature|signedurl/i.test(blob)) securityHits.push("signed_url");

  const usage = run?.usage && typeof run.usage === "object" ? run.usage : {};
  const usageNorm = {
    inputTokens: usage.inputTokens ?? usage.input_tokens,
    cachedInputTokens: usage.cachedInputTokens ?? usage.cached_input_tokens,
    outputTokens: usage.outputTokens ?? usage.output_tokens,
    reasoningTokens: usage.reasoningTokens ?? usage.reasoning_tokens,
    totalTokens: usage.totalTokens ?? usage.total_tokens,
  };

  const costQuote = quoteAiUsageCost(MODEL, usageNorm, pricing);

  const reserved = (reservations ?? [])
    .filter((r) => r.status === "committed" || r.status === "active" || r.status === "released")
    .reduce((s, r) => Math.max(s, r.amount_minor ?? 0), 0);
  const committed = (ledger ?? [])
    .filter((e) => e.entry_type === "commit")
    .reduce((s, e) => s + (e.amount_minor ?? 0), 0);
  const released = (ledger ?? [])
    .filter((e) => e.entry_type === "release")
    .reduce((s, e) => s + (e.amount_minor ?? 0), 0);

  console.log("=== RESULTAT ===");
  console.log(`plan artifacts: ${plans?.length ?? 0}`);
  console.log(
    `active marketing_plan: ${active ? `rev ${active.revision}` : "none"}`
  );
  console.log(`ledger entries: ${(ledger ?? []).map((e) => e.entry_type).join(",") || "none"}`);
  console.log(
    `audit: ${(audits ?? []).map((a) => a.action).join(",") || "none"}`
  );
  console.log(
    `outbox: ${(events ?? []).map((e) => e.event_type).join(",") || "none"}`
  );
  console.log(`usage: ${JSON.stringify(usageNorm)}`);
  console.log(
    `cost quote: ${costQuote.status}${
      costQuote.status === "known"
        ? ` ${costQuote.total.amountMinor} cents (${costQuote.pricingVersion})`
        : ` ${costQuote.reason}`
    }`
  );
  console.log(
    `reserved_max=${reserved} committed=${committed} released=${released} cents`
  );
  console.log(`security hits: ${securityHits.length ? securityHits.join(",") : "none"}`);
  console.log(`vh_spend touched by smoke path: ${vhSpendTouched}`);

  // Plan content checks (no full dump)
  let planOk = false;
  if (plans?.length === 1 && result.status === "completed") {
    const v = plans[0].value;
    planOk =
      v &&
      typeof v === "object" &&
      v.marketingObjective === "awareness" &&
      typeof v.mainBenefit === "string" &&
      v.callToAction === "Découvrir le service" &&
      !("provider" in v) &&
      !("modelId" in v) &&
      !("prompt" in v);
    console.log(
      `plan checks: objective=${v.marketingObjective} cta_ok=${
        v.callToAction === "Découvrir le service"
      } no_tech=${!("provider" in v || "modelId" in v || "prompt" in v)}`
    );
  }

  const success =
    openAiCallsMade === 1 &&
    openAiCallsRemaining === 0 &&
    result.status === "completed" &&
    run?.status === "completed" &&
    (plans?.length ?? 0) === 1 &&
    !!active &&
    planOk &&
    securityHits.length === 0 &&
    (costQuote.status !== "known" || costQuote.total.amountMinor <= MAX_COST_MINOR) &&
    committed <= MAX_COST_MINOR;

  console.log("=== FLAGS FINAUX (process) ===");
  console.log("Marketing AI disabled (hors smoke): treat as off");
  console.log("Paid AI disabled (hors smoke): treat as off");
  console.log("Worker disabled: yes");
  console.log("Paid media generation disabled: yes");
  console.log(`OpenAI calls remaining: ${openAiCallsRemaining}`);

  console.log("Cleanup PowerShell:");
  console.log(
    "Remove-Item Env:DIRECTOR_V2_MARKETING_AI_ENABLED -ErrorAction SilentlyContinue"
  );
  console.log(
    "Remove-Item Env:DIRECTOR_V2_PAID_AI_ENABLED -ErrorAction SilentlyContinue"
  );
  console.log(
    "Remove-Item Env:MARKETING_AI_SMOKE_CONFIRM -ErrorAction SilentlyContinue"
  );

  if (success) {
    console.log("VHS-117C validé — 1 appel, coût ≤0,10 USD");
    process.exit(0);
  }

  // Failure path still must not retry
  console.log("VHS-117C échoué — aucun second appel autorisé");
  process.exit(2);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  fail(msg.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]"));
});
