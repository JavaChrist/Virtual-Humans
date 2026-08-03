-- VHS-116 — create_director_project_with_brief RPC (pgTAP).
-- Local only: npx supabase test db

BEGIN;
SELECT plan(18);

SELECT has_function(
  'public',
  'create_director_project_with_brief',
  'create_director_project_with_brief exists'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.create_director_project_with_brief(uuid,uuid,uuid,text,jsonb,text,text,text,text,text)',
    'EXECUTE'
  ),
  'service_role execute create_director_project_with_brief'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.create_director_project_with_brief(uuid,uuid,uuid,text,jsonb,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute create_director_project_with_brief'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.create_director_project_with_brief(uuid,uuid,uuid,text,jsonb,text,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute create_director_project_with_brief'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='create_director_project_with_brief' LIMIT 1),
  'RPC is SECURITY DEFINER'
);

SELECT ok(
  (SELECT EXISTS (
     SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
     WHERE cfg ILIKE 'search_path%=%public%'
   ) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='create_director_project_with_brief' LIMIT 1),
  'RPC search_path=public'
);

-- Seed workspace
INSERT INTO public.workspaces (id, slug, name)
VALUES ('a116a116-a116-4116-8116-a116a116a116', 'sql-116', 'SQL 116');

-- Workspace absent → no partial project
SELECT throws_ok(
  $$SELECT public.create_director_project_with_brief(
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      'b116b116-b116-4116-8116-b116b116b116',
      'c116c116-c116-4116-8116-c116c116c116',
      'Ghost',
      '{"projectName":"Ghost","subjectType":"product"}'::jsonb,
      '1.0.0',
      'corr-116-missing-ws',
      'shared_password',
      'tester',
      'tester'
    )$$,
  'P0001',
  'workspace_not_found',
  'missing workspace rejected'
);

SELECT is(
  (SELECT count(*)::int FROM public.video_projects WHERE id = 'b116b116-b116-4116-8116-b116b116b116'),
  0,
  'no project left after missing workspace'
);

-- Happy path
SELECT ok(
  (
    SELECT (public.create_director_project_with_brief(
      'a116a116-a116-4116-8116-a116a116a116',
      'b116b116-b116-4116-8116-b116b116b116',
      'c116c116-c116-4116-8116-c116c116c116',
      'Projet 116',
      jsonb_build_object(
        'id', 'c116c116-c116-4116-8116-c116c116c116',
        'projectId', 'b116b116-b116-4116-8116-b116b116b116',
        'schemaVersion', '1.0.0',
        'revision', 1,
        'createdAt', '2026-08-02T12:00:00.000Z',
        'createdBy', 'tester',
        'correlationId', 'corr-116-happy-01',
        'projectName', 'Projet 116',
        'subjectType', 'product',
        'subjectName', 'Widget',
        'subjectDescription', 'Un produit de démo.',
        'objective', 'awareness',
        'platform', 'instagram',
        'durationSeconds', 30,
        'aspectRatio', '9:16',
        'language', 'fr',
        'tone', 'warm',
        'mediaReferences', '[]'::jsonb
      ),
      '1.0.0',
      'corr-116-happy-01',
      'shared_password',
      'tester',
      'tester'
    )->>'status') = 'created'
  ),
  'happy path status created'
);

SELECT is(
  (SELECT revision FROM public.project_artifacts
    WHERE project_id = 'b116b116-b116-4116-8116-b116b116b116'
      AND artifact_type = 'video_project_brief'),
  1,
  'artifact revision is 1'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.active_artifact_revisions
    WHERE project_id = 'b116b116-b116-4116-8116-b116b116b116'
      AND artifact_type = 'video_project_brief'
      AND revision = 1
      AND artifact_id = 'c116c116-c116-4116-8116-c116c116c116'
  ),
  'active revision pointer set'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE project_id = 'b116b116-b116-4116-8116-b116b116b116'
      AND action = 'director.project.created'
  ),
  'audit_log written'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.domain_events
    WHERE project_id = 'b116b116-b116-4116-8116-b116b116b116'
      AND event_type = 'director.project.created'
  ),
  'outbox domain_events written'
);

-- Idempotent replay (same business brief, different metadata timestamps)
SELECT is(
  (
    SELECT public.create_director_project_with_brief(
      'a116a116-a116-4116-8116-a116a116a116',
      'b116b116-b116-4116-8116-b116b116b116',
      'd116d116-d116-4116-8116-d116d116d116',
      'Projet 116',
      jsonb_build_object(
        'id', 'd116d116-d116-4116-8116-d116d116d116',
        'projectId', 'b116b116-b116-4116-8116-b116b116b116',
        'schemaVersion', '1.0.0',
        'revision', 1,
        'createdAt', '2026-08-02T12:05:00.000Z',
        'createdBy', 'tester',
        'correlationId', 'corr-116-replay-01',
        'projectName', 'Projet 116',
        'subjectType', 'product',
        'subjectName', 'Widget',
        'subjectDescription', 'Un produit de démo.',
        'objective', 'awareness',
        'platform', 'instagram',
        'durationSeconds', 30,
        'aspectRatio', '9:16',
        'language', 'fr',
        'tone', 'warm',
        'mediaReferences', '[]'::jsonb
      ),
      '1.0.0',
      'corr-116-replay-01',
      'shared_password',
      'tester',
      'tester'
    )->>'status'
  ),
  'existing',
  'identical business brief returns existing'
);

SELECT is(
  (SELECT count(*)::int FROM public.project_artifacts
    WHERE project_id = 'b116b116-b116-4116-8116-b116b116b116'
      AND artifact_type = 'video_project_brief'
      AND revision = 1),
  1,
  'still a single revision-1 brief artifact'
);

-- Conflict on different business brief
SELECT throws_ok(
  $$SELECT public.create_director_project_with_brief(
      'a116a116-a116-4116-8116-a116a116a116',
      'b116b116-b116-4116-8116-b116b116b116',
      'e116e116-e116-4116-8116-e116e116e116',
      'Projet 116',
      jsonb_build_object(
        'projectName', 'Projet 116',
        'subjectType', 'product',
        'subjectName', 'Autre',
        'subjectDescription', 'Différent',
        'objective', 'awareness',
        'platform', 'tiktok',
        'durationSeconds', 15,
        'aspectRatio', '9:16',
        'language', 'fr',
        'tone', 'warm',
        'mediaReferences', '[]'::jsonb
      ),
      '1.0.0',
      'corr-116-conflict-01',
      'shared_password',
      'tester',
      'tester'
    )$$,
  'P0001',
  'project_brief_conflict',
  'different brief conflicts'
);

-- Transaction rollback: invalid actor leaves nothing for a new project id
SELECT throws_ok(
  $$SELECT public.create_director_project_with_brief(
      'a116a116-a116-4116-8116-a116a116a116',
      'f116f116-f116-4116-8116-f116f116f116',
      'f116f116-f116-4116-8116-f116f116f117',
      'Rollback Project',
      '{"projectName":"Rollback Project"}'::jsonb,
      '1.0.0',
      'corr-116-rollback',
      'hacker',
      'tester',
      'tester'
    )$$,
  'P0001',
  'invalid_actor_type',
  'invalid actor rejected'
);

SELECT is(
  (SELECT count(*)::int FROM public.video_projects WHERE id = 'f116f116-f116-4116-8116-f116f116f116'),
  0,
  'rollback leaves no project for invalid actor'
);

SELECT * FROM finish();
ROLLBACK;
