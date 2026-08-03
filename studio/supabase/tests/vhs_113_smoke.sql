-- VHS-113 SQL smoke tests (pgTAP) — run only with local Supabase:
--   npx supabase test db
-- NOT executed in CI npm test. NOT applied to remote.

BEGIN;
SELECT plan(6);

SELECT has_table('public', 'workspaces', 'workspaces exists');
SELECT has_table('public', 'production_jobs', 'production_jobs exists');
SELECT has_table('public', 'cost_ledger', 'cost_ledger exists');
SELECT has_function('public', 'claim_production_jobs', 'claim rpc exists');
SELECT has_function('public', 'reserve_budget', 'reserve_budget rpc exists');

-- RLS enabled on a sample V2 table
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'video_projects'),
  'video_projects has RLS enabled'
);

SELECT * FROM finish();
ROLLBACK;
