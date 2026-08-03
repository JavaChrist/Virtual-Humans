import { createClient } from "@supabase/supabase-js";
import { E2E_SLUG_PREFIX, loadE2eRuntime } from "./runtime";

const CLEANUP_TABLES = [
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

/**
 * Delete only workspaces whose slug starts with e2e-.
 * Refuses any other target.
 */
export async function cleanupE2eWorkspace(workspaceId: string): Promise<void> {
  const runtime = loadE2eRuntime();
  const client = createClient(runtime.supabaseUrl, runtime.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("workspaces")
    .select("id, slug")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`cleanup lookup failed: ${error.message}`);
  if (!data) return;
  if (!String(data.slug).startsWith(E2E_SLUG_PREFIX)) {
    throw new Error(
      `Refus cleanup: slug "${data.slug}" ne porte pas le marqueur ${E2E_SLUG_PREFIX}`,
    );
  }
  for (const t of CLEANUP_TABLES) {
    const { error: delErr } = await client
      .from(t)
      .delete()
      .eq(t === "workspaces" ? "id" : "workspace_id", workspaceId);
    if (delErr) {
      throw new Error(`cleanup ${t}: ${delErr.message}`);
    }
  }
}

/** Best-effort cleanup of the prepared runtime workspace (after suite). */
export async function cleanupRuntimeWorkspace(): Promise<void> {
  const runtime = loadE2eRuntime();
  await cleanupE2eWorkspace(runtime.workspaceId).catch(() => undefined);
}
