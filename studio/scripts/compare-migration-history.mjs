/**
 * Phase 10A-B — compare local migration versions/names to known Production list.
 * Read-only. No network. Update KNOWN_PRODUCTION when Production history changes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Exact list from MCP list_migrations ejdbksxaswhdtsudnmvi (Phase 10A / 10A-B). */
const KNOWN_PRODUCTION = [
  ["20260723203021", "vh_studio_init_spend_products_storage"],
  ["20260728210808", "create_vh_scenes"],
  ["20260804134311", "vhs_113_v2_core"],
  ["20260804134410", "vhs_113_v2_production_queue"],
  ["20260804134443", "vhs_113_v2_ledger_events_assets"],
  ["20260804134500", "vhs_113_v2_rls_grants"],
  ["20260804134537", "vhs_114_reschedule_payload"],
  ["20260804134814", "vhs_116_create_project_with_brief"],
  ["20260804135019", "vhs_117b_director_runs"],
  ["20260804135045", "vhs_118b_creative_director_runs"],
  ["20260804135120", "vhs_119b_script_director_runs"],
  ["20260804135149", "vhs_120b_art_director_runs"],
  ["20260804135227", "vhs_121b_storyboard_director_runs"],
  ["20260804135342", "vhs_122_prompt_director_runs"],
  ["20260804135608", "vhs_123_routing_director_runs"],
  ["20260804135702", "vhs_124_production_director"],
  ["20260804135742", "vhs_125_postproduction_delivery"],
  ["20260804140056", "vhs_125_remainder_part1"],
  ["20260804140143", "vhs_125_remainder_part2"],
  ["20260804140225", "vhs_125_remainder_part3"],
  ["20260804140309", "vhs_126_brief_revisions_stale"],
  ["20260804140422", "vhs_127_director_final_assets_bucket"],
  ["20260804141000", "vhs_128_director_run_retry_attempts"],
  ["20260805002706", "vhs_129_director_human_retryable_error_codes"],
  ["20260805140000", "vhs_130_fail_director_run_metering"],
  ["20260805143000", "vhs_131_harden_reschedule_grants"],
  ["20260806120000", "vhs_132_director_success_commit_remainder"],
  ["20260807213624", "vhs_133_art_human_retry_input_artifact"],
  ["20260807213803", "vhs_134_legacy_art_timeout_retry"],
];

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);
const local = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => {
    const m = f.match(/^(\d+)_(.+)\.sql$/);
    if (!m) throw new Error(`Unexpected migration filename: ${f}`);
    return [m[1], m[2], f];
  });

const prodKey = (v, n) => `${v}::${n}`;
const localMap = new Map(local.map(([v, n, f]) => [prodKey(v, n), f]));
const prodMap = new Map(KNOWN_PRODUCTION.map(([v, n]) => [prodKey(v, n), true]));

let drift = 0;
for (const [v, n] of KNOWN_PRODUCTION) {
  const k = prodKey(v, n);
  if (!localMap.has(k)) {
    console.log(`MISSING_LOCAL | ${v} | ${n}`);
    drift++;
  } else {
    console.log(`MATCH | ${v} | ${n}`);
  }
}
for (const [v, n] of local) {
  const k = prodKey(v, n);
  if (!prodMap.has(k)) {
    console.log(`LOCAL_ONLY | ${v} | ${n}`);
    drift++;
  }
}

console.log(`local_count=${local.length}`);
console.log(`production_count=${KNOWN_PRODUCTION.length}`);
console.log(drift === 0 ? "HISTORY_ALIGNED=YES" : `HISTORY_ALIGNED=NO drift=${drift}`);
process.exit(drift === 0 ? 0 : 1);
