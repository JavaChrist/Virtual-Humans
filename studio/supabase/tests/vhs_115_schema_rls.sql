-- VHS-115 — schema, RLS, grants (pgTAP). Local only.
BEGIN;
SELECT plan(53);

SELECT has_table('public', 'workspaces', 'workspaces');
SELECT has_table('public', 'workspace_budget_policies', 'workspace_budget_policies');
SELECT has_table('public', 'video_projects', 'video_projects');
SELECT has_table('public', 'project_artifacts', 'project_artifacts');
SELECT has_table('public', 'active_artifact_revisions', 'active_artifact_revisions');
SELECT has_table('public', 'artifact_approvals', 'artifact_approvals');
SELECT has_table('public', 'storyboard_scenes', 'storyboard_scenes');
SELECT has_table('public', 'generation_plans', 'generation_plans');
SELECT has_table('public', 'production_runs', 'production_runs');
SELECT has_table('public', 'production_jobs', 'production_jobs');
SELECT has_table('public', 'generation_attempts', 'generation_attempts');
SELECT has_table('public', 'cost_ledger', 'cost_ledger');
SELECT has_table('public', 'budget_reservations', 'budget_reservations');
SELECT has_table('public', 'idempotency_records', 'idempotency_records');
SELECT has_table('public', 'domain_events', 'domain_events');
SELECT has_table('public', 'assets', 'assets');
SELECT has_table('public', 'audit_log', 'audit_log');

SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='workspaces'), 'RLS workspaces');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='workspace_budget_policies'), 'RLS budget policies');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='video_projects'), 'RLS video_projects');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='project_artifacts'), 'RLS artifacts');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='active_artifact_revisions'), 'RLS active revisions');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='artifact_approvals'), 'RLS approvals');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='storyboard_scenes'), 'RLS storyboard');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='generation_plans'), 'RLS generation_plans');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='production_runs'), 'RLS runs');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='production_jobs'), 'RLS jobs');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='generation_attempts'), 'RLS attempts');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='cost_ledger'), 'RLS ledger');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='budget_reservations'), 'RLS reservations');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='idempotency_records'), 'RLS idempotency');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='domain_events'), 'RLS events');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='assets'), 'RLS assets');
SELECT ok((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='audit_log'), 'RLS audit');

SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename IN (
    'workspaces','video_projects','production_jobs','cost_ledger'
  )),
  0,
  'no RLS policies on sample V2 tables'
);

SELECT ok(has_table_privilege('service_role', 'public.workspaces', 'SELECT'), 'service_role SELECT workspaces');
SELECT ok(has_table_privilege('service_role', 'public.production_jobs', 'INSERT'), 'service_role INSERT jobs');
SELECT ok(has_table_privilege('service_role', 'public.cost_ledger', 'SELECT'), 'service_role SELECT ledger');
SELECT ok(NOT has_table_privilege('anon', 'public.workspaces', 'SELECT'), 'anon no SELECT');
SELECT ok(NOT has_table_privilege('authenticated', 'public.workspaces', 'SELECT'), 'auth no SELECT');

SELECT has_function('public', 'claim_production_jobs', 'claim fn');
SELECT has_function('public', 'reschedule_production_job', 'reschedule fn');
SELECT has_function('public', 'reserve_budget', 'reserve fn');
SELECT has_function('public', 'idempotency_begin', 'idempotency fn');

SELECT ok(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='claim_production_jobs' LIMIT 1),
  'claim SECURITY DEFINER'
);
SELECT ok(
  (SELECT EXISTS (
     SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
     WHERE cfg ILIKE 'search_path%=%public%'
   ) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='claim_production_jobs' LIMIT 1),
  'claim search_path'
);
SELECT ok(
  has_function_privilege('service_role', 'public.claim_production_jobs(text,integer,integer)', 'EXECUTE'),
  'service_role execute claim'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.claim_production_jobs(text,integer,integer)', 'EXECUTE'),
  'anon no execute claim'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.reschedule_production_job(uuid,uuid,text,timestamptz,jsonb)', 'EXECUTE'),
  'auth no execute reschedule'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='production_jobs_unique_attempt'),
  'jobs unique attempt'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='project_artifacts_unique_rev'),
  'artifacts unique rev'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cost_ledger_idem_unique'),
  'ledger idem unique'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    JOIN pg_class frel ON frel.oid = c.confrelid
    JOIN pg_namespace fn ON fn.oid = frel.relnamespace
    WHERE n.nspname='public' AND fn.nspname='public'
      AND rel.relname IN ('workspaces','video_projects','production_jobs','cost_ledger')
      AND frel.relname LIKE 'vh_%'
  ),
  'no FK from V2 to vh_*'
);

SELECT * FROM finish();
ROLLBACK;
