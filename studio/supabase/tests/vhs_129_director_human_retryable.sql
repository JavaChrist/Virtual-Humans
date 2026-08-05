-- VHS-129 — human-retry allowlist + invalid_structured_output retry (pgTAP).

BEGIN;
SELECT plan(18);

SELECT ok(
  public.director_error_code_is_human_retryable('rate_limited'),
  'rate_limited human-retryable'
);
SELECT ok(
  public.director_error_code_is_human_retryable('invalid_structured_output'),
  'invalid_structured_output human-retryable'
);
SELECT ok(
  NOT public.director_error_code_is_human_retryable('invalid_candidate'),
  'invalid_candidate not human-retryable'
);
SELECT ok(
  NOT public.director_error_code_is_human_retryable('empty_response'),
  'empty_response not human-retryable'
);

-- Compat wrapper ≡ human function (single source of truth)
SELECT ok(
  public.director_error_code_is_retryable('invalid_structured_output')
    IS NOT DISTINCT FROM
  public.director_error_code_is_human_retryable('invalid_structured_output'),
  'compat wrapper matches human_retryable for ISO'
);
SELECT ok(
  public.director_error_code_is_retryable('invalid_candidate')
    IS NOT DISTINCT FROM
  public.director_error_code_is_human_retryable('invalid_candidate'),
  'compat wrapper matches human_retryable for invalid_candidate'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.director_error_code_is_human_retryable(text)',
    'EXECUTE'
  ),
  'service_role execute human_retryable'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.director_error_code_is_human_retryable(text)',
    'EXECUTE'
  ),
  'anon cannot execute human_retryable'
);

INSERT INTO public.workspaces (id, slug, name)
VALUES ('a1290000-a129-4129-8129-a129a129a129', 'sql-129', 'SQL 129');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a1290000-a129-4129-8129-a129a129a129', 100000, 'USD');

INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'b1290000-b129-4129-8129-b129b129b129',
  'a1290000-a129-4129-8129-a129a129a129',
  'P129', 'draft', 1, '1.0.0', 'corr-129-01'
);

INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  value, created_by, correlation_id
) VALUES (
  'c1290000-c129-4129-8129-c129c129c129',
  'a1290000-a129-4129-8129-a129a129a129',
  'b1290000-b129-4129-8129-b129b129b129',
  'video_project_brief', 1, '1.0.0',
  '{"projectName":"P129"}'::jsonb, 'tester', 'corr-129-01'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a1290000-a129-4129-8129-a129a129a129',
  'b1290000-b129-4129-8129-b129b129b129',
  'video_project_brief',
  'c1290000-c129-4129-8129-c129c129c129',
  1, 'tester'
);

-- Attempt 1 → rate_limited
SELECT public.begin_or_get_marketing_director_run(
  'd1290000-d129-4129-8129-d129d129d129',
  'a1290000-a129-4129-8129-a129a129a129',
  'b1290000-b129-4129-8129-b129b129b129',
  'c1290000-c129-4129-8129-c129c129c129',
  1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
  'mkt-key-129-001', 'fingerprint129001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-129-begin', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'e1290000-e129-4129-8129-e129e129e129',
  'a1290000-a129-4129-8129-a129a129a129',
  'b1290000-b129-4129-8129-b129b129b129',
  'd1290000-d129-4129-8129-d129d129d129',
  'marketing-1', 24, 'USD', 'corr-129-res1',
  'dir-reserve-d1290000-d129-4129-8129-d129d129d129'
);
SELECT public.fail_director_run(
  'd1290000-d129-4129-8129-d129d129d129',
  'a1290000-a129-4129-8129-a129a129a129',
  2, 'rate_limited', 'failed',
  'e1290000-e129-4129-8129-e129e129e129',
  'dir-release-d1290000-d129-4129-8129-d129d129d129',
  'corr-129-fail1'
);

-- Attempt 2 → invalid_structured_output
SELECT public.begin_or_retry_director_run(
  'f1290000-f129-4129-8129-f129f129f129',
  'a1290000-a129-4129-8129-a129a129a129',
  'b1290000-b129-4129-8129-b129b129b129',
  'd1290000-d129-4129-8129-d129d129d129',
  '11111111-1111-4111-8111-111111111111',
  'marketing',
  'c1290000-c129-4129-8129-c129c129c129',
  1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
  'fingerprint129002aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-129-retry2', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'aa290000-aa29-4129-8129-aa29aa29aa29',
  'a1290000-a129-4129-8129-a129a129a129',
  'b1290000-b129-4129-8129-b129b129b129',
  'f1290000-f129-4129-8129-f129f129f129',
  'marketing-2', 24, 'USD', 'corr-129-res2',
  'dir-reserve-f1290000-f129-4129-8129-f129f129f129'
);
SELECT public.fail_director_run(
  'f1290000-f129-4129-8129-f129f129f129',
  'a1290000-a129-4129-8129-a129a129a129',
  2, 'invalid_structured_output', 'failed',
  'aa290000-aa29-4129-8129-aa29aa29aa29',
  'dir-release-f1290000-f129-4129-8129-f129f129f129',
  'corr-129-fail2'
);

SELECT is(
  (SELECT attempt_number FROM public.director_runs WHERE id = 'f1290000-f129-4129-8129-f129f129f129'),
  2,
  'run #2 remains attempt 2'
);
SELECT is(
  (SELECT error_code FROM public.director_runs WHERE id = 'f1290000-f129-4129-8129-f129f129f129'),
  'invalid_structured_output',
  'run #2 error preserved'
);

-- Attempt 3 created from ISO failure (human retry)
SELECT is(
  (
    SELECT (public.begin_or_retry_director_run(
      'bb290000-bb29-4129-8129-bb29bb29bb29',
      'a1290000-a129-4129-8129-a129a129a129',
      'b1290000-b129-4129-8129-b129b129b129',
      'f1290000-f129-4129-8129-f129f129f129',
      '22222222-2222-4222-8222-222222222222',
      'marketing',
      'c1290000-c129-4129-8129-c129c129c129',
      1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
      'fingerprint129003aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-129-retry3', 24, 'USD'
    )->>'attempt_number')::int
  ),
  3,
  'ISO failure allows human retry attempt 3'
);

-- Idempotent replay same retryRequestId → same run, no second insert
SELECT is(
  (
    SELECT public.begin_or_retry_director_run(
      'cc290000-cc29-4129-8129-cc29cc29cc29',
      'a1290000-a129-4129-8129-a129a129a129',
      'b1290000-b129-4129-8129-b129b129b129',
      'f1290000-f129-4129-8129-f129f129f129',
      '22222222-2222-4222-8222-222222222222',
      'marketing',
      'c1290000-c129-4129-8129-c129c129c129',
      1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
      'fingerprint129003aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-129-replay', 24, 'USD'
    )->>'director_run_id'
  ),
  'bb290000-bb29-4129-8129-bb29bb29bb29',
  'same retryRequestId replays single run'
);

SELECT is(
  (SELECT count(*)::int FROM public.director_runs
   WHERE project_id = 'b1290000-b129-4129-8129-b129b129b129'
     AND director_type = 'marketing'),
  3,
  'exactly 3 marketing runs after replay'
);

-- Concurrent second requestId while attempt 3 pending → no attempt 4
SELECT is(
  (
    SELECT public.begin_or_retry_director_run(
      'dd290000-dd29-4129-8129-dd29dd29dd29',
      'a1290000-a129-4129-8129-a129a129a129',
      'b1290000-b129-4129-8129-b129b129b129',
      'f1290000-f129-4129-8129-f129f129f129',
      '33333333-3333-4333-8333-333333333333',
      'marketing',
      'c1290000-c129-4129-8129-c129c129c129',
      1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
      'fingerprint129004aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'corr-129-concurrent', 24, 'USD'
    )->>'status'
  ),
  'already_running',
  'concurrent second requestId does not create another attempt'
);
SELECT is(
  (SELECT count(*)::int FROM public.director_runs
   WHERE project_id = 'b1290000-b129-4129-8129-b129b129b129'
     AND director_type = 'marketing'
     AND error_code IS DISTINCT FROM 'invalid_candidate'),
  3,
  'still exactly 3 marketing attempts in ISO lineage'
);

-- invalid_candidate still refused
INSERT INTO public.director_runs (
  id, workspace_id, project_id, director_type,
  input_artifact_type, input_artifact_id, input_revision,
  status, provider_id, model_id, prompt_version, schema_version,
  idempotency_key, command_fingerprint, cost_status, correlation_id,
  attempt_number, error_code
) VALUES (
  'ee290000-ee29-4129-8129-ee29ee29ee29',
  'a1290000-a129-4129-8129-a129a129a129',
  'b1290000-b129-4129-8129-b129b129b129',
  'marketing', 'video_project_brief',
  'c1290000-c129-4129-8129-c129c129c129', 1,
  'failed', 'openai', 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
  'mkt-key-129-bad', 'fingerprint129badaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'released', 'corr-129-bad', 1, 'invalid_candidate'
);

SELECT throws_ok(
  $$SELECT public.begin_or_retry_director_run(
    'ff290000-ff29-4129-8129-ff29ff29ff29',
    'a1290000-a129-4129-8129-a129a129a129',
    'b1290000-b129-4129-8129-b129b129b129',
    'ee290000-ee29-4129-8129-ee29ee29ee29',
    '44444444-4444-4444-8444-444444444444',
    'marketing',
    'c1290000-c129-4129-8129-c129c129c129',
    1, 'gpt-5.6', 'marketing-analyzer-v1', '1.0.0',
    'fingerprint129bad2aaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'corr-129-deny', 24, 'USD'
  )$$,
  'P0001',
  'retry_not_allowed',
  'invalid_candidate human retry refused'
);

-- Historical attempts 1–2 unchanged
SELECT is(
  (SELECT status FROM public.director_runs WHERE id = 'd1290000-d129-4129-8129-d129d129d129'),
  'failed',
  'attempt 1 status preserved'
);
SELECT is(
  (SELECT cost_status FROM public.director_runs WHERE id = 'f1290000-f129-4129-8129-f129f129f129'),
  'released',
  'attempt 2 cost released preserved'
);

SELECT * FROM finish();
ROLLBACK;
