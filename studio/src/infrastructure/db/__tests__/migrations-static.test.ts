/**
 * Static checks on VHS-113 SQL migrations (no database) (VHS-113).
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function allSql(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8")).join("\n");
}

test("migrations V2 — timestamps après historique distant + pas de recreate vh_*", () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.length >= 4);
  for (const f of files) {
    assert.match(f, /^2026080[23]/);
  }
  const sql = allSql();
  assert.ok(!/CREATE TABLE\s+public\.vh_spend/i.test(sql));
  assert.ok(!/CREATE TABLE\s+public\.vh_products/i.test(sql));
  assert.ok(!/CREATE TABLE\s+public\.vh_scenes/i.test(sql));
  assert.ok(!/DROP TABLE\s+.*vh_/i.test(sql));
});

test("migrations V2 — tables et RPC requis présents", () => {
  const sql = allSql();
  for (const table of [
    "workspaces",
    "video_projects",
    "project_artifacts",
    "active_artifact_revisions",
    "artifact_approvals",
    "storyboard_scenes",
    "generation_plans",
    "production_runs",
    "production_jobs",
    "generation_attempts",
    "cost_ledger",
    "budget_reservations",
    "idempotency_records",
    "domain_events",
    "assets",
    "audit_log",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table}`, "i"));
  }
  for (const fn of [
    "claim_production_jobs",
    "heartbeat_production_job",
    "complete_production_job",
    "fail_production_job",
    "release_production_job",
    "reschedule_production_job",
    "reserve_budget",
    "commit_budget_reservation",
    "release_budget_reservation",
    "idempotency_begin",
    "set_active_artifact_revision",
  ]) {
    assert.match(sql, new RegExp(`FUNCTION public\\.${fn}`, "i"));
  }
  assert.match(sql, /FOR UPDATE SKIP LOCKED/i);
  assert.match(sql, /SECURITY DEFINER/i);
  assert.match(sql, /SET search_path = public/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION/i);
  assert.match(sql, /GRANT EXECUTE.*TO service_role/i);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE/i);
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*FROM anon, authenticated/i);
  assert.match(sql, /cost_ledger is append-only/i);
  assert.match(sql, /project_artifacts are append-only/i);
  assert.match(sql, /reschedule_production_job/i);
  assert.match(sql, /begin_or_get_prompt_director_run/i);
  assert.match(sql, /persist_scene_package_set/i);
  assert.match(sql, /scene_package_set/i);
});
