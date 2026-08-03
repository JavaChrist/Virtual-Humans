-- VHS-115 — behavioral SQL: artifacts, queue leases, ledger append-only (pgTAP).
-- Concurrency with multiple connections is covered in TypeScript integration tests.

BEGIN;
SELECT plan(23);

-- Seed workspace + project + plan artifact
INSERT INTO public.workspaces (id, slug, name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sql-beh', 'SQL Behavior');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1000, 'USD');
INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'P', 'draft', 1, '1.0.0', 'corr-sql-beh-01'
);
INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  parent_revision_id, value, created_by, correlation_id
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'generation_plan', 1, '1.0.0', NULL, '{"ok":true}'::jsonb, 'tester', 'corr-sql-beh-01'
);

-- Artifact append-only: UPDATE value rejected
SELECT throws_ok(
  $$UPDATE public.project_artifacts SET value = '{"x":1}'::jsonb
     WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
  'P0001',
  'project_artifacts are append-only',
  'artifact value update forbidden'
);

-- Duplicate revision rejected
SELECT throws_ok(
  $$INSERT INTO public.project_artifacts (
      id, workspace_id, project_id, artifact_type, revision, schema_version,
      value, created_by, correlation_id
    ) VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'generation_plan', 1, '1.0.0', '{}'::jsonb, 'tester', 'corr-sql-beh-02'
    )$$,
  '23505',
  NULL,
  'duplicate artifact revision rejected'
);

-- Production run + job for queue tests
INSERT INTO public.production_runs (
  id, workspace_id, project_id, generation_plan_artifact_id, generation_plan_revision,
  status, revision, policy_version, estimated_cost_minor, committed_cost_minor,
  released_cost_minor, currency, correlation_id, state
) VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  1, 'running', 1, '1.0.0', 10, 0, 0, 'USD', 'corr-sql-beh-01', '{}'::jsonb
);

INSERT INTO public.production_jobs (
  id, workspace_id, project_id, run_id, scene_id, step_id, attempt_id,
  action, provider_id, model_id, status, priority, payload
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'sc-1', 'step:1', 'a1', 'image', 'openai', 'gpt-image-1', 'queued', 10,
  '{"mode":"execute"}'::jsonb
);

-- Claim
SELECT ok(
  (SELECT count(*) = 1 FROM public.claim_production_jobs('worker-a', 1, 60)),
  'claim returns one job'
);

SELECT is(
  (SELECT status FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'leased',
  'job leased after claim'
);

SELECT ok(
  (SELECT lease_token IS NOT NULL FROM public.production_jobs
   WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'lease token set'
);

-- Bad worker heartbeat fails
SELECT throws_ok(
  $$SELECT public.heartbeat_production_job(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      (SELECT lease_token FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      'wrong-worker', 60
    )$$,
  'P0001',
  'lease_invalid',
  'bad worker heartbeat rejected'
);

-- Bad token complete fails
SELECT throws_ok(
  $$SELECT public.complete_production_job(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'worker-a',
      '{"ok":true}'::jsonb
    )$$,
  'P0001',
  'lease_invalid',
  'bad token complete rejected'
);

-- Heartbeat ok then complete
SELECT lives_ok(
  $$SELECT public.heartbeat_production_job(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      (SELECT lease_token FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      'worker-a', 60
    )$$,
  'heartbeat ok'
);

SELECT lives_ok(
  $$SELECT public.complete_production_job(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      (SELECT lease_token FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
      'worker-a',
      '{"status":"completed"}'::jsonb
    )$$,
  'complete ok'
);

SELECT is(
  (SELECT status FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  'completed',
  'job completed'
);

-- Double completion rejected
SELECT throws_ok(
  $$SELECT public.complete_production_job(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      coalesce(
        (SELECT lease_token FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
        'ffffffff-ffff-4fff-8fff-ffffffffffff'
      ),
      'worker-a',
      '{}'::jsonb
    )$$,
  'P0001',
  'lease_invalid',
  'double complete rejected'
);

-- Second job: reschedule to poll
INSERT INTO public.production_jobs (
  id, workspace_id, project_id, run_id, scene_id, step_id, attempt_id,
  action, provider_id, model_id, status, priority, payload
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'sc-1', 'step:2', 'a2', 'video', 'fal', 'm1', 'queued', 5,
  '{"mode":"execute"}'::jsonb
);

SELECT ok(
  (SELECT count(*) = 1 FROM public.claim_production_jobs('worker-b', 1, 60)),
  'claim second job'
);

SELECT lives_ok(
  $$SELECT public.reschedule_production_job(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
      (SELECT lease_token FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'),
      'worker-b',
      timezone('utc', now()) + interval '3 seconds',
      '{"mode":"poll","planRevisionId":"plan","scenePackageSceneId":"sc-1"}'::jsonb
    )$$,
  'reschedule to poll'
);

SELECT is(
  (SELECT status FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'),
  'queued',
  'rescheduled job queued'
);
SELECT is(
  (SELECT payload->>'mode' FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'),
  'poll',
  'payload mode poll'
);

-- Expire lease then reclaim
INSERT INTO public.production_jobs (
  id, workspace_id, project_id, run_id, scene_id, step_id, attempt_id,
  action, provider_id, model_id, status, priority, payload,
  lease_token, leased_by, leased_at, lease_expires_at
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'sc-1', 'step:3', 'a3', 'image', 'openai', 'm', 'leased', 1,
  '{"mode":"execute"}'::jsonb,
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'old-worker',
  timezone('utc', now()) - interval '10 minutes',
  timezone('utc', now()) - interval '5 minutes'
);

SELECT ok(
  (SELECT count(*) = 1 FROM public.claim_production_jobs('worker-c', 1, 60)),
  'expired lease reclaimable'
);
SELECT is(
  (SELECT leased_by FROM public.production_jobs WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03'),
  'worker-c',
  'reclaimed by new worker'
);

-- Ledger append-only
INSERT INTO public.cost_ledger (
  id, workspace_id, project_id, run_id, entry_type, amount_minor, currency,
  cost_status, description_code, idempotency_key, correlation_id
) VALUES (
  '11111111-1111-4111-8111-111111111101',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'reservation', 10, 'USD', 'reserved', 'test', 'sql-ledger-1', 'corr-sql-beh-01'
);

SELECT throws_ok(
  $$UPDATE public.cost_ledger SET amount_minor = 1
     WHERE id = '11111111-1111-4111-8111-111111111101'$$,
  'P0001',
  'cost_ledger is append-only',
  'ledger update forbidden'
);

SELECT throws_ok(
  $$DELETE FROM public.cost_ledger WHERE id = '11111111-1111-4111-8111-111111111101'$$,
  'P0001',
  'cost_ledger is append-only',
  'ledger delete forbidden'
);

-- Audit append-only
INSERT INTO public.audit_log (
  workspace_id, action, resource_type, resource_id, actor_type, actor_id, correlation_id
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'test', 'workspace', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'system', 'sql', 'corr-sql-beh-01'
);

SELECT throws_ok(
  $$UPDATE public.audit_log SET action = 'x' WHERE actor_id = 'sql'$$,
  'P0001',
  'audit_log is append-only',
  'audit update forbidden'
);

-- Idempotency begin
SELECT is(
  public.idempotency_begin(
    'sql-idem-1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'fp-1'
  ),
  'begun',
  'idempotency begin new'
);
SELECT is(
  public.idempotency_begin(
    'sql-idem-1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'fp-1'
  ),
  'begun',
  'idempotency same key+fp'
);
SELECT is(
  public.idempotency_begin(
    'sql-idem-1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'fp-OTHER'
  ),
  'fingerprint_mismatch',
  'idempotency fingerprint mismatch'
);

SELECT * FROM finish();
ROLLBACK;
