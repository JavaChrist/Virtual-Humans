/**
 * Static checks on VHS-113 SQL migrations (no database) (VHS-113).
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const LEGACY_FILES = [
  "20260723203021_vh_studio_init_spend_products_storage.sql",
  "20260728210808_create_vh_scenes.sql",
] as const;

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function v2Files(): string[] {
  return listMigrationFiles().filter((f) => f.startsWith("202608"));
}

function v2Sql(): string {
  return v2Files()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

test("migrations — legacy exactes + 17 V2 après historique distant", () => {
  const files = listMigrationFiles();
  assert.deepEqual(
    files.filter((f) => f.startsWith("202607")),
    [...LEGACY_FILES],
  );
  const v2 = v2Files();
  assert.equal(v2.length, 17);
  for (const f of v2) {
    assert.match(f, /^2026080[234]/);
  }
  assert.equal(files.length, 19);
  const sql = v2Sql();
  assert.ok(!/CREATE TABLE\s+public\.vh_spend/i.test(sql));
  assert.ok(!/CREATE TABLE\s+public\.vh_products/i.test(sql));
  assert.ok(!/CREATE TABLE\s+public\.vh_scenes/i.test(sql));
  assert.ok(!/DROP TABLE\s+.*vh_/i.test(sql));
});

test("migrations V2 — tables et RPC requis présents", () => {
  const sql = v2Sql();
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
  assert.match(sql, /begin_or_get_routing_director_run/i);
  assert.match(sql, /persist_generation_plan/i);
  assert.match(sql, /persist_artifact_approval/i);
  assert.match(sql, /director_type IN \([\s\S]*'routing'/i);
  assert.match(sql, /begin_or_get_production_director_run/i);
  assert.match(sql, /complete_production_director_run/i);
  assert.match(sql, /director_type IN \([\s\S]*'production'/i);
  assert.match(sql, /input_artifact_type IN \([\s\S]*'generation_plan'/i);
});

test("migrations V2 — VHS-125 postproduction delivery RPCs et table présents", () => {
  const sql = v2Sql();
  assert.match(sql, /CREATE TABLE public\.human_review_decisions/i);
  assert.match(sql, /human_review_decisions are append-only/i);
  for (const fn of [
    "persist_production_result",
    "begin_or_get_quality_director_run",
    "persist_quality_report",
    "persist_human_review_decision",
    "begin_or_get_merge_director_run",
    "persist_merge_outcome",
    "begin_or_get_export_director_run",
    "persist_export_package",
  ]) {
    assert.match(sql, new RegExp(`FUNCTION public\\.${fn}`, "i"));
  }
  assert.match(sql, /director_type IN \([\s\S]*'quality'[\s\S]*'merge'[\s\S]*'export'/i);
  assert.match(sql, /artifact_type IN \([\s\S]*'quality_report'[\s\S]*'merge_plan'[\s\S]*'export_package'/i);
  assert.match(sql, /input_artifact_type IN \([\s\S]*'production_result'[\s\S]*'quality_report'[\s\S]*'merge_plan'/i);
  assert.match(sql, /decision text NOT NULL/i);
  assert.match(sql, /CHECK \(decision IN \('approved', 'rejected'\)\)/i);
});

test("migrations V2 — VHS-126 brief revisions + stale columns/RPCs", () => {
  const sql = v2Sql();
  assert.match(sql, /ADD COLUMN IF NOT EXISTS stale boolean/i);
  assert.match(sql, /stale_reason/i);
  assert.match(sql, /stale_caused_by_artifact_id/i);
  assert.match(sql, /stale_source_revision/i);
  for (const fn of [
    "revise_project_brief",
    "clear_active_artifact_stale",
    "list_project_stale_artifacts",
  ]) {
    assert.match(sql, new RegExp(`FUNCTION public\\.${fn}`, "i"));
  }
  assert.match(sql, /upstream_brief_revised/i);
  assert.match(sql, /director\.brief\.revised/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.revise_project_brief/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.revise_project_brief/i);
});

test("migrations V2 — VHS-127 director-final-assets bucket privé", () => {
  const sql = v2Sql();
  assert.match(sql, /director-final-assets/);
  assert.match(sql, /INSERT INTO storage\.buckets/i);
  assert.match(sql, /file_size_limit/);
  assert.match(sql, /52428800/);
  assert.match(sql, /allowed_mime_types/);
  assert.match(sql, /ON CONFLICT \(id\) DO UPDATE/i);
  assert.match(sql, /public = EXCLUDED\.public|public = false/i);
  assert.ok(!/DROP BUCKET/i.test(sql));
  assert.ok(!/product-screens/.test(sql) || !/DELETE FROM storage\.buckets.*product-screens/i.test(sql));
});

test("migrations legacy — SQL idempotent sans DROP destructif", () => {
  for (const f of LEGACY_FILES) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    assert.match(sql, /create table if not exists/i);
    assert.ok(!/DROP TABLE/i.test(sql));
    assert.ok(!/TRUNCATE/i.test(sql));
    assert.ok(!/DELETE FROM/i.test(sql));
  }
  const init = readFileSync(join(MIGRATIONS_DIR, LEGACY_FILES[0]), "utf8");
  assert.match(init, /vh_spend/);
  assert.match(init, /vh_products/);
  assert.match(init, /product-screens/);
  const scenes = readFileSync(join(MIGRATIONS_DIR, LEGACY_FILES[1]), "utf8");
  assert.match(scenes, /vh_scenes/);
});
