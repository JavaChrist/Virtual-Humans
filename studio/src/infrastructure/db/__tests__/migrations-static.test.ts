/**
 * Static checks on VHS-113+ SQL migrations (no database) (VHS-113 / Porte 3 reconcile).
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

/** Production schema_migrations versions (MCP apply Porte 3), including VHS-125 remainder markers. */
const EXPECTED_FILES = [
  "20260723203021_vh_studio_init_spend_products_storage.sql",
  "20260728210808_create_vh_scenes.sql",
  "20260804134311_vhs_113_v2_core.sql",
  "20260804134410_vhs_113_v2_production_queue.sql",
  "20260804134443_vhs_113_v2_ledger_events_assets.sql",
  "20260804134500_vhs_113_v2_rls_grants.sql",
  "20260804134537_vhs_114_reschedule_payload.sql",
  "20260804134814_vhs_116_create_project_with_brief.sql",
  "20260804135019_vhs_117b_director_runs.sql",
  "20260804135045_vhs_118b_creative_director_runs.sql",
  "20260804135120_vhs_119b_script_director_runs.sql",
  "20260804135149_vhs_120b_art_director_runs.sql",
  "20260804135227_vhs_121b_storyboard_director_runs.sql",
  "20260804135342_vhs_122_prompt_director_runs.sql",
  "20260804135608_vhs_123_routing_director_runs.sql",
  "20260804135702_vhs_124_production_director.sql",
  "20260804135742_vhs_125_postproduction_delivery.sql",
  "20260804140056_vhs_125_remainder_part1.sql",
  "20260804140143_vhs_125_remainder_part2.sql",
  "20260804140225_vhs_125_remainder_part3.sql",
  "20260804140309_vhs_126_brief_revisions_stale.sql",
  "20260804140422_vhs_127_director_final_assets_bucket.sql",
  "20260804141000_vhs_128_director_run_retry_attempts.sql",
  "20260805002706_vhs_129_director_human_retryable_error_codes.sql",
  "20260805140000_vhs_130_fail_director_run_metering.sql",
  "20260805143000_vhs_131_harden_reschedule_grants.sql",
] as const;

const REMAINDER_MARKERS = [
  "20260804140056_vhs_125_remainder_part1.sql",
  "20260804140143_vhs_125_remainder_part2.sql",
  "20260804140225_vhs_125_remainder_part3.sql",
] as const;

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function v2Files(): string[] {
  return listMigrationFiles().filter((f) => f.startsWith("202608"));
}

function mutativeV2Sql(): string {
  return v2Files()
    .filter((f) => !REMAINDER_MARKERS.includes(f as (typeof REMAINDER_MARKERS)[number]))
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

test("migrations — 26 versions (23 Production-aligned + VHS-129/130/131 local)", () => {
  const files = listMigrationFiles();
  assert.deepEqual(files, [...EXPECTED_FILES]);
  assert.equal(files.length, 26);
  assert.deepEqual(
    files.filter((f) => f.startsWith("202607")),
    [...LEGACY_FILES],
  );
  assert.equal(v2Files().length, 24);
});

test("migrations V2 — VHS-129 human-retry allowlist (not auto-retry)", () => {
  const sql = readFileSync(
    join(
      MIGRATIONS_DIR,
      "20260805002706_vhs_129_director_human_retryable_error_codes.sql"
    ),
    "utf8"
  );
  assert.match(sql, /director_error_code_is_human_retryable/i);
  assert.match(sql, /invalid_structured_output/);
  assert.match(sql, /director_error_code_is_human_retryable\(v_prev\.error_code\)/);
  assert.match(sql, /delegates to director_error_code_is_human_retryable/i);
  assert.ok(!/DELETE FROM|UPDATE\s+public\.director_runs/i.test(sql));
});

test("migrations V2 — VHS-130 fail_director_run metering", () => {
  const sql = readFileSync(
    join(MIGRATIONS_DIR, "20260805140000_vhs_130_fail_director_run_metering.sql"),
    "utf8"
  );
  assert.match(sql, /p_usage jsonb DEFAULT NULL/i);
  assert.match(sql, /p_actual_cost_minor bigint DEFAULT NULL/i);
  assert.match(sql, /director_budget_fail_commit/i);
  assert.match(sql, /director_budget_fail_release_remainder/i);
  assert.match(sql, /actual_cost_exceeds_reservation/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.fail_director_run[\s\S]*FROM PUBLIC, anon, authenticated/i);
  assert.ok(!/DELETE FROM\s+public\.director_runs/i.test(sql));
});

test("migrations V2 — VHS-114 stays canonical; VHS-131 hardens reschedule grants", () => {
  // VHS-114 is already applied in Production — never rewrite its grants.
  const vhs114 = readFileSync(
    join(MIGRATIONS_DIR, "20260804134537_vhs_114_reschedule_payload.sql"),
    "utf8"
  );
  assert.match(
    vhs114,
    /REVOKE ALL ON FUNCTION public\.reschedule_production_job\(uuid, uuid, text, timestamptz, jsonb\) FROM PUBLIC;/i
  );
  assert.ok(
    !/FROM PUBLIC,\s*anon,\s*authenticated/i.test(vhs114),
    "VHS-114 must not be rewritten with anon/authenticated revoke"
  );
  // Additive fix lives only in VHS-131 (idempotent).
  const vhs131 = readFileSync(
    join(MIGRATIONS_DIR, "20260805143000_vhs_131_harden_reschedule_grants.sql"),
    "utf8"
  );
  assert.match(
    vhs131,
    /REVOKE ALL ON FUNCTION public\.reschedule_production_job[\s\S]*FROM PUBLIC, anon, authenticated/i
  );
  assert.match(vhs131, /GRANT EXECUTE[\s\S]*TO service_role/i);
});

test("migrations VHS-125 remainder — marqueurs no-op documentés sans SQL mutatif dupliqué", () => {
  for (const f of REMAINDER_MARKERS) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    assert.match(sql, /HISTORICAL NO-OP MARKER/i);
    assert.match(sql, /21_VHS_125_REMOTE_MIGRATION_INCIDENT\.md/);
    assert.match(sql, /SHA-256/i);
    assert.match(sql, /DO \$vhs_125_remainder_part/);
    assert.ok(!/^\s*CREATE TABLE/im.test(sql));
    assert.ok(!/^\s*CREATE OR REPLACE FUNCTION/im.test(sql));
    assert.ok(!/^\s*ALTER TABLE/im.test(sql));
    assert.ok(!/^\s*GRANT\b/im.test(sql));
    assert.ok(!/^\s*REVOKE\b/im.test(sql));
    assert.match(sql, /BEGIN\s*\n\s*NULL;\s*\n\s*END/i);
  }
  const vhs125 = readFileSync(
    join(MIGRATIONS_DIR, "20260804135742_vhs_125_postproduction_delivery.sql"),
    "utf8",
  );
  assert.match(vhs125, /PLACEHOLDER_CONTINUE|HISTORY NOTE/i);
  assert.match(vhs125, /begin_or_get_quality_director_run/i);
  assert.match(vhs125, /persist_export_package/i);
});

test("migrations V2 — tables et RPC requis présents", () => {
  const sql = mutativeV2Sql();
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
  assert.match(sql, /begin_or_retry_director_run/i);
  assert.match(sql, /attempt_number/i);
  assert.match(sql, /retry_request_id/i);
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
  assert.ok(!/CREATE TABLE\s+public\.vh_spend/i.test(sql));
  assert.ok(!/CREATE TABLE\s+public\.vh_products/i.test(sql));
  assert.ok(!/CREATE TABLE\s+public\.vh_scenes/i.test(sql));
  assert.ok(!/DROP TABLE\s+.*vh_/i.test(sql));
});

test("migrations V2 — VHS-125 postproduction delivery RPCs et table présents", () => {
  const sql = mutativeV2Sql();
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
  const sql = mutativeV2Sql();
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
  const sql = mutativeV2Sql();
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
