/**
 * Local Supabase integration harness (VHS-115).
 * Never logs secrets. Never uses remote URLs.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  resolveLocalSupabaseGate,
  type LocalSupabaseGate,
} from "./local-integration.gate";
import {
  createSupabaseProjectRepository,
  createSupabaseArtifactRepository,
  createSupabaseProductionRunStore,
  createSupabaseAssetRepository,
  createSupabaseProductionJobQueue,
  createSupabaseBudgetReservationPort,
  createSupabaseProductionIdempotencyPort,
  createSupabaseProductionEventPort,
  createStaticPlanResolver,
} from "./index";
import {
  createProductionRun,
  DEFAULT_PRODUCTION_POLICY,
  withRunUpdate,
} from "@/domain/production";
import { makePlan } from "@/domain/production/__tests__/fixtures";
import { money } from "@/domain/cost";

export type IntegrationCtx = {
  gate: Extract<LocalSupabaseGate, { ok: true }>;
  client: SupabaseClient;
  clientB: SupabaseClient;
  workspaceId: string;
  projectId: string;
  planArtifactId: string;
  planDomainId: string;
  cleanupIds: {
    workspaceId: string;
  };
};

function requireGate(): Extract<LocalSupabaseGate, { ok: true }> {
  const gate = resolveLocalSupabaseGate();
  if (!gate.ok) {
    throw new Error(`VHS-115 gate failed: ${gate.reason}`);
  }
  return gate;
}

export function createLocalClients(gate = requireGate()): {
  client: SupabaseClient;
  clientB: SupabaseClient;
  gate: Extract<LocalSupabaseGate, { ok: true }>;
} {
  const opts = {
    auth: { persistSession: false, autoRefreshToken: false },
  } as const;
  return {
    gate,
    client: createClient(gate.url, gate.serviceRoleKey, opts),
    // Second independent client for real concurrency
    clientB: createClient(gate.url, gate.serviceRoleKey, opts),
  };
}

/** Create isolated workspace + project + generation_plan artifact. */
export async function bootstrapWorkspace(
  client: SupabaseClient,
  opts?: { hardLimitMinor?: number }
): Promise<{
  workspaceId: string;
  projectId: string;
  planArtifactId: string;
  planDomainId: string;
}> {
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const planArtifactId = randomUUID();
  const planDomainId = `plan-${planArtifactId.slice(0, 8)}`;
  const slug = `it-${workspaceId.slice(0, 8)}`;

  const { error: wErr } = await client.from("workspaces").insert({
    id: workspaceId,
    slug,
    name: `IT ${slug}`,
    mode: "single_workspace",
  });
  if (wErr) throw new Error(`workspace insert: ${wErr.message}`);

  const { error: bErr } = await client.from("workspace_budget_policies").insert({
    workspace_id: workspaceId,
    hard_limit_minor: opts?.hardLimitMinor ?? 10_000,
    currency: "USD",
  });
  if (bErr) throw new Error(`budget policy: ${bErr.message}`);

  const { error: pErr } = await client.from("video_projects").insert({
    id: projectId,
    workspace_id: workspaceId,
    name: "Integration Project",
    status: "draft",
    active_revision: 1,
    schema_version: "1.0.0",
    correlation_id: `corr-${workspaceId.slice(0, 8)}`,
  });
  if (pErr) throw new Error(`project insert: ${pErr.message}`);

  const { error: aErr } = await client.from("project_artifacts").insert({
    id: planArtifactId,
    workspace_id: workspaceId,
    project_id: projectId,
    artifact_type: "generation_plan",
    revision: 1,
    schema_version: "1.0.0",
    parent_revision_id: null,
    value: { id: planDomainId, revision: 1 },
    created_by: "integration",
    correlation_id: `corr-${workspaceId.slice(0, 8)}`,
  });
  if (aErr) throw new Error(`artifact insert: ${aErr.message}`);

  return { workspaceId, projectId, planArtifactId, planDomainId };
}

/**
 * Best-effort cleanup for one workspace (children via FK cascade where present).
 * Does not DROP tables.
 */
export async function cleanupWorkspace(
  client: SupabaseClient,
  workspaceId: string
): Promise<void> {
  // Order: leaf → root (FKs without ON DELETE CASCADE on all tables)
  const tables = [
    "audit_log",
    "domain_events",
    "human_review_decisions",
    "assets",
    "idempotency_records",
    "budget_reservations",
    "cost_ledger",
    "generation_attempts",
    "production_jobs",
    "production_runs",
    "generation_plans",
    "storyboard_scenes",
    "artifact_approvals",
    "director_runs",
    "active_artifact_revisions",
    "project_artifacts",
    "video_projects",
    "workspace_budget_policies",
    "workspaces",
  ] as const;
  for (const t of tables) {
    await client.from(t).delete().eq("workspace_id", workspaceId);
  }
}

export function reposFor(client: SupabaseClient, workspaceId: string, planMap: Map<string, { artifactId: string; revision: number }>) {
  const resolvePlan = createStaticPlanResolver(planMap);
  return {
    projects: createSupabaseProjectRepository({ client, workspaceId }),
    artifacts: createSupabaseArtifactRepository({ client, workspaceId }),
    runs: createSupabaseProductionRunStore({
      client,
      workspaceId,
      resolvePlanArtifactId: resolvePlan,
    }),
    assets: createSupabaseAssetRepository({ client, workspaceId }),
    queue: createSupabaseProductionJobQueue({ client, workspaceId }),
    budget: createSupabaseBudgetReservationPort({
      client,
      workspaceId,
      resolveProjectIdForRun: async (runId) => {
        const { data } = await client
          .from("production_runs")
          .select("project_id")
          .eq("id", runId)
          .maybeSingle();
        if (!data?.project_id) throw new Error("run project missing");
        return data.project_id as string;
      },
      correlationId: "integration-corr-01",
    }),
    idempotency: createSupabaseProductionIdempotencyPort({
      client,
      workspaceId,
      resolveProjectId: async () => {
        const { data } = await client
          .from("video_projects")
          .select("id")
          .eq("workspace_id", workspaceId)
          .limit(1)
          .maybeSingle();
        if (!data?.id) throw new Error("project missing");
        return data.id as string;
      },
    }),
    events: createSupabaseProductionEventPort({ client, workspaceId }),
  };
}

export function makeDomainRun(input: {
  runId: string;
  projectId: string;
  planDomainId: string;
}) {
  const plan = makePlan({
    id: input.planDomainId,
    projectId: input.projectId,
    estimatedCost: money(50, "USD"),
  });
  return createProductionRun({
    id: input.runId,
    projectId: input.projectId,
    plan,
    policy: DEFAULT_PRODUCTION_POLICY,
    createdAt: "2026-08-02T12:00:00.000Z",
    correlationId: "corr-integration-01",
  });
}

export { withRunUpdate, money, randomUUID };
