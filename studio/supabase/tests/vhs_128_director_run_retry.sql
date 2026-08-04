-- VHS-128 — director run explicit human retry (pgTAP).

BEGIN;
SELECT plan(17);

SELECT has_column('public', 'director_runs', 'attempt_number', 'attempt_number exists');
SELECT has_column('public', 'director_runs', 'retry_of_run_id', 'retry_of_run_id exists');
SELECT has_column('public', 'director_runs', 'retry_request_id', 'retry_request_id exists');

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.begin_or_retry_director_run(uuid,uuid,uuid,uuid,uuid,text,uuid,integer,text,text,text,text,text,bigint,text)',
    'EXECUTE'
  ),
  'service_role execute begin_or_retry_director_run'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.begin_or_retry_director_run(uuid,uuid,uuid,uuid,uuid,text,uuid,integer,text,text,text,text,text,bigint,text)',
    'EXECUTE'
  ),
  'anon cannot begin_or_retry_director_run'
);

SELECT ok(
  public.director_error_code_is_retryable('rate_limited'),
  'rate_limited is retryable'
);
SELECT ok(
  NOT public.director_error_code_is_retryable('invalid_candidate'),
  'invalid_candidate is not retryable'
);

INSERT INTO public.workspaces (id, slug, name)
VALUES ('a128a128-a128-4128-8128-a128a128a128', 'sql-128', 'SQL 128');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a128a128-a128-4128-8128-a128a128a128', 100000, 'USD');

INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'b128b128-b128-4128-8128-b128b128b128',
  'a128a128-a128-4128-8128-a128a128a128',
  'P128', 'draft', 1, '1.0.0', 'corr-128-01'
);

INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  value, created_by, correlation_id
) VALUES (
  'c128c128-c128-4128-8128-c128c128c128',
  'a128a128-a128-4128-8128-a128a128a128',
  'b128b128-b128-4128-8128-b128b128b128',
  'video_project_brief', 1, '1.0.0',
  '{"projectName":"P128"}'::jsonb, 'tester', 'corr-128-01'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a128a128-a128-4128-8128-a128a128a128',
  'b128b128-b128-4128-8128-b128b128b128',
  'video_project_brief',
  'c128c128-c128-4128-8128-c128c128c128',
  1, 'tester'
);

-- Attempt 1 created then failed rate_limited
SELECT public.begin_or_get_marketing_director_run(
  'd128d128-d128-4128-8128-d128d128d128',
  'a128a128-a128-4128-8128-a128a128a128',
  'b128b128-b128-4128-8128-b128b128b128',
  'c128c128-c128-4128-8128-c128c128c128',
  1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
  'mkt-key-128-001', 'fingerprint128001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-128-begin', 24, 'USD'
);

SELECT public.reserve_director_budget(
  'e128e128-e128-4128-8128-e128e128e128',
  'a128a128-a128-4128-8128-a128a128a128',
  'b128b128-b128-4128-8128-b128b128b128',
  'd128d128-d128-4128-8128-d128d128d128',
  'marketing-1', 24, 'USD', 'corr-128-res',
  'dir-reserve-d128d128-d128-4128-8128-d128d128d128'
);

SELECT public.fail_director_run(
  'd128d128-d128-4128-8128-d128d128d128',
  'a128a128-a128-4128-8128-a128a128a128',
  2, 'rate_limited', 'failed',
  'e128e128-e128-4128-8128-e128e128e128',
  'dir-release-d128d128-d128-4128-8128-d128d128d128',
  'corr-128-fail'
);

SELECT is(
  (SELECT attempt_number FROM public.director_runs WHERE id = 'd128d128-d128-4128-8128-d128d128d128'),
  1,
  'historical run remains attempt 1'
);

SELECT throws_ok(
  $$SELECT public.begin_or_get_marketing_director_run(
    'f128f128-f128-4128-8128-f128f128f128',
    'a128a128-a128-4128-8128-a128a128a128',
    'b128b128-b128-4128-8128-b128b128b128',
    'c128c128-c128-4128-8128-c128c128c128',
    1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
    'mkt-key-128-001', 'fingerprint128001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'corr-128-reuse', 24, 'USD'
  )$$,
  'P0001',
  'director_run_terminal_reuse',
  'same key after failed → terminal_reuse'
);

SELECT is(
  (
    SELECT public.begin_or_retry_director_run(
      'a129a129-a129-4129-8129-a129a129a129',
      'a128a128-a128-4128-8128-a128a128a128',
      'b128b128-b128-4128-8128-b128b128b128',
      'd128d128-d128-4128-8128-d128d128d128',
      '11111111-1111-4111-8111-111111111111',
      'marketing',
      'c128c128-c128-4128-8128-c128c128c128',
      1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
      'fingerprint128001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-128-retry', 24, 'USD'
    )->>'status'
  ),
  'created',
  'retry creates attempt 2'
);

SELECT is(
  (SELECT attempt_number FROM public.director_runs WHERE id = 'a129a129-a129-4129-8129-a129a129a129'),
  2,
  'new run is attempt 2'
);

SELECT is(
  (SELECT retry_of_run_id::text FROM public.director_runs WHERE id = 'a129a129-a129-4129-8129-a129a129a129'),
  'd128d128-d128-4128-8128-d128d128d128',
  'retry_of_run_id points to previous'
);

SELECT is(
  (SELECT idempotency_key FROM public.director_runs WHERE id = 'a129a129-a129-4129-8129-a129a129a129'),
  'mkt-key-128-001:attempt:2',
  'idempotency key uses :attempt:2'
);

SELECT is(
  (
    SELECT public.begin_or_retry_director_run(
      'b129b129-b129-4129-8129-b129b129b129',
      'a128a128-a128-4128-8128-a128a128a128',
      'b128b128-b128-4128-8128-b128b128b128',
      'd128d128-d128-4128-8128-d128d128d128',
      '11111111-1111-4111-8111-111111111111',
      'marketing',
      'c128c128-c128-4128-8128-c128c128c128',
      1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
      'fingerprint128001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-128-replay', 24, 'USD'
    )->>'director_run_id'
  ),
  'a129a129-a129-4129-8129-a129a129a129',
  'same retry_request_id replays same run'
);

SELECT is(
  (SELECT status FROM public.director_runs WHERE id = 'd128d128-d128-4128-8128-d128d128d128'),
  'failed',
  'previous failed run immutable'
);

SELECT is(
  (
    SELECT public.begin_or_retry_director_run(
      'c129c129-c129-4129-8129-c129c129c129',
      'a128a128-a128-4128-8128-a128a128a128',
      'b128b128-b128-4128-8128-b128b128b128',
      'd128d128-d128-4128-8128-d128d128d128',
      '22222222-2222-4222-8222-222222222222',
      'marketing',
      'c128c128-c128-4128-8128-c128c128c128',
      1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
      'fingerprint128001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-128-concurrent', 24, 'USD'
    )->>'status'
  ),
  'already_running',
  'different retry_request_id while attempt 2 pending → already_running (no second authorizable run)'
);

-- Fail attempt 2, then retrying parent is superseded
SELECT public.fail_director_run(
  'a129a129-a129-4129-8129-a129a129a129',
  'a128a128-a128-4128-8128-a128a128a128',
  1, 'rate_limited', 'failed',
  NULL, NULL, 'corr-128-fail2'
);

SELECT throws_ok(
  $$SELECT public.begin_or_retry_director_run(
    'd129d129-d129-4129-8129-d129d129d129',
    'a128a128-a128-4128-8128-a128a128a128',
    'b128b128-b128-4128-8128-b128b128b128',
    'd128d128-d128-4128-8128-d128d128d128',
    '33333333-3333-4333-8333-333333333333',
    'marketing',
    'c128c128-c128-4128-8128-c128c128c128',
    1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
    'fingerprint128001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'corr-128-super', 24, 'USD'
  )$$,
  'P0001',
  'retry_superseded',
  'retrying superseded parent after newer failed attempt → conflict'
);

SELECT * FROM finish();
ROLLBACK;
