-- VHS-130 — fail_director_run metering (pgTAP). Porte 7G-B.

BEGIN;
SELECT plan(16);

INSERT INTO public.workspaces (id, slug, name)
VALUES ('a1300000-a130-4130-8130-a130a130a130', 'sql-130', 'SQL 130');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a1300000-a130-4130-8130-a130a130a130', 100000, 'USD');

INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'b1300000-b130-4130-8130-b130b130b130',
  'a1300000-a130-4130-8130-a130a130a130',
  'P130', 'draft', 1, '1.0.0', 'corr-130-01'
);

INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  value, created_by, correlation_id
) VALUES (
  'c1300000-c130-4130-8130-c130c130c130',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'video_project_brief', 1, '1.0.0',
  '{"projectName":"P130"}'::jsonb, 'tester', 'corr-130-01'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'video_project_brief',
  'c1300000-c130-4130-8130-c130c130c130',
  1, 'tester'
);

-- Run A: known cost 7 of 24 → commit 7 + release remainder 17 once
SELECT public.begin_or_get_marketing_director_run(
  'd1300000-d130-4130-8130-d130d130d130',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'c1300000-c130-4130-8130-c130c130c130',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-130-001', 'fingerprint130001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-130-begin', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'e1300000-e130-4130-8130-e130e130e130',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'd1300000-d130-4130-8130-d130d130d130',
  'marketing-1', 24, 'USD', 'corr-130-res1',
  'dir-reserve-d1300000-d130-4130-8130-d130d130d130'
);
SELECT public.fail_director_run(
  'd1300000-d130-4130-8130-d130d130d130',
  'a1300000-a130-4130-8130-a130a130a130',
  2, 'invalid_candidate', 'failed',
  'e1300000-e130-4130-8130-e130e130e130',
  'dir-fail-commit-d1300000-d130-4130-8130-d130d130d130',
  'corr-130-fail1',
  '{"totalTokens":30,"inputTokens":10,"outputTokens":20}'::jsonb,
  7,
  'committed'
);

SELECT is(
  (SELECT actual_cost_minor FROM public.director_runs WHERE id = 'd1300000-d130-4130-8130-d130d130d130'),
  7::bigint,
  'known cost sets actual_cost_minor'
);
SELECT is(
  (SELECT cost_status FROM public.director_runs WHERE id = 'd1300000-d130-4130-8130-d130d130d130'),
  'committed',
  'known cost sets cost_status committed'
);
SELECT is(
  (SELECT (usage->>'totalTokens')::int FROM public.director_runs WHERE id = 'd1300000-d130-4130-8130-d130d130d130'),
  30,
  'known cost persists usage'
);
SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'e1300000-e130-4130-8130-e130e130e130'),
  'committed',
  'reservation committed on metered fail'
);
SELECT is(
  (SELECT count(*)::int FROM public.cost_ledger
    WHERE reservation_id = 'e1300000-e130-4130-8130-e130e130e130' AND entry_type = 'commit'),
  1,
  'exactly one commit ledger row'
);
SELECT is(
  (SELECT count(*)::int FROM public.cost_ledger
    WHERE reservation_id = 'e1300000-e130-4130-8130-e130e130e130' AND entry_type = 'release'),
  1,
  'exactly one remainder release'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1300000-e130-4130-8130-e130e130e130' AND entry_type = 'release'),
  17::bigint,
  'remainder amount exact'
);
SELECT is(
  (SELECT currency FROM public.cost_ledger
    WHERE reservation_id = 'e1300000-e130-4130-8130-e130e130e130' AND entry_type = 'commit'),
  'USD',
  'ledger currency coherent'
);

-- Run B: usage only / unknown cost → full release, no invented actual
SELECT public.begin_or_get_marketing_director_run(
  'f1300000-f130-4130-8130-f130f130f130',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'c1300000-c130-4130-8130-c130c130c130',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-130-002', 'fingerprint130002aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-130-begin2', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'aa300000-aa30-4130-8130-aa30aa30aa30',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'f1300000-f130-4130-8130-f130f130f130',
  'marketing-2', 24, 'USD', 'corr-130-res2',
  'dir-reserve-f1300000-f130-4130-8130-f130f130f130'
);
SELECT public.fail_director_run(
  'f1300000-f130-4130-8130-f130f130f130',
  'a1300000-a130-4130-8130-a130a130a130',
  2, 'invalid_candidate', 'failed',
  'aa300000-aa30-4130-8130-aa30aa30aa30',
  'dir-release-f1300000-f130-4130-8130-f130f130f130',
  'corr-130-fail2',
  '{"totalTokens":12}'::jsonb,
  NULL,
  'unknown'
);

SELECT is(
  (SELECT actual_cost_minor FROM public.director_runs WHERE id = 'f1300000-f130-4130-8130-f130f130f130'),
  NULL::bigint,
  'usage-only does not invent actual_cost'
);
SELECT is(
  (SELECT (usage->>'totalTokens')::int FROM public.director_runs WHERE id = 'f1300000-f130-4130-8130-f130f130f130'),
  12,
  'usage-only persists usage'
);
SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'aa300000-aa30-4130-8130-aa30aa30aa30'),
  'released',
  'usage-only releases full reservation'
);
SELECT is(
  (SELECT count(*)::int FROM public.cost_ledger
    WHERE reservation_id = 'aa300000-aa30-4130-8130-aa30aa30aa30' AND entry_type = 'commit'),
  0,
  'usage-only has zero commit rows'
);

-- Run C: no metering (provider not called path) → full release
SELECT public.begin_or_get_marketing_director_run(
  'bb300000-bb30-4130-8130-bb30bb30bb30',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'c1300000-c130-4130-8130-c130c130c130',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-130-003', 'fingerprint130003aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-130-begin3', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'cc300000-cc30-4130-8130-cc30cc30cc30',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'bb300000-bb30-4130-8130-bb30bb30bb30',
  'marketing-3', 24, 'USD', 'corr-130-res3',
  'dir-reserve-bb300000-bb30-4130-8130-bb30bb30bb30'
);
SELECT public.fail_director_run(
  'bb300000-bb30-4130-8130-bb30bb30bb30',
  'a1300000-a130-4130-8130-a130a130a130',
  2, 'needs_input', 'needs_input',
  'cc300000-cc30-4130-8130-cc30cc30cc30',
  'dir-release-bb300000-bb30-4130-8130-bb30bb30bb30',
  'corr-130-fail3'
);

SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'cc300000-cc30-4130-8130-cc30cc30cc30'),
  'released',
  'no-metering path releases reservation'
);
SELECT is(
  (SELECT usage FROM public.director_runs WHERE id = 'bb300000-bb30-4130-8130-bb30bb30bb30'),
  NULL::jsonb,
  'no-metering leaves usage null'
);

-- Run D: actual > reserved → fail-closed, no silent cap
SELECT public.begin_or_get_marketing_director_run(
  'dd300000-dd30-4130-8130-dd30dd30dd30',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'c1300000-c130-4130-8130-c130c130c130',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-130-004', 'fingerprint130004aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-130-begin4', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'ee300000-ee30-4130-8130-ee30ee30ee30',
  'a1300000-a130-4130-8130-a130a130a130',
  'b1300000-b130-4130-8130-b130b130b130',
  'dd300000-dd30-4130-8130-dd30dd30dd30',
  'marketing-4', 24, 'USD', 'corr-130-res4',
  'dir-reserve-dd300000-dd30-4130-8130-dd30dd30dd30'
);

SELECT throws_ok(
  $$SELECT public.fail_director_run(
    'dd300000-dd30-4130-8130-dd30dd30dd30',
    'a1300000-a130-4130-8130-a130a130a130',
    2, 'invalid_candidate', 'failed',
    'ee300000-ee30-4130-8130-ee30ee30ee30',
    'dir-fail-commit-dd300000-dd30-4130-8130-dd30dd30dd30',
    'corr-130-fail4',
    '{"totalTokens":99}'::jsonb,
    100,
    'committed'
  )$$,
  'P0001',
  'actual_cost_exceeds_reservation',
  'actual > reserved is fail-closed'
);

SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'ee300000-ee30-4130-8130-ee30ee30ee30'),
  'active',
  'exceeds-reservation leaves reservation active (no silent commit)'
);

SELECT * FROM finish();
ROLLBACK;
