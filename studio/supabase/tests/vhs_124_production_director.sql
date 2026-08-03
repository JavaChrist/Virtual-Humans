-- VHS-124 — production director RPCs (pgTAP).
BEGIN;
SELECT plan(17);

SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'director_runs_type_check'
    AND pg_get_constraintdef(oid) LIKE '%production%'
), 'director_runs permits production');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'director_runs_input_type_check'
    AND pg_get_constraintdef(oid) LIKE '%generation_plan%'
), 'director_runs permits generation_plan input');

SELECT ok(has_function_privilege(
  'service_role',
  'public.begin_or_get_production_director_run(uuid,uuid,uuid,uuid,integer,text,text,text)',
  'EXECUTE'
), 'service role can begin production');

SELECT ok(NOT has_function_privilege(
  'anon',
  'public.begin_or_get_production_director_run(uuid,uuid,uuid,uuid,integer,text,text,text)',
  'EXECUTE'
), 'anon cannot begin production');

SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.complete_production_director_run(uuid,uuid,uuid,uuid,integer,text,text,text)',
  'EXECUTE'
), 'authenticated cannot complete production');

SELECT ok(has_function_privilege(
  'service_role',
  'public.complete_production_director_run(uuid,uuid,uuid,uuid,integer,text,text,text)',
  'EXECUTE'
), 'service role can complete production');

INSERT INTO public.workspaces (id, slug, name)
VALUES ('a124a124-a124-4124-8124-a124a124a124', 'sql-124', 'SQL 124');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a124a124-a124-4124-8124-a124a124a124', 100000, 'USD');
INSERT INTO public.video_projects (id, workspace_id, name, status, active_revision, schema_version, correlation_id)
VALUES (
  'b124b124-b124-4124-8124-b124b124b124',
  'a124a124-a124-4124-8124-a124a124a124',
  'P124', 'draft', 1, '1.0.0', 'corr-124'
);
INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_by, correlation_id
) VALUES (
  'c124c124-c124-4124-8124-c124c124c124',
  'a124a124-a124-4124-8124-a124a124a124',
  'b124b124-b124-4124-8124-b124b124b124',
  'generation_plan', 1, '1.0.0',
  '{"artifactType":"generation_plan","scenePlans":[{"sceneId":"sc-1"}]}',
  'tester', 'corr-124'
);
INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a124a124-a124-4124-8124-a124a124a124',
  'b124b124-b124-4124-8124-b124b124b124',
  'generation_plan',
  'c124c124-c124-4124-8124-c124c124c124',
  1, 'tester'
);

SELECT is((
  SELECT public.begin_or_get_production_director_run(
    '11111124-1111-4124-8124-111111241124',
    'a124a124-a124-4124-8124-a124a124a124',
    'b124b124-b124-4124-8124-b124b124b124',
    'c124c124-c124-4124-8124-c124c124c124',
    1,
    'prd-key-124-001',
    'fingerprint124001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'corr-124'
  )->>'status'
), 'created', 'begin production created');

SELECT is((
  SELECT cost_status FROM public.director_runs WHERE id = '11111124-1111-4124-8124-111111241124'
), 'none', 'production begin has cost_status none');

SELECT is((
  SELECT provider_id FROM public.director_runs WHERE id = '11111124-1111-4124-8124-111111241124'
), 'deterministic', 'production begin uses deterministic provider');

SELECT is((
  SELECT count(*)::int FROM public.budget_reservations
  WHERE project_id = 'b124b124-b124-4124-8124-b124b124b124'
), 0, 'no budget reservation on begin');

SELECT is((
  SELECT public.begin_or_get_production_director_run(
    '41114124-4111-4124-8124-411141244124',
    'a124a124-a124-4124-8124-a124a124a124',
    'b124b124-b124-4124-8124-b124b124b124',
    'c124c124-c124-4124-8124-c124c124c124',
    1,
    'prd-key-124-001',
    'fingerprint124001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'corr-124'
  )->>'status'
), 'already_running', 'idempotent begin already_running while pending');

-- Minimal production_run row for FK on domain_events.run_id (nullable but we set it).
INSERT INTO public.production_runs (
  id, workspace_id, project_id, generation_plan_artifact_id, generation_plan_revision,
  status, revision, policy_version, estimated_cost_minor, committed_cost_minor, released_cost_minor,
  currency, correlation_id, state
) VALUES (
  'd124d124-d124-4124-8124-d124d124d124',
  'a124a124-a124-4124-8124-a124a124a124',
  'b124b124-b124-4124-8124-b124b124b124',
  'c124c124-c124-4124-8124-c124c124c124',
  1, 'running', 1, 'vhs-110.1', 100, 0, 0, 'USD', 'corr-124',
  '{"id":"d124d124-d124-4124-8124-d124d124d124","status":"running"}'::jsonb
);

SELECT is((
  SELECT public.complete_production_director_run(
    '11111124-1111-4124-8124-111111241124',
    'a124a124-a124-4124-8124-a124a124a124',
    'b124b124-b124-4124-8124-b124b124b124',
    'd124d124-d124-4124-8124-d124d124d124',
    1, 'corr-124', 'shared_password', 'tester'
  )->>'status'
), 'created', 'complete production created');

SELECT is((
  SELECT status FROM public.director_runs WHERE id = '11111124-1111-4124-8124-111111241124'
), 'completed', 'director run completed');

SELECT is((
  SELECT output_artifact_id IS NULL
  FROM public.director_runs WHERE id = '11111124-1111-4124-8124-111111241124'
), true, 'output_artifact_id left NULL');

SELECT is((
  SELECT count(*)::int FROM public.budget_reservations
  WHERE project_id = 'b124b124-b124-4124-8124-b124b124b124'
), 0, 'no budget reservation on complete');

SELECT is((
  SELECT count(*)::int FROM public.audit_log
  WHERE project_id = 'b124b124-b124-4124-8124-b124b124b124'
    AND action = 'director.production.completed'
), 1, 'audit production completed');

SELECT is((
  SELECT public.begin_or_get_production_director_run(
    '51115124-5111-4124-8124-511151245124',
    'a124a124-a124-4124-8124-a124a124a124',
    'b124b124-b124-4124-8124-b124b124b124',
    'c124c124-c124-4124-8124-c124c124c124',
    1,
    'prd-key-124-001',
    'fingerprint124001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'corr-124'
  )->>'status'
), 'existing', 'idempotent begin existing after complete');

SELECT * FROM finish();
ROLLBACK;
