-- MT-005 — human_review_decisions.decision allowlist extension (pgTAP).
BEGIN;
SELECT plan(8);

SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'human_review_decisions_decision_check'
    AND pg_get_constraintdef(oid) LIKE '%retry_same_reference%'
    AND pg_get_constraintdef(oid) LIKE '%retry_updated_constraints%'
    AND pg_get_constraintdef(oid) LIKE '%request_new_reference%'
), 'human_review_decisions_decision_check includes Motion retry intents');

SELECT ok(has_function_privilege(
  'service_role',
  'public.persist_human_review_decision(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text,jsonb,text,text,text,text,jsonb,uuid,integer)',
  'EXECUTE'
), 'service_role can persist_human_review_decision after MT-005');

SELECT ok(NOT has_function_privilege(
  'anon',
  'public.persist_human_review_decision(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text,jsonb,text,text,text,text,jsonb,uuid,integer)',
  'EXECUTE'
), 'anon cannot persist_human_review_decision after MT-005');

-- Fixture
INSERT INTO public.workspaces (id, slug, name)
VALUES ('a005a005-a005-4005-8005-a005a005a005', 'sql-mt005', 'SQL MT005');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a005a005-a005-4005-8005-a005a005a005', 100000, 'USD');
INSERT INTO public.video_projects (id, workspace_id, name, status, active_revision, schema_version, correlation_id)
VALUES (
  'b005b005-b005-4005-8005-b005b005b005',
  'a005a005-a005-4005-8005-a005a005a005',
  'PMT005', 'draft', 1, '1.0.0', 'corr-mt005'
);
INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_by, correlation_id
) VALUES (
  'e005e005-e005-4005-8005-e005e005e005',
  'a005a005-a005-4005-8005-a005a005a005',
  'b005b005-b005-4005-8005-b005b005b005',
  'generation_plan', 1, '1.0.0', '{"ok":true}'::jsonb, 'tester', 'corr-mt005'
);
INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
) VALUES (
  'a005a005-a005-4005-8005-a005a005a005',
  'b005b005-b005-4005-8005-b005b005b005',
  'generation_plan', 'e005e005-e005-4005-8005-e005e005e005', 1, timezone('utc', now()), 'tester'
);
INSERT INTO public.production_runs (
  id, workspace_id, project_id, generation_plan_artifact_id, generation_plan_revision,
  status, revision, policy_version, estimated_cost_minor, committed_cost_minor, released_cost_minor,
  currency, correlation_id, state
) VALUES (
  'd005d005-d005-4005-8005-d005d005d005',
  'a005a005-a005-4005-8005-a005a005a005',
  'b005b005-b005-4005-8005-b005b005b005',
  'e005e005-e005-4005-8005-e005e005e005',
  1, 'completed', 1, 'vhs-110.1', 100, 100, 0, 'USD', 'corr-mt005',
  '{"id":"d005d005-d005-4005-8005-d005d005d005","status":"completed"}'::jsonb
);

SELECT is((
  SELECT public.persist_production_result(
    'a005a005-a005-4005-8005-a005a005a005',
    'b005b005-b005-4005-8005-b005b005b005',
    'c0050001-0001-4005-8005-c00500010001',
    'd005d005-d005-4005-8005-d005d005d005',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d005d005-d005-4005-8005-d005d005d005"},"delivery":{"status":"not_started"}}'::jsonb,
    '1.1.0', 'corr-mt005', 'tester', 'shared_password', 'tester', 0
  )->>'status'
), 'created', 'mt005 fixture production_result');

SELECT is((
  SELECT public.begin_or_get_quality_director_run(
    '11150005-1111-4005-8005-111150005555',
    'a005a005-a005-4005-8005-a005a005a005',
    'b005b005-b005-4005-8005-b005b005b005',
    'c0050001-0001-4005-8005-c00500010001',
    1, 'qc-key-mt005-001', 'fingerprintmt00501aaaaaaaaaaaaaaaaaaaaaaaaa', 'corr-mt005'
  )->>'status'
), 'created', 'mt005 begin quality run');

SELECT is((
  SELECT public.persist_quality_report(
    '11150005-1111-4005-8005-111150005555',
    'a005a005-a005-4005-8005-a005a005a005',
    'b005b005-b005-4005-8005-b005b005b005',
    'c0050003-0003-4005-8005-c00500030003',
    'c0050001-0001-4005-8005-c00500010001',
    1,
    '{"status":"needs_review","blockingIssues":[],"warnings":[]}'::jsonb,
    '1.0.0',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d005d005-d005-4005-8005-d005d005d005"},"delivery":{"status":"quality_review"}}'::jsonb,
    'c0050004-0004-4005-8005-c00500040004',
    'corr-mt005', 'tester', 'shared_password', 'tester', 1
  )->>'status'
), 'created', 'mt005 persist quality report');

SELECT is((
  SELECT public.persist_human_review_decision(
    '21150005-2111-4005-8005-211150005555',
    'a005a005-a005-4005-8005-a005a005a005',
    'b005b005-b005-4005-8005-b005b005b005',
    'c0050003-0003-4005-8005-c00500030003', 1,
    'c0050004-0004-4005-8005-c00500040004', 2,
    'retry_same_reference', 'retry motion', '[]'::jsonb,
    'review-key-mt005-001', 'corr-mt005', 'shared_password', 'tester',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d005d005-d005-4005-8005-d005d005d005"},"delivery":{"status":"quality_review"}}'::jsonb,
    'c0050005-0005-4005-8005-c00500050005', 2
  )->>'status'
), 'created', 'persist_human_review_decision accepts retry_same_reference');

SELECT throws_ok(
  $$SELECT public.persist_human_review_decision(
    '21150009-2111-4005-8005-211150009999',
    'a005a005-a005-4005-8005-a005a005a005',
    'b005b005-b005-4005-8005-b005b005b005',
    'c0050003-0003-4005-8005-c00500030003', 1,
    'c0050005-0005-4005-8005-c00500050005', 3,
    'request_changes', NULL, '[]'::jsonb,
    NULL, 'corr-mt005', 'shared_password', 'tester',
    '{"delivery":{"status":"quality_review"}}'::jsonb,
    'c0050099-0099-4005-8005-c00500990099', 3
  )$$,
  'P0001', 'invalid_review_decision',
  'persist_human_review_decision still rejects unknown decision values'
);

SELECT * FROM finish();
ROLLBACK;
