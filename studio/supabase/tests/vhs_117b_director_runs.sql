-- VHS-117B — director_runs + scoped budget + persist marketing_plan (pgTAP).

BEGIN;
SELECT plan(13);

SELECT has_table('public', 'director_runs', 'director_runs exists');

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='budget_reservations'
      AND column_name='scope_type'
  ),
  'budget_reservations.scope_type exists'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.reserve_director_budget(uuid,uuid,uuid,uuid,text,bigint,text,text,text)',
    'EXECUTE'
  ),
  'service_role execute reserve_director_budget'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.persist_marketing_plan(uuid,uuid,uuid,uuid,uuid,integer,jsonb,text,text,text,text,text,uuid,bigint,text,jsonb,integer,text)',
    'EXECUTE'
  ),
  'anon cannot persist_marketing_plan'
);

INSERT INTO public.workspaces (id, slug, name)
VALUES ('a117b117-a117-4117-8117-a117b117b117', 'sql-117b', 'SQL 117B');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a117b117-a117-4117-8117-a117b117b117', 100000, 'USD');

INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'b117b117-b117-4117-8117-b117b117b117',
  'a117b117-a117-4117-8117-a117b117b117',
  'P117B', 'draft', 1, '1.0.0', 'corr-117b-01'
);

INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  value, created_by, correlation_id
) VALUES (
  'c117c117-c117-4117-8117-c117c117c117',
  'a117b117-a117-4117-8117-a117b117b117',
  'b117b117-b117-4117-8117-b117b117b117',
  'video_project_brief', 1, '1.0.0',
  '{"projectName":"P117B"}'::jsonb, 'tester', 'corr-117b-01'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a117b117-a117-4117-8117-a117b117b117',
  'b117b117-b117-4117-8117-b117b117b117',
  'video_project_brief',
  'c117c117-c117-4117-8117-c117c117c117',
  1, 'tester'
);

SELECT is(
  (
    SELECT public.begin_or_get_marketing_director_run(
      'd117d117-d117-4117-8117-d117d117d117',
      'a117b117-a117-4117-8117-a117b117b117',
      'b117b117-b117-4117-8117-b117b117b117',
      'c117c117-c117-4117-8117-c117c117c117',
      1, 'gpt-5.6-terra', 'marketing-analyzer-v1', '1.0.0',
      'mkt-key-117b-001', 'fingerprint117b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-117b-begin', 100, 'USD'
    )->>'status'
  ),
  'created',
  'begin director run created'
);

SELECT lives_ok(
  $$SELECT public.reserve_director_budget(
      'e117e117-e117-4117-8117-e117e117e117',
      'a117b117-a117-4117-8117-a117b117b117',
      'b117b117-b117-4117-8117-b117b117b117',
      'd117d117-d117-4117-8117-d117d117d117',
      'marketing-1', 100, 'USD', 'corr-117b-res', 'ledger-dir-res-117b'
    )$$,
  'reserve director budget ok'
);

SELECT is(
  (SELECT scope_type FROM public.budget_reservations
    WHERE id = 'e117e117-e117-4117-8117-e117e117e117'),
  'director_run',
  'reservation scoped to director_run'
);

SELECT is(
  (
    SELECT public.persist_marketing_plan(
      'a117b117-a117-4117-8117-a117b117b117',
      'b117b117-b117-4117-8117-b117b117b117',
      'd117d117-d117-4117-8117-d117d117d117',
      'f117f117-f117-4117-8117-f117f117f117',
      'c117c117-c117-4117-8117-c117c117c117',
      1,
      '{"marketingObjective":"awareness","mainBenefit":"x"}'::jsonb,
      '1.0.0', 'corr-117b-persist', 'shared_password', 'tester', 'tester',
      'e117e117-e117-4117-8117-e117e117e117', 100, 'committed', NULL, 2,
      'ledger-dir-commit-117b'
    )->>'status'
  ),
  'created',
  'persist marketing_plan created'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.active_artifact_revisions
    WHERE project_id = 'b117b117-b117-4117-8117-b117b117b117'
      AND artifact_type = 'marketing_plan'
      AND revision = 1
  ),
  'active marketing_plan revision 1'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE action = 'director.marketing.completed'
      AND project_id = 'b117b117-b117-4117-8117-b117b117b117'
  ),
  'audit written'
);

SELECT is(
  (
    SELECT public.begin_or_get_marketing_director_run(
      'd117d117-d117-4117-8117-d117d117d199',
      'a117b117-a117-4117-8117-a117b117b117',
      'b117b117-b117-4117-8117-b117b117b117',
      'c117c117-c117-4117-8117-c117c117c117',
      1, 'gpt-5.6-terra', 'marketing-analyzer-v1', '1.0.0',
      'mkt-key-117b-001', 'fingerprint117b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-117b-replay', 100, 'USD'
    )->>'status'
  ),
  'existing',
  'idempotent replay returns existing'
);

SELECT throws_ok(
  $$SELECT public.begin_or_get_marketing_director_run(
      'd117d117-d117-4117-8117-d117d117d188',
      'a117b117-a117-4117-8117-a117b117b117',
      'b117b117-b117-4117-8117-b117b117b117',
      'c117c117-c117-4117-8117-c117c117c117',
      1, 'gpt-5.6-terra', 'marketing-analyzer-v1', '1.0.0',
      'mkt-key-117b-001', 'DIFFERENT_FINGERPRINT_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'corr-117b-conflict', 100, 'USD'
    )$$,
  'P0001',
  'idempotency_fingerprint_mismatch',
  'fingerprint mismatch conflicts'
);

SELECT throws_ok(
  $$SELECT public.begin_or_get_marketing_director_run(
      'd117d117-d117-4117-8117-d117d117d177',
      'a117b117-a117-4117-8117-a117b117b117',
      'b117b117-b117-4117-8117-b117b117b117',
      'c117c117-c117-4117-8117-c117c117c117',
      99, 'm', 'p', '1.0.0',
      'mkt-key-117b-rev-mismatch', 'fingerprint117b002aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-117b-rev', NULL, NULL
    )$$,
  'P0001',
  'brief_revision_mismatch',
  'brief revision mismatch rejected'
);

SELECT * FROM finish();
ROLLBACK;
