-- VHS-126 — brief revisions + persistent stale cascade (pgTAP).
BEGIN;
SELECT plan(22);

-- Columns
SELECT ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'active_artifact_revisions'
    AND column_name = 'stale'
), 'active_artifact_revisions.stale exists');

SELECT ok(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'active_artifact_revisions'
    AND column_name = 'stale_reason'
), 'stale_reason exists');

-- Grants — service_role only
SELECT ok(has_function_privilege(
  'service_role',
  'public.revise_project_brief(uuid,uuid,uuid,jsonb,text,integer,integer,text,text,text,text,text,text)',
  'EXECUTE'
), 'service_role can revise_project_brief');

SELECT ok(NOT has_function_privilege(
  'anon',
  'public.revise_project_brief(uuid,uuid,uuid,jsonb,text,integer,integer,text,text,text,text,text,text)',
  'EXECUTE'
), 'anon cannot revise_project_brief');

SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.list_project_stale_artifacts(uuid,uuid)',
  'EXECUTE'
), 'authenticated cannot list_project_stale_artifacts');

SELECT ok(has_function_privilege(
  'service_role',
  'public.clear_active_artifact_stale(uuid,uuid,text)',
  'EXECUTE'
), 'service_role can clear_active_artifact_stale');

-- Fixture
INSERT INTO public.workspaces (id, slug, name)
VALUES ('a126a126-a126-4126-8126-a126a126a126', 'sql-126', 'SQL 126');
INSERT INTO public.workspace_budget_policies (workspace_id, hard_limit_minor, currency)
VALUES ('a126a126-a126-4126-8126-a126a126a126', 100000, 'USD');

INSERT INTO public.video_projects (
  id, workspace_id, name, status, active_revision, schema_version, correlation_id
) VALUES (
  'b126b126-b126-4126-8126-b126b126b126',
  'a126a126-a126-4126-8126-a126a126a126',
  'Campagne 126', 'draft', 1, '1.0.0', 'corr-126'
);

INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  parent_revision_id, value, created_by, correlation_id
) VALUES (
  'c126c126-c126-4126-8126-c126c126c126',
  'a126a126-a126-4126-8126-a126a126a126',
  'b126b126-b126-4126-8126-b126b126b126',
  'video_project_brief', 1, '1.0.0', NULL,
  jsonb_build_object(
    'id', 'c126c126-c126-4126-8126-c126c126c126',
    'projectId', 'b126b126-b126-4126-8126-b126b126b126',
    'projectName', 'Campagne 126',
    'subjectType', 'product',
    'subjectName', 'Widget',
    'subjectDescription', 'Desc longue pour validation brief.',
    'objective', 'conversion',
    'platform', 'instagram',
    'durationSeconds', 30,
    'aspectRatio', '9:16',
    'language', 'fr',
    'tone', 'energetic',
    'mediaReferences', '[]'::jsonb,
    'schemaVersion', '1.0.0',
    'revision', 1,
    'createdAt', '2026-08-03T15:00:00Z',
    'createdBy', 'tester',
    'correlationId', 'corr-126-brf'
  ),
  'tester', 'corr-126-brf'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a126a126-a126-4126-8126-a126a126a126',
  'b126b126-b126-4126-8126-b126b126b126',
  'video_project_brief',
  'c126c126-c126-4126-8126-c126c126c126',
  1, 'tester'
);

-- Marketing depends on brief
INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  parent_revision_id, value, created_by, correlation_id
) VALUES (
  'd126d126-d126-4126-8126-d126d126d126',
  'a126a126-a126-4126-8126-a126a126a126',
  'b126b126-b126-4126-8126-b126b126b126',
  'marketing_plan', 1, '1.0.0', NULL,
  jsonb_build_object(
    'briefRevisionId', 'c126c126-c126-4126-8126-c126c126c126',
    'objective', 'conversion'
  ),
  'tester', 'corr-126-mkt'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a126a126-a126-4126-8126-a126a126a126',
  'b126b126-b126-4126-8126-b126b126b126',
  'marketing_plan',
  'd126d126-d126-4126-8126-d126d126d126',
  1, 'tester'
);

-- Independent artifact (wrong brief id) must NOT become stale
INSERT INTO public.project_artifacts (
  id, workspace_id, project_id, artifact_type, revision, schema_version,
  parent_revision_id, value, created_by, correlation_id
) VALUES (
  'e126e126-e126-4126-8126-e126e126e126',
  'a126a126-a126-4126-8126-a126a126a126',
  'b126b126-b126-4126-8126-b126b126b126',
  'creative_concept', 1, '1.0.0', NULL,
  jsonb_build_object(
    'marketingPlanRevisionId', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'title', 'Independent'
  ),
  'tester', 'corr-126-ind'
);

INSERT INTO public.active_artifact_revisions (
  workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
) VALUES (
  'a126a126-a126-4126-8126-a126a126a126',
  'b126b126-b126-4126-8126-b126b126b126',
  'creative_concept',
  'e126e126-e126-4126-8126-e126e126e126',
  1, 'tester'
);

-- Revise brief
SELECT ok(
  (public.revise_project_brief(
    'a126a126-a126-4126-8126-a126a126a126',
    'b126b126-b126-4126-8126-b126b126b126',
    'f126f126-f126-4126-8126-f126f126f126',
    jsonb_build_object(
      'id', 'f126f126-f126-4126-8126-f126f126f126',
      'projectId', 'b126b126-b126-4126-8126-b126b126b126',
      'projectName', 'Campagne 126 v2',
      'subjectType', 'product',
      'subjectName', 'Widget',
      'subjectDescription', 'Desc longue pour validation brief.',
      'objective', 'conversion',
      'platform', 'instagram',
      'durationSeconds', 30,
      'aspectRatio', '9:16',
      'language', 'fr',
      'tone', 'calm',
      'mediaReferences', '[]'::jsonb,
      'schemaVersion', '1.0.0',
      'revision', 2,
      'createdAt', '2026-08-03T15:10:00Z',
      'createdBy', 'tester',
      'correlationId', 'corr-126-brf-2'
    ),
    '1.0.0',
    1, 1,
    'idem-126-revise-001',
    'fp-126-revise-001',
    'corr-126-revise',
    'tester', 'shared_password', 'tester'
  )->>'status') = 'created',
  'revise_project_brief creates new revision'
);

SELECT is(
  (SELECT revision FROM public.active_artifact_revisions
   WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
     AND artifact_type = 'video_project_brief'),
  2,
  'active brief revision is 2'
);

SELECT is(
  (SELECT parent_revision_id FROM public.project_artifacts
   WHERE id = 'f126f126-f126-4126-8126-f126f126f126'),
  'c126c126-c126-4126-8126-c126c126c126'::uuid,
  'new brief parent points to previous'
);

SELECT ok(
  (SELECT value->>'projectName' FROM public.project_artifacts
   WHERE id = 'c126c126-c126-4126-8126-c126c126c126') = 'Campagne 126',
  'old brief revision immutable'
);

SELECT ok(
  (SELECT stale FROM public.active_artifact_revisions
   WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
     AND artifact_type = 'marketing_plan') = true,
  'marketing_plan marked stale via provenance'
);

SELECT is(
  (SELECT stale_reason FROM public.active_artifact_revisions
   WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
     AND artifact_type = 'marketing_plan'),
  'upstream_brief_revised',
  'stale reason recorded'
);

SELECT ok(
  (SELECT stale FROM public.active_artifact_revisions
   WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
     AND artifact_type = 'creative_concept') = false,
  'independent creative_concept not stale'
);

SELECT is(
  (SELECT active_revision FROM public.video_projects
   WHERE id = 'b126b126-b126-4126-8126-b126b126b126'),
  2,
  'project optimistic revision incremented'
);

SELECT ok(EXISTS (
  SELECT 1 FROM public.audit_log
  WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
    AND action = 'director.brief.revised'
), 'audit log written');

SELECT ok(EXISTS (
  SELECT 1 FROM public.domain_events
  WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
    AND event_type = 'director.brief.revised'
), 'outbox event written');

-- Idempotence
SELECT ok(
  (public.revise_project_brief(
    'a126a126-a126-4126-8126-a126a126a126',
    'b126b126-b126-4126-8126-b126b126b126',
    'f126f126-f126-4126-8126-f126f126f126',
    '{}'::jsonb, '1.0.0', 2, 2,
    'idem-126-revise-001', 'fp-126-revise-001',
    'corr-126-revise', 'tester', 'shared_password', 'tester'
  )->>'status') = 'existing',
  'idempotent revise returns existing'
);

-- Optimistic conflict
SELECT throws_ok(
  $$SELECT public.revise_project_brief(
    'a126a126-a126-4126-8126-a126a126a126',
    'b126b126-b126-4126-8126-b126b126b126',
    'aa26aa26-aa26-4a26-8a26-aa26aa26aa26',
    '{"projectName":"x"}'::jsonb, '1.0.0', 1, 2,
    'idem-126-conflict', 'fp-126-conflict',
    'corr-126-conflict', 'tester', 'shared_password', 'tester'
  )$$,
  'P0001',
  'optimistic_conflict',
  'wrong brief revision raises optimistic_conflict'
);

-- Clear stale
SELECT ok(
  (public.clear_active_artifact_stale(
    'a126a126-a126-4126-8126-a126a126a126',
    'b126b126-b126-4126-8126-b126b126b126',
    'marketing_plan'
  )->>'status') = 'cleared',
  'clear_active_artifact_stale works'
);

SELECT ok(
  (SELECT stale FROM public.active_artifact_revisions
   WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
     AND artifact_type = 'marketing_plan') = false,
  'marketing_plan stale cleared'
);

-- list_project_stale_artifacts empty after clear
SELECT is(
  public.list_project_stale_artifacts(
    'a126a126-a126-4126-8126-a126a126a126',
    'b126b126-b126-4126-8126-b126b126b126'
  ),
  '[]'::jsonb,
  'list stale empty after clear'
);

-- Artifacts not deleted
SELECT is(
  (SELECT count(*)::int FROM public.project_artifacts
   WHERE project_id = 'b126b126-b126-4126-8126-b126b126b126'
     AND artifact_type = 'video_project_brief'),
  2,
  'both brief revisions retained'
);

SELECT * FROM finish();
ROLLBACK;
