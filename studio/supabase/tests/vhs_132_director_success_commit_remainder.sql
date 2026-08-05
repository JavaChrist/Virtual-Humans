-- VHS-132 — director_budget_commit_reservation + persist_* remainder (pgTAP). Porte 8B.
-- Currency: helper has no currency param (N/A); reservation currency flows from budget_reservations.

BEGIN;
SELECT plan(36);

-- ── Shared fixtures ─────────────────────────────────────────────────────────
INSERT INTO public.workspaces (id, slug, name)
VALUES
  ('a1320000-a132-4132-8132-a132a132a132', 'sql-132', 'SQL 132'),
  ('a1320001-a132-4132-8132-a132a132a131', 'sql-132b', 'SQL 132B');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES
  ('a1320000-a132-4132-8132-a132a132a132', 100000, 'USD'),
  ('a1320001-a132-4132-8132-a132a132a131', 100000, 'USD');

INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'b1320000-b132-4132-8132-b132b132b132',
  'a1320000-a132-4132-8132-a132a132a132',
  'P132', 'draft', 1, '1.0.0', 'corr-132-base'
);

INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  value, created_by, correlation_id
) VALUES (
  'c1320000-c132-4132-8132-c132c132c132',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'video_project_brief', 1, '1.0.0',
  '{"projectName":"P132"}'::jsonb, 'tester', 'corr-132-base'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'video_project_brief',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'tester'
);

-- ── Helper metadata ───────────────────────────────────────────────────────────
SELECT has_function(
  'public',
  'director_budget_commit_reservation',
  ARRAY['uuid','uuid','uuid','uuid','bigint','text','text','text'],
  'helper director_budget_commit_reservation exists'
);

SELECT ok(
  (SELECT proacl::text LIKE '%service_role%'
     FROM pg_proc WHERE proname = 'director_budget_commit_reservation'),
  'helper executable by service_role (acl present)'
);

-- ── H1: actual = reserved (full commit, no release row) ─────────────────────
SELECT public.begin_or_get_marketing_director_run(
  'd1320101-d132-4132-8132-d132d132d101',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-h1', 'fingerprint132h001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-h1', 20, 'USD'
);
SELECT public.reserve_director_budget(
  'e1320101-e132-4132-8132-e132e132e101',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1320101-d132-4132-8132-d132d132d101',
  'marketing-1', 20, 'USD', 'corr-132-h1-res',
  'dir-reserve-d1320101-d132-4132-8132-d132d132d101'
);
SELECT public.director_budget_commit_reservation(
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'e1320101-e132-4132-8132-e132e132e101',
  'd1320101-d132-4132-8132-d132d132d101',
  20, 'committed', 'dir-commit-h1', 'corr-132-h1-commit'
);

SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'e1320101-e132-4132-8132-e132e132e101'),
  'committed',
  'H1 full commit marks reservation committed'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1320101-e132-4132-8132-e132e132e101'
      AND entry_type = 'commit'
      AND description_code = 'director_budget_commit'),
  20::bigint,
  'H1 commits full reserved amount'
);
SELECT is(
  (SELECT count(*)::int FROM public.cost_ledger
    WHERE reservation_id = 'e1320101-e132-4132-8132-e132e132e101'
      AND entry_type = 'release'),
  0,
  'H1 full commit writes no release row'
);

-- ── H2: actual < reserved (commit + release remainder) ──────────────────────
SELECT public.begin_or_get_marketing_director_run(
  'd1320102-d132-4132-8132-d132d132d102',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-h2', 'fingerprint132h002aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-h2', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'e1320102-e132-4132-8132-e132e132e102',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1320102-d132-4132-8132-d132d132d102',
  'marketing-1', 24, 'USD', 'corr-132-h2-res',
  'dir-reserve-d1320102-d132-4132-8132-d132d132d102'
);
SELECT public.director_budget_commit_reservation(
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'e1320102-e132-4132-8132-e132e132e102',
  'd1320102-d132-4132-8132-d132d132d102',
  4, 'committed', 'dir-commit-h2', 'corr-132-h2-commit'
);

SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1320102-e132-4132-8132-e132e132e102'
      AND entry_type = 'commit'
      AND description_code = 'director_budget_commit'),
  4::bigint,
  'H2 commits actual 4'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1320102-e132-4132-8132-e132e132e102'
      AND entry_type = 'release'
      AND description_code = 'director_budget_commit_release_remainder'),
  20::bigint,
  'H2 releases remainder 20'
);
SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'e1320102-e132-4132-8132-e132e132e102'),
  'committed',
  'H2 remainder commit marks reservation committed'
);

-- ── H3: actual = 0 (commit 0 + release full reserved) ───────────────────────
SELECT public.begin_or_get_marketing_director_run(
  'd1320103-d132-4132-8132-d132d132d103',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-h3', 'fingerprint132h003aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-h3', 15, 'USD'
);
SELECT public.reserve_director_budget(
  'e1320103-e132-4132-8132-e132e132e103',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1320103-d132-4132-8132-d132d132d103',
  'marketing-1', 15, 'USD', 'corr-132-h3-res',
  'dir-reserve-d1320103-d132-4132-8132-d132d132d103'
);
SELECT public.director_budget_commit_reservation(
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'e1320103-e132-4132-8132-e132e132e103',
  'd1320103-d132-4132-8132-d132d132d103',
  0, 'committed', 'dir-commit-h3', 'corr-132-h3-commit'
);

SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1320103-e132-4132-8132-e132e132e103'
      AND entry_type = 'commit'
      AND description_code = 'director_budget_commit'),
  0::bigint,
  'H3 zero actual commits 0'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1320103-e132-4132-8132-e132e132e103'
      AND entry_type = 'release'
      AND description_code = 'director_budget_commit_release_remainder'),
  15::bigint,
  'H3 zero actual releases full reserved 15'
);
SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'e1320103-e132-4132-8132-e132e132e103'),
  'committed',
  'H3 zero actual marks reservation committed'
);

-- ── After success: no active reservations (before overflow case) ─────────────
SELECT is(
  (SELECT count(*)::int FROM public.budget_reservations
    WHERE workspace_id = 'a1320000-a132-4132-8132-a132a132a132'
      AND status = 'active'),
  0,
  'after helper success commits workspace has zero active reservations'
);

-- ── No double ledger on H2 remainder reservation ────────────────────────────
SELECT is(
  (SELECT count(*)::int FROM public.cost_ledger
    WHERE reservation_id = 'e1320102-e132-4132-8132-e132e132e102'
      AND entry_type = 'commit'),
  1,
  'H2 exactly one commit ledger row'
);
SELECT is(
  (SELECT count(*)::int FROM public.cost_ledger
    WHERE reservation_id = 'e1320102-e132-4132-8132-e132e132e102'
      AND entry_type = 'release'),
  1,
  'H2 exactly one release ledger row'
);

-- ── H4: actual > reserved → fail-closed, reservation stays active ───────────
SELECT public.begin_or_get_marketing_director_run(
  'd1320104-d132-4132-8132-d132d132d104',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-h4', 'fingerprint132h004aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-h4', 10, 'USD'
);
SELECT public.reserve_director_budget(
  'e1320104-e132-4132-8132-e132e132e104',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1320104-d132-4132-8132-d132d132d104',
  'marketing-1', 10, 'USD', 'corr-132-h4-res',
  'dir-reserve-d1320104-d132-4132-8132-d132d132d104'
);

SELECT throws_ok(
  $$SELECT public.director_budget_commit_reservation(
    'a1320000-a132-4132-8132-a132a132a132',
    'b1320000-b132-4132-8132-b132b132b132',
    'e1320104-e132-4132-8132-e132e132e104',
    'd1320104-d132-4132-8132-d132d132d104',
    11, 'committed', 'dir-commit-h4', 'corr-132-h4-overflow'
  )$$,
  'P0001',
  'actual_cost_exceeds_reservation',
  'H4 fail-closed when actual exceeds reservation'
);
SELECT is(
  (SELECT status FROM public.budget_reservations WHERE id = 'e1320104-e132-4132-8132-e132e132e104'),
  'active',
  'H4 overflow leaves reservation active'
);

-- ── H5: replay on already committed reservation ───────────────────────────────
SELECT throws_ok(
  $$SELECT public.director_budget_commit_reservation(
    'a1320000-a132-4132-8132-a132a132a132',
    'b1320000-b132-4132-8132-b132b132b132',
    'e1320101-e132-4132-8132-e132e132e101',
    'd1320101-d132-4132-8132-d132d132d101',
    20, 'committed', 'dir-commit-h1-replay', 'corr-132-h1-replay'
  )$$,
  'P0001',
  'reservation_not_active',
  'H5 replay on committed reservation throws reservation_not_active'
);

-- ── H6: sequential double-commit (concurrent-style) ─────────────────────────
SELECT public.begin_or_get_marketing_director_run(
  'd1320106-d132-4132-8132-d132d132d106',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-h6', 'fingerprint132h006aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-h6', 12, 'USD'
);
SELECT public.reserve_director_budget(
  'e1320106-e132-4132-8132-e132e132e106',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1320106-d132-4132-8132-d132d132d106',
  'marketing-1', 12, 'USD', 'corr-132-h6-res',
  'dir-reserve-d1320106-d132-4132-8132-d132d132d106'
);
SELECT public.director_budget_commit_reservation(
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'e1320106-e132-4132-8132-e132e132e106',
  'd1320106-d132-4132-8132-d132d132d106',
  5, 'committed', 'dir-commit-h6', 'corr-132-h6-commit'
);

SELECT throws_ok(
  $$SELECT public.director_budget_commit_reservation(
    'a1320000-a132-4132-8132-a132a132a132',
    'b1320000-b132-4132-8132-b132b132b132',
    'e1320106-e132-4132-8132-e132e132e106',
    'd1320106-d132-4132-8132-d132d132d106',
    5, 'committed', 'dir-commit-h6-2', 'corr-132-h6-replay'
  )$$,
  'P0001',
  'reservation_not_active',
  'H6 second sequential commit throws reservation_not_active'
);

-- ── H7: workspace_mismatch (reservation in other workspace) ───────────────────
SELECT public.begin_or_get_marketing_director_run(
  'd1320107-d132-4132-8132-d132d132d107',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-h7', 'fingerprint132h007aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-h7', 10, 'USD'
);
SELECT public.reserve_director_budget(
  'e1320107-e132-4132-8132-e132e132e107',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1320107-d132-4132-8132-d132d132d107',
  'marketing-1', 10, 'USD', 'corr-132-h7-res',
  'dir-reserve-d1320107-d132-4132-8132-d132d132d107'
);

SELECT throws_ok(
  $$SELECT public.director_budget_commit_reservation(
    'a1320001-a132-4132-8132-a132a132a131',
    'b1320000-b132-4132-8132-b132b132b132',
    'e1320107-e132-4132-8132-e132e132e107',
    'd1320107-d132-4132-8132-d132d132d107',
    5, 'committed', 'dir-commit-h7', 'corr-132-h7-mismatch'
  )$$,
  'P0001',
  'workspace_mismatch',
  'H7 wrong workspace throws workspace_mismatch'
);

-- ── H8: terminal reservation already released ───────────────────────────────
SELECT public.begin_or_get_marketing_director_run(
  'd1320108-d132-4132-8132-d132d132d108',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-h8', 'fingerprint132h008aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-h8', 10, 'USD'
);
SELECT public.reserve_director_budget(
  'e1320108-e132-4132-8132-e132e132e108',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1320108-d132-4132-8132-d132d132d108',
  'marketing-1', 10, 'USD', 'corr-132-h8-res',
  'dir-reserve-d1320108-d132-4132-8132-d132d132d108'
);
SELECT public.fail_director_run(
  'd1320108-d132-4132-8132-d132d132d108',
  'a1320000-a132-4132-8132-a132a132a132',
  2, 'needs_input', 'needs_input',
  'e1320108-e132-4132-8132-e132e132e108',
  'dir-release-d1320108-d132-4132-8132-d132d132d108',
  'corr-132-h8-fail'
);

SELECT throws_ok(
  $$SELECT public.director_budget_commit_reservation(
    'a1320000-a132-4132-8132-a132a132a132',
    'b1320000-b132-4132-8132-b132b132b132',
    'e1320108-e132-4132-8132-e132e132e108',
    'd1320108-d132-4132-8132-d132d132d108',
    5, 'committed', 'dir-commit-h8', 'corr-132-h8-terminal'
  )$$,
  'P0001',
  'reservation_not_active',
  'H8 released reservation throws reservation_not_active'
);

-- ── persist_marketing_plan: actual < reserved + usage tokens ────────────────
SELECT public.begin_or_get_marketing_director_run(
  'd1321000-d132-4132-8132-d132d132d100',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'c1320000-c132-4132-8132-c132c132c132',
  1, 'gpt-5.6', 'marketing-analyzer-v2', '1.0.0',
  'mkt-key-132-p1', 'fingerprint132p001aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-p1', 24, 'USD'
);
SELECT public.reserve_director_budget(
  'e1321000-e132-4132-8132-e132e132e100',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1321000-d132-4132-8132-d132d132d100',
  'marketing-1', 24, 'USD', 'corr-132-p1-res',
  'dir-reserve-d1321000-d132-4132-8132-d132d132d100'
);

SELECT is(
  (
    SELECT public.persist_marketing_plan(
      'a1320000-a132-4132-8132-a132a132a132',
      'b1320000-b132-4132-8132-b132b132b132',
      'd1321000-d132-4132-8132-d132d132d100',
      'f1321000-f132-4132-8132-f132f132f100',
      'c1320000-c132-4132-8132-c132c132c132',
      1,
      '{"marketingObjective":"awareness","mainBenefit":"x"}'::jsonb,
      '1.0.0', 'corr-132-p1-persist', 'shared_password', 'tester', 'tester',
      'e1321000-e132-4132-8132-e132e132e100', 4, 'committed',
      '{"totalTokens":10}'::jsonb, 2,
      'dir-commit-d1321000-d132-4132-8132-d132d132d100'
    )->>'status'
  ),
  'created',
  'persist_marketing_plan created with remainder commit'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1321000-e132-4132-8132-e132e132e100'
      AND entry_type = 'commit'),
  4::bigint,
  'persist_marketing_plan commits actual 4'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1321000-e132-4132-8132-e132e132e100'
      AND entry_type = 'release'),
  20::bigint,
  'persist_marketing_plan releases remainder 20'
);
SELECT is(
  (SELECT (usage->>'totalTokens')::int FROM public.director_runs
    WHERE id = 'd1321000-d132-4132-8132-d132d132d100'),
  10,
  'persist_marketing_plan persists usage tokens only'
);

-- ── persist_creative_concept: actual < reserved ───────────────────────────────
SELECT public.begin_or_get_creative_director_run(
  'd1322000-d132-4132-8132-d132d132d200',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'f1321000-f132-4132-8132-f132f132f100',
  1,
  'c1320000-c132-4132-8132-c132c132c132',
  1,
  'gpt-5.6-terra', 'creative-analyzer-v1', '1.0.0',
  'cre-key-132-p2', 'fingerprint132p002aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-p2', 30, 'USD'
);
SELECT public.reserve_director_budget(
  'e1322000-e132-4132-8132-e132e132e200',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1322000-d132-4132-8132-d132d132d200',
  'creative-1', 30, 'USD', 'corr-132-p2-res',
  'dir-reserve-d1322000-d132-4132-8132-d132d132d200'
);

SELECT is(
  (
    SELECT public.persist_creative_concept(
      'a1320000-a132-4132-8132-a132a132a132',
      'b1320000-b132-4132-8132-b132b132b132',
      'd1322000-d132-4132-8132-d132d132d200',
      '13221322-1322-4132-8132-132213221322',
      'f1321000-f132-4132-8132-f132f132f100',
      1,
      'c1320000-c132-4132-8132-c132c132c132',
      1,
      '{"title":"Concept"}'::jsonb,
      '1.0.0', 'corr-132-p2-persist', 'shared_password', 'tester', 'tester',
      'e1322000-e132-4132-8132-e132e132e200', 8, 'committed',
      '{"totalTokens":12}'::jsonb, 2,
      'dir-commit-d1322000-d132-4132-8132-d132d132d200'
    )->>'status'
  ),
  'created',
  'persist_creative_concept created with remainder commit'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1322000-e132-4132-8132-e132e132e200'
      AND entry_type = 'commit'),
  8::bigint,
  'persist_creative_concept commits actual 8'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1322000-e132-4132-8132-e132e132e200'
      AND entry_type = 'release'),
  22::bigint,
  'persist_creative_concept releases remainder 22'
);

-- ── persist_video_script: actual < reserved ───────────────────────────────────
SELECT public.begin_or_get_script_director_run(
  'd1323000-d132-4132-8132-d132d132d300',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  '13221322-1322-4132-8132-132213221322',
  1,
  'f1321000-f132-4132-8132-f132f132f100',
  1,
  'c1320000-c132-4132-8132-c132c132c132',
  1,
  'gpt-5.6-terra', 'script-v1', '1.0.0',
  'scr-key-132-p3', 'fingerprint132p003aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-p3', 20, 'USD'
);
SELECT public.reserve_director_budget(
  'e1323000-e132-4132-8132-e132e132e300',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1323000-d132-4132-8132-d132d132d300',
  'script-1', 20, 'USD', 'corr-132-p3-res',
  'dir-reserve-d1323000-d132-4132-8132-d132d132d300'
);

SELECT is(
  (
    SELECT public.persist_video_script(
      'a1320000-a132-4132-8132-a132a132a132',
      'b1320000-b132-4132-8132-b132b132b132',
      'd1323000-d132-4132-8132-d132d132d300',
      '13231323-1323-4132-8132-132313231323',
      '13221322-1322-4132-8132-132213221322',
      1,
      'f1321000-f132-4132-8132-f132f132f100',
      1,
      'c1320000-c132-4132-8132-c132c132c132',
      1,
      '{"title":"Script"}'::jsonb,
      '1.0.0', 'corr-132-p3-persist', 'shared_password', 'tester', 'tester',
      'e1323000-e132-4132-8132-e132e132e300', 6, 'committed',
      '{"totalTokens":14}'::jsonb, 2,
      'dir-commit-d1323000-d132-4132-8132-d132d132d300'
    )->>'status'
  ),
  'created',
  'persist_video_script created with remainder commit'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1323000-e132-4132-8132-e132e132e300'
      AND entry_type = 'commit'),
  6::bigint,
  'persist_video_script commits actual 6'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1323000-e132-4132-8132-e132e132e300'
      AND entry_type = 'release'),
  14::bigint,
  'persist_video_script releases remainder 14'
);

-- ── persist_visual_direction: actual < reserved ───────────────────────────────
SELECT public.begin_or_get_art_director_run(
  'd1324000-d132-4132-8132-d132d132d400',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  '13231323-1323-4132-8132-132313231323',
  1,
  '13221322-1322-4132-8132-132213221322',
  1,
  'f1321000-f132-4132-8132-f132f132f100',
  1,
  'c1320000-c132-4132-8132-c132c132c132',
  1,
  'gpt-5.6-terra', 'art-v1', '1.0.0',
  'art-key-132-p4', 'fingerprint132p004aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-p4', 30, 'USD'
);
SELECT public.reserve_director_budget(
  'e1324000-e132-4132-8132-e132e132e400',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1324000-d132-4132-8132-d132d132d400',
  'art-1', 30, 'USD', 'corr-132-p4-res',
  'dir-reserve-d1324000-d132-4132-8132-d132d132d400'
);

SELECT is(
  (
    SELECT public.persist_visual_direction(
      'a1320000-a132-4132-8132-a132a132a132',
      'b1320000-b132-4132-8132-b132b132b132',
      'd1324000-d132-4132-8132-d132d132d400',
      '13241324-1324-4132-8132-132413241324',
      '13231323-1323-4132-8132-132313231323',
      1,
      '13221322-1322-4132-8132-132213221322',
      1,
      'f1321000-f132-4132-8132-f132f132f100',
      1,
      'c1320000-c132-4132-8132-c132c132c132',
      1,
      '{"globalStyle":{"style":"commercial"}}'::jsonb,
      '1.0.0', 'corr-132-p4-persist', 'shared_password', 'tester', 'tester',
      'e1324000-e132-4132-8132-e132e132e400', 5, 'committed',
      '{"totalTokens":16}'::jsonb, 2,
      'dir-commit-d1324000-d132-4132-8132-d132d132d400'
    )->>'status'
  ),
  'created',
  'persist_visual_direction created with remainder commit'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1324000-e132-4132-8132-e132e132e400'
      AND entry_type = 'commit'),
  5::bigint,
  'persist_visual_direction commits actual 5'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1324000-e132-4132-8132-e132e132e400'
      AND entry_type = 'release'),
  25::bigint,
  'persist_visual_direction releases remainder 25'
);

-- ── persist_storyboard_project: actual < reserved ─────────────────────────────
SELECT public.begin_or_get_storyboard_director_run(
  'd1325000-d132-4132-8132-d132d132d500',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  '13241324-1324-4132-8132-132413241324',
  1,
  '13231323-1323-4132-8132-132313231323',
  1,
  '13221322-1322-4132-8132-132213221322',
  1,
  'f1321000-f132-4132-8132-f132f132f100',
  1,
  'c1320000-c132-4132-8132-c132c132c132',
  1,
  'gpt-5.6-terra', 'stb-v1', '1.0.0',
  'stb-key-132-p5', 'fingerprint132p005aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'corr-132-p5', 25, 'USD'
);
SELECT public.reserve_director_budget(
  'e1325000-e132-4132-8132-e132e132e500',
  'a1320000-a132-4132-8132-a132a132a132',
  'b1320000-b132-4132-8132-b132b132b132',
  'd1325000-d132-4132-8132-d132d132d500',
  'storyboard-1', 25, 'USD', 'corr-132-p5-res',
  'dir-reserve-d1325000-d132-4132-8132-d132d132d500'
);

SELECT is(
  (
    SELECT public.persist_storyboard_project(
      'a1320000-a132-4132-8132-a132a132a132',
      'b1320000-b132-4132-8132-b132b132b132',
      'd1325000-d132-4132-8132-d132d132d500',
      '13251325-1325-4132-8132-132513251325',
      '13241324-1324-4132-8132-132413241324',
      1,
      '13231323-1323-4132-8132-132313231323',
      1,
      '13221322-1322-4132-8132-132213221322',
      1,
      'f1321000-f132-4132-8132-f132f132f100',
      1,
      'c1320000-c132-4132-8132-c132c132c132',
      1,
      '{"title":"SB","scenes":[{"id":"sc-132","order":1,"purpose":"hook","durationSeconds":5}]}'::jsonb,
      '1.0.0', 'corr-132-p5-persist', 'shared_password', 'tester', 'tester',
      'e1325000-e132-4132-8132-e132e132e500', 7, 'committed',
      '{"totalTokens":18}'::jsonb, 2,
      'dir-commit-d1325000-d132-4132-8132-d132d132d500'
    )->>'status'
  ),
  'created',
  'persist_storyboard_project created with remainder commit'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1325000-e132-4132-8132-e132e132e500'
      AND entry_type = 'commit'),
  7::bigint,
  'persist_storyboard_project commits actual 7'
);
SELECT is(
  (SELECT amount_minor FROM public.cost_ledger
    WHERE reservation_id = 'e1325000-e132-4132-8132-e132e132e500'
      AND entry_type = 'release'),
  18::bigint,
  'persist_storyboard_project releases remainder 18'
);

SELECT * FROM finish();
ROLLBACK;
