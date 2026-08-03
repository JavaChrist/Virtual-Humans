-- VHS-118B — creative director_runs + persist creative_concept (pgTAP).

BEGIN;
SELECT plan(13);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'director_runs_type_check'
      AND pg_get_constraintdef(oid) LIKE '%creative%'
  ),
  'director_runs permits creative'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'director_runs_input_type_check'
      AND pg_get_constraintdef(oid) LIKE '%marketing_plan%'
  ),
  'director_runs permits marketing_plan input'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.begin_or_get_creative_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)',
    'EXECUTE'
  ),
  'service_role can begin Creative run'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.begin_or_get_creative_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)',
    'EXECUTE'
  ),
  'anon cannot begin Creative run'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.persist_creative_concept(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,uuid,bigint,text,jsonb,integer,text)',
    'EXECUTE'
  ),
  'authenticated cannot persist Creative concept'
);

INSERT INTO public.workspaces (id, slug, name)
VALUES ('a118b118-a118-4118-8118-a118b118b118', 'sql-118b', 'SQL 118B');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a118b118-a118-4118-8118-a118b118b118', 100000, 'USD');

INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'b118b118-b118-4118-8118-b118b118b118',
  'a118b118-a118-4118-8118-a118b118b118',
  'P118B', 'draft', 1, '1.0.0', 'corr-118b-01'
);

INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  value, created_by, correlation_id
) VALUES
(
  'c118c118-c118-4118-8118-c118c118c118',
  'a118b118-a118-4118-8118-a118b118b118',
  'b118b118-b118-4118-8118-b118b118b118',
  'video_project_brief', 1, '1.0.0',
  '{"projectName":"P118B"}'::jsonb, 'tester', 'corr-118b-01'
),
(
  'd118d118-d118-4118-8118-d118d118d118',
  'a118b118-a118-4118-8118-a118b118b118',
  'b118b118-b118-4118-8118-b118b118b118',
  'marketing_plan', 1, '1.0.0',
  '{"title":"Plan"}'::jsonb, 'tester', 'corr-118b-01'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES
(
  'a118b118-a118-4118-8118-a118b118b118',
  'b118b118-b118-4118-8118-b118b118b118',
  'video_project_brief',
  'c118c118-c118-4118-8118-c118c118c118',
  1, 'tester'
),
(
  'a118b118-a118-4118-8118-a118b118b118',
  'b118b118-b118-4118-8118-b118b118b118',
  'marketing_plan',
  'd118d118-d118-4118-8118-d118d118d118',
  1, 'tester'
);

SELECT is(
  (
    SELECT public.begin_or_get_creative_director_run(
      'e118e118-e118-4118-8118-e118e118e118',
      'a118b118-a118-4118-8118-a118b118b118',
      'b118b118-b118-4118-8118-b118b118b118',
      'd118d118-d118-4118-8118-d118d118d118',
      1,
      'c118c118-c118-4118-8118-c118c118c118',
      1,
      'gpt-5.6-terra', 'creative-analyzer-v1', '1.0.0',
      'cre-key-118b-001', 'fingerprint118b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-118b-begin', 100, 'USD'
    )->>'status'
  ),
  'created',
  'begin creative director run created'
);

SELECT lives_ok(
  $$SELECT public.reserve_director_budget(
      'f118f118-f118-4118-8118-f118f118f118',
      'a118b118-a118-4118-8118-a118b118b118',
      'b118b118-b118-4118-8118-b118b118b118',
      'e118e118-e118-4118-8118-e118e118e118',
      'creative-1', 100, 'USD', 'corr-118b-res', 'ledger-dir-res-118b'
    )$$,
  'reserve director budget ok'
);

SELECT is(
  (
    SELECT public.persist_creative_concept(
      'a118b118-a118-4118-8118-a118b118b118',
      'b118b118-b118-4118-8118-b118b118b118',
      'e118e118-e118-4118-8118-e118e118e118',
      '11181118-1118-4118-8118-111811181118',
      'd118d118-d118-4118-8118-d118d118d118',
      1,
      'c118c118-c118-4118-8118-c118c118c118',
      1,
      '{"title":"Concept"}'::jsonb,
      '1.0.0',
      'corr-118b-persist',
      'shared_password',
      'tester',
      'tester',
      'f118f118-f118-4118-8118-f118f118f118',
      100,
      'committed',
      NULL,
      2,
      'dir-commit-118b'
    )->>'status'
  ),
  'created',
  'persist creative concept created'
);

SELECT is(
  (
    SELECT artifact_type FROM public.project_artifacts
    WHERE id = '11181118-1118-4118-8118-111811181118'
  ),
  'creative_concept',
  'creative_concept artifact inserted'
);

SELECT is(
  (
    SELECT revision FROM public.active_artifact_revisions
    WHERE project_id = 'b118b118-b118-4118-8118-b118b118b118'
      AND artifact_type = 'creative_concept'
  ),
  1,
  'creative_concept active revision = 1'
);

SELECT is(
  (
    SELECT status FROM public.director_runs
    WHERE id = 'e118e118-e118-4118-8118-e118e118e118'
  ),
  'completed',
  'director_run completed'
);

SELECT is(
  (
    SELECT public.begin_or_get_creative_director_run(
      '21182118-2118-4118-8118-211821182118',
      'a118b118-a118-4118-8118-a118b118b118',
      'b118b118-b118-4118-8118-b118b118b118',
      'd118d118-d118-4118-8118-d118d118d118',
      1,
      'c118c118-c118-4118-8118-c118c118c118',
      1,
      'gpt-5.6-terra', 'creative-analyzer-v1', '1.0.0',
      'cre-key-118b-001', 'fingerprint118b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-118b-replay', 100, 'USD'
    )->>'status'
  ),
  'existing',
  'idempotent begin returns existing'
);

SELECT is(
  (
    SELECT count(*)::int FROM public.audit_log
    WHERE project_id = 'b118b118-b118-4118-8118-b118b118b118'
      AND action = 'director.creative.completed'
  ),
  1,
  'audit creative completed'
);

SELECT * FROM finish();
ROLLBACK;
