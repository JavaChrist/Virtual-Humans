-- VHS-125 — postproduction delivery RPCs (quality / human review / merge / export) (pgTAP).
BEGIN;
SELECT plan(38);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'project_artifacts_type_check'
    AND pg_get_constraintdef(oid) LIKE '%quality_report%'
    AND pg_get_constraintdef(oid) LIKE '%merge_plan%'
    AND pg_get_constraintdef(oid) LIKE '%export_package%'
), 'project_artifacts permits quality_report/merge_plan/export_package');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'active_artifact_revisions_type_check'
    AND pg_get_constraintdef(oid) LIKE '%quality_report%'
    AND pg_get_constraintdef(oid) LIKE '%export_package%'
), 'active_artifact_revisions permits quality_report/export_package');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'director_runs_type_check'
    AND pg_get_constraintdef(oid) LIKE '%quality%'
    AND pg_get_constraintdef(oid) LIKE '%merge%'
    AND pg_get_constraintdef(oid) LIKE '%export%'
), 'director_runs permits quality/merge/export');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname = 'director_runs_input_type_check'
    AND pg_get_constraintdef(oid) LIKE '%quality_report%'
    AND pg_get_constraintdef(oid) LIKE '%merge_plan%'
), 'director_runs input permits quality_report/merge_plan');

-- ---------------------------------------------------------------------------
-- Grants — service_role only.
-- ---------------------------------------------------------------------------
SELECT ok(has_function_privilege(
  'service_role', 'public.persist_production_result(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,integer)', 'EXECUTE'
), 'service role can persist_production_result');

SELECT ok(NOT has_function_privilege(
  'anon', 'public.persist_production_result(uuid,uuid,uuid,uuid,jsonb,text,text,text,text,text,integer)', 'EXECUTE'
), 'anon cannot persist_production_result');

SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.persist_human_review_decision(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text,jsonb,text,text,text,text,jsonb,uuid,integer)',
  'EXECUTE'
), 'authenticated cannot persist_human_review_decision');

SELECT ok(has_function_privilege(
  'service_role',
  'public.persist_merge_outcome(uuid,uuid,uuid,uuid,uuid,integer,jsonb,text,text,jsonb,uuid,text,text,text,text,integer)',
  'EXECUTE'
), 'service role can persist_merge_outcome');

SELECT ok(has_function_privilege(
  'service_role',
  'public.persist_export_package(uuid,uuid,uuid,uuid,uuid,integer,jsonb,text,text,jsonb,uuid,text,text,text,text,integer)',
  'EXECUTE'
), 'service role can persist_export_package');

SELECT ok(NOT has_table_privilege('anon', 'public.human_review_decisions', 'SELECT'),
  'anon cannot select human_review_decisions');
SELECT ok(NOT has_table_privilege('authenticated', 'public.human_review_decisions', 'INSERT'),
  'authenticated cannot insert human_review_decisions');
SELECT ok(has_table_privilege('service_role', 'public.human_review_decisions', 'INSERT'),
  'service role can insert human_review_decisions');

-- ---------------------------------------------------------------------------
-- Fixture: workspace, project, production_run.
-- ---------------------------------------------------------------------------
INSERT INTO public.workspaces (id, slug, name)
VALUES ('a125a125-a125-4125-8125-a125a125a125', 'sql-125', 'SQL 125');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a125a125-a125-4125-8125-a125a125a125', 100000, 'USD');
INSERT INTO public.video_projects (id, workspace_id, name, status, active_revision, schema_version, correlation_id)
VALUES (
  'b125b125-b125-4125-8125-b125b125b125',
  'a125a125-a125-4125-8125-a125a125a125',
  'P125', 'draft', 1, '1.0.0', 'corr-125'
);
INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_by, correlation_id
) VALUES (
  'e125e125-e125-4125-8125-e125e125e125',
  'a125a125-a125-4125-8125-a125a125a125',
  'b125b125-b125-4125-8125-b125b125b125',
  'generation_plan', 1, '1.0.0', '{"ok":true}'::jsonb, 'tester', 'corr-125'
);
INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
) VALUES (
  'a125a125-a125-4125-8125-a125a125a125',
  'b125b125-b125-4125-8125-b125b125b125',
  'generation_plan', 'e125e125-e125-4125-8125-e125e125e125', 1, timezone('utc', now()), 'tester'
);
INSERT INTO public.production_runs (
  id, workspace_id, project_id, generation_plan_artifact_id, generation_plan_revision,
  status, revision, policy_version, estimated_cost_minor, committed_cost_minor, released_cost_minor,
  currency, correlation_id, state
) VALUES (
  'd125d125-d125-4125-8125-d125d125d125',
  'a125a125-a125-4125-8125-a125a125a125',
  'b125b125-b125-4125-8125-b125b125b125',
  'e125e125-e125-4125-8125-e125e125e125',
  1, 'completed', 1, 'vhs-110.1', 100, 100, 0, 'USD', 'corr-125',
  '{"id":"d125d125-d125-4125-8125-d125d125d125","status":"completed"}'::jsonb
);

-- ---------------------------------------------------------------------------
-- 1. persist_production_result — creates + idempotent on manifest.runId.
-- ---------------------------------------------------------------------------
SELECT is((
  SELECT public.persist_production_result(
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250001-0001-4125-8125-c12500010001',
    'd125d125-d125-4125-8125-d125d125d125',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d125d125-d125-4125-8125-d125d125d125"},"delivery":{"status":"not_started"}}'::jsonb,
    '1.1.0', 'corr-125', 'tester', 'shared_password', 'tester', 0
  )->>'status'
), 'created', 'persist_production_result created');

SELECT is((
  SELECT artifact_id FROM public.active_artifact_revisions
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125' AND artifact_type = 'production_result'
), 'c1250001-0001-4125-8125-c12500010001', 'active production_result points to new artifact');

SELECT is((
  SELECT public.persist_production_result(
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250002-0002-4125-8125-c12500020002',
    'd125d125-d125-4125-8125-d125d125d125',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d125d125-d125-4125-8125-d125d125d125"},"delivery":{"status":"not_started"}}'::jsonb,
    '1.1.0', 'corr-125', 'tester', 'shared_password', 'tester'
  )->>'status'
), 'existing', 'persist_production_result idempotent on same runId');

-- ---------------------------------------------------------------------------
-- 2. begin_or_get_quality_director_run + persist_quality_report.
-- ---------------------------------------------------------------------------
SELECT is((
  SELECT public.begin_or_get_quality_director_run(
    '11150001-1111-4125-8125-111150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250001-0001-4125-8125-c12500010001',
    1, 'qc-key-125-001', 'fingerprint125001aaaaaaaaaaaaaaaaaaaaaaaaaa', 'corr-125'
  )->>'status'
), 'created', 'begin quality run created');

SELECT throws_ok(
  $$SELECT public.begin_or_get_quality_director_run(
    '11150099-1111-4125-8125-111150009999',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250001-0001-4125-8125-c12500010001',
    99, 'qc-key-125-mismatch', 'fingerprint125099aaaaaaaaaaaaaaaaaaaaaaaaaa', 'corr-125'
  )$$,
  'P0001', 'production_result_revision_mismatch',
  'begin quality run rejects stale production_result revision'
);

SELECT is((
  SELECT public.persist_quality_report(
    '11150001-1111-4125-8125-111150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250003-0003-4125-8125-c12500030003',
    'c1250001-0001-4125-8125-c12500010001',
    1,
    '{"status":"needs_review","blockingIssues":[],"warnings":[]}'::jsonb,
    '1.0.0',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d125d125-d125-4125-8125-d125d125d125"},"delivery":{"status":"quality_review"}}'::jsonb,
    'c1250004-0004-4125-8125-c12500040004',
    'corr-125', 'tester', 'shared_password', 'tester', 1
  )->>'status'
), 'created', 'persist_quality_report created');

SELECT is((
  SELECT status FROM public.director_runs WHERE id = '11150001-1111-4125-8125-111150001111'
), 'completed', 'quality director run completed');

SELECT is((
  SELECT count(*)::int FROM public.audit_log
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125' AND action = 'director.quality.completed'
), 1, 'audit director.quality.completed recorded');

SELECT is((
  SELECT artifact_id FROM public.active_artifact_revisions
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125' AND artifact_type = 'production_result'
), 'c1250004-0004-4125-8125-c12500040004', 'active production_result advanced after quality report');

SELECT is((
  SELECT public.begin_or_get_quality_director_run(
    '11150002-1111-4125-8125-111150002222',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250004-0004-4125-8125-c12500040004',
    2, 'qc-key-125-001', 'fingerprint125001aaaaaaaaaaaaaaaaaaaaaaaaaa', 'corr-125'
  )->>'status'
), 'existing', 'begin quality run idempotent (existing) on same idempotency_key');

-- ---------------------------------------------------------------------------
-- 3. persist_human_review_decision — append-only, optimistic, idempotent.
-- ---------------------------------------------------------------------------
SELECT is((
  SELECT public.persist_human_review_decision(
    '21150001-2111-4125-8125-211150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250003-0003-4125-8125-c12500030003', 1,
    'c1250004-0004-4125-8125-c12500040004', 2,
    'approved', 'ok', '[]'::jsonb,
    'review-key-125-001', 'corr-125', 'shared_password', 'tester',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d125d125-d125-4125-8125-d125d125d125"},"delivery":{"status":"merge_ready"}}'::jsonb,
    'c1250005-0005-4125-8125-c12500050005', 2
  )->>'status'
), 'created', 'persist_human_review_decision created');

SELECT is((
  SELECT count(*)::int FROM public.human_review_decisions
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125'
), 1, 'exactly one human_review_decisions row');

SELECT is((
  SELECT public.persist_human_review_decision(
    '21150002-2111-4125-8125-211150002222',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250003-0003-4125-8125-c12500030003', 1,
    'c1250004-0004-4125-8125-c12500040004', 2,
    'approved', 'ok retry', '[]'::jsonb,
    'review-key-125-001', 'corr-125', 'shared_password', 'tester',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d125d125-d125-4125-8125-d125d125d125"},"delivery":{"status":"merge_ready"}}'::jsonb,
    'c1250006-0006-4125-8125-c12500060006', 1
  )->>'status'
), 'existing', 'persist_human_review_decision idempotent on idempotency_key');

SELECT is((
  SELECT count(*)::int FROM public.human_review_decisions
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125'
), 1, 'idempotent retry does not append a second row');

SELECT throws_ok(
  $$UPDATE public.human_review_decisions SET decision = 'rejected'
    WHERE id = '21150001-2111-4125-8125-211150001111'$$,
  'P0001', 'human_review_decisions are append-only',
  'human_review_decisions blocks UPDATE'
);

SELECT throws_ok(
  $$DELETE FROM public.human_review_decisions WHERE id = '21150001-2111-4125-8125-211150001111'$$,
  'P0001', 'human_review_decisions are append-only',
  'human_review_decisions blocks DELETE'
);

SELECT throws_ok(
  $$SELECT public.persist_human_review_decision(
    '21150009-2111-4125-8125-211150009999',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250003-0003-4125-8125-c12500030003', 1,
    'c1250004-0004-4125-8125-c12500040004', 2,
    'request_changes', NULL, '[]'::jsonb,
    NULL, 'corr-125', 'shared_password', 'tester',
    '{"delivery":{"status":"merge_ready"}}'::jsonb,
    'c1250099-0099-4125-8125-c12500990099', 1
  )$$,
  'P0001', 'invalid_review_decision',
  'persist_human_review_decision rejects non approved|rejected status'
);

-- ---------------------------------------------------------------------------
-- 4. begin_or_get_merge_director_run + persist_merge_outcome.
-- ---------------------------------------------------------------------------
SELECT is((
  SELECT public.begin_or_get_merge_director_run(
    '31150001-3111-4125-8125-311150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250003-0003-4125-8125-c12500030003', 1,
    'c1250005-0005-4125-8125-c12500050005', 3,
    'mrg-key-125-001', 'fingerprint125m01aaaaaaaaaaaaaaaaaaaaaaaaaa', 'corr-125'
  )->>'status'
), 'created', 'begin merge run created');

SELECT is((
  SELECT public.persist_merge_outcome(
    '31150001-3111-4125-8125-311150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250007-0007-4125-8125-c12500070007',
    'c1250005-0005-4125-8125-c12500050005', 3,
    '{"status":"completed","finalAsset":{"id":"asset-1","source":{"kind":"internal","storagePath":"fake-merge/asset-1.mp4"}}}'::jsonb,
    '1.0.0', 'completed',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d125d125-d125-4125-8125-d125d125d125"},"delivery":{"status":"merged"}}'::jsonb,
    'c1250008-0008-4125-8125-c12500080008',
    'corr-125', 'tester', 'shared_password', 'tester', 1
  )->>'status'
), 'created', 'persist_merge_outcome created');

SELECT is((
  SELECT count(*)::int FROM public.audit_log
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125' AND action = 'director.merge.completed'
), 1, 'audit director.merge.completed recorded');

SELECT throws_ok(
  $$SELECT public.persist_merge_outcome(
    '31150001-3111-4125-8125-311150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250097-0097-4125-8125-c12500970097',
    'c1250008-0008-4125-8125-c12500080008', 4,
    '{"status":"bogus"}'::jsonb, '1.0.0', 'bogus_status',
    '{"delivery":{"status":"merged"}}'::jsonb,
    'c1250098-0098-4125-8125-c12500980098',
    'corr-125', 'tester', 'shared_password', 'tester', 2
  )$$,
  'P0001', 'invalid_merge_status',
  'persist_merge_outcome rejects unknown merge_status'
);

-- ---------------------------------------------------------------------------
-- 5. begin_or_get_export_director_run + persist_export_package.
-- ---------------------------------------------------------------------------
SELECT is((
  SELECT public.begin_or_get_export_director_run(
    '41150001-4111-4125-8125-411150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250007-0007-4125-8125-c12500070007', 1,
    'c1250008-0008-4125-8125-c12500080008', 4,
    'exp-key-125-001', 'fingerprint125e01aaaaaaaaaaaaaaaaaaaaaaaaaa', 'corr-125'
  )->>'status'
), 'created', 'begin export run created');

SELECT is((
  SELECT public.persist_export_package(
    '41150001-4111-4125-8125-411150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250009-0009-4125-8125-c12500090009',
    'c1250008-0008-4125-8125-c12500080008', 4,
    '{"id":"c1250009-0009-4125-8125-c12500090009","finalAsset":{"id":"asset-1","source":{"kind":"internal","storagePath":"fake-merge/asset-1.mp4"}}}'::jsonb,
    '1.0.0', 'download',
    '{"artifactType":"production_result","schemaVersion":"1.1.0","status":"completed","manifest":{"runId":"d125d125-d125-4125-8125-d125d125d125"},"delivery":{"status":"export_ready"}}'::jsonb,
    'c1250010-0010-4125-8125-c12500100010',
    'corr-125', 'tester', 'shared_password', 'tester', 1
  )->>'status'
), 'created', 'persist_export_package created');

SELECT is((
  SELECT count(*)::int FROM public.audit_log
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125' AND action = 'director.export.completed'
), 1, 'audit director.export.completed recorded');

SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.project_artifacts
  WHERE project_id = 'b125b125-b125-4125-8125-b125b125b125' AND artifact_type = 'export_package'
    AND value::text LIKE '%https://%'
), 'export_package artifact carries no https:// signed URL');

SELECT throws_ok(
  $$SELECT public.persist_export_package(
    '41150001-4111-4125-8125-411150001111',
    'a125a125-a125-4125-8125-a125a125a125',
    'b125b125-b125-4125-8125-b125b125b125',
    'c1250096-0096-4125-8125-c12500960096',
    'c1250010-0010-4125-8125-c12500100010', 5,
    '{"id":"x"}'::jsonb, '1.0.0', 'ftp',
    '{"delivery":{"status":"export_ready"}}'::jsonb,
    'c1250095-0095-4125-8125-c12500950095',
    'corr-125', 'tester', 'shared_password', 'tester', 2
  )$$,
  'P0001', 'invalid_destination',
  'persist_export_package rejects unknown destination'
);

SELECT * FROM finish();
ROLLBACK;
