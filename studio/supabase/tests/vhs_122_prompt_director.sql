-- VHS-122 — prompt director persistence (pgTAP).
BEGIN;
SELECT plan(16);
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_type_check' AND pg_get_constraintdef(oid) LIKE '%prompt%'), 'director_runs permits prompt');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_input_type_check' AND pg_get_constraintdef(oid) LIKE '%storyboard_project%'), 'director_runs permits storyboard_project input');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='project_artifacts_type_check' AND pg_get_constraintdef(oid) LIKE '%scene_package_set%'), 'project_artifacts permits scene_package_set');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='active_artifact_revisions_type_check' AND pg_get_constraintdef(oid) LIKE '%scene_package_set%'), 'active revisions permits scene_package_set');
SELECT ok(has_function_privilege('service_role','public.begin_or_get_prompt_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text)','EXECUTE'), 'service role can begin prompt');
SELECT ok(NOT has_function_privilege('anon','public.begin_or_get_prompt_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text)','EXECUTE'), 'anon cannot begin prompt');
SELECT ok(NOT has_function_privilege('authenticated','public.persist_scene_package_set(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,integer)','EXECUTE'), 'authenticated cannot persist package set');

INSERT INTO public.workspaces (id,slug,name) VALUES ('a122a122-a122-4122-8122-a122a122a122','sql-122','SQL 122');
INSERT INTO public.workspace_budget_policies (workspace_id,hard_limit_minor,currency) VALUES ('a122a122-a122-4122-8122-a122a122a122',100000,'USD');
INSERT INTO public.video_projects (id,workspace_id,name,status,active_revision,schema_version,correlation_id) VALUES ('b122b122-b122-4122-8122-b122b122b122','a122a122-a122-4122-8122-a122a122a122','P122','draft',1,'1.0.0','corr-122');
INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_by,correlation_id) VALUES
('c122c122-c122-4122-8122-c122c122c122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','video_project_brief',1,'1.0.0','{}','tester','corr-122'),
('d122d122-d122-4122-8122-d122d122d122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','marketing_plan',1,'1.0.0','{}','tester','corr-122'),
('e122e122-e122-4122-8122-e122e122e122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','creative_concept',1,'1.0.0','{}','tester','corr-122'),
('f122f122-f122-4122-8122-f122f122f122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','video_script',1,'1.0.0','{}','tester','corr-122'),
('71227122-7122-4122-8122-712271227122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','visual_direction',1,'1.0.0','{}','tester','corr-122'),
('81228122-8122-4122-8122-812281228122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','storyboard_project',1,'1.0.0','{"scenes":[{"id":"sc-1"}]}','tester','corr-122');
INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_by) VALUES
('a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','video_project_brief','c122c122-c122-4122-8122-c122c122c122',1,'tester'),
('a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','marketing_plan','d122d122-d122-4122-8122-d122d122d122',1,'tester'),
('a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','creative_concept','e122e122-e122-4122-8122-e122e122e122',1,'tester'),
('a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','video_script','f122f122-f122-4122-8122-f122f122f122',1,'tester'),
('a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','visual_direction','71227122-7122-4122-8122-712271227122',1,'tester'),
('a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','storyboard_project','81228122-8122-4122-8122-812281228122',1,'tester');

SELECT is((SELECT public.begin_or_get_prompt_director_run(
  '11111122-1111-4122-8122-111111221122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122',
  '81228122-8122-4122-8122-812281228122',1,'71227122-7122-4122-8122-712271227122',1,'f122f122-f122-4122-8122-f122f122f122',1,
  'e122e122-e122-4122-8122-e122e122e122',1,'d122d122-d122-4122-8122-d122d122d122',1,'c122c122-c122-4122-8122-c122c122c122',1,
  'deterministic','prompt-renderer-v1','1.0.0','prm-key-122-001','fingerprint122001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-122'
)->>'status'),'created','begin prompt created');

SELECT is((SELECT public.persist_scene_package_set(
  'a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','11111122-1111-4122-8122-111111221122','31113122-3111-4122-8122-311131223122',
  '81228122-8122-4122-8122-812281228122',1,'71227122-7122-4122-8122-712271227122',1,'f122f122-f122-4122-8122-f122f122f122',1,
  'e122e122-e122-4122-8122-e122e122e122',1,'d122d122-d122-4122-8122-d122d122d122',1,'c122c122-c122-4122-8122-c122c122c122',1,
  '{"artifactType":"scene_package_set","packages":[{"sceneId":"sc-1","sceneOrder":1}]}','1.0.0','corr-122','shared_password','tester','tester',1
)->>'status'),'created','persist package set created');

SELECT is((SELECT revision FROM public.active_artifact_revisions WHERE project_id='b122b122-b122-4122-8122-b122b122b122' AND artifact_type='scene_package_set'),1,'scene_package_set active revision');
SELECT is((SELECT cost_status FROM public.director_runs WHERE id='11111122-1111-4122-8122-111111221122'),'none','prompt run has no budget');
SELECT is((SELECT count(*)::int FROM public.budget_reservations WHERE project_id='b122b122-b122-4122-8122-b122b122b122'),0,'no budget reservation for prompt');
SELECT is((SELECT public.begin_or_get_prompt_director_run(
  '41114122-4111-4122-8122-411141224122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122',
  '81228122-8122-4122-8122-812281228122',1,'71227122-7122-4122-8122-712271227122',1,'f122f122-f122-4122-8122-f122f122f122',1,
  'e122e122-e122-4122-8122-e122e122e122',1,'d122d122-d122-4122-8122-d122d122d122',1,'c122c122-c122-4122-8122-c122c122c122',1,
  'deterministic','prompt-renderer-v1','1.0.0','prm-key-122-001','fingerprint122001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-122'
)->>'status'),'existing','idempotent begin existing');
SELECT is((SELECT count(*)::int FROM public.audit_log WHERE project_id='b122b122-b122-4122-8122-b122b122b122' AND action='director.prompt.completed'),1,'audit prompt completed');
SELECT is((SELECT public.begin_or_get_prompt_director_run(
  '61116122-6111-4122-8122-611161226122','a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122',
  '81228122-8122-4122-8122-812281228122',1,'71227122-7122-4122-8122-712271227122',1,'f122f122-f122-4122-8122-f122f122f122',1,
  'e122e122-e122-4122-8122-e122e122e122',1,'d122d122-d122-4122-8122-d122d122d122',1,'c122c122-c122-4122-8122-c122c122c122',1,
  'deterministic','prompt-renderer-v1','1.0.0','prm-key-122-empty','fingerprint122emptyaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-122'
)->>'status'),'created','begin second prompt run for empty-lot check');
SELECT throws_ok(
  $$SELECT public.persist_scene_package_set(
    'a122a122-a122-4122-8122-a122a122a122','b122b122-b122-4122-8122-b122b122b122','61116122-6111-4122-8122-611161226122','51115122-5111-4122-8122-511151225122',
    '81228122-8122-4122-8122-812281228122',1,'71227122-7122-4122-8122-712271227122',1,'f122f122-f122-4122-8122-f122f122f122',1,
    'e122e122-e122-4122-8122-e122e122e122',1,'d122d122-d122-4122-8122-d122d122d122',1,'c122c122-c122-4122-8122-c122c122c122',1,
    '{"artifactType":"scene_package_set","packages":[]}','1.0.0','corr-122','shared_password','tester','tester',1
  )$$,
  'incomplete_package_set',
  'refuse empty package lot'
);
SELECT * FROM finish();
ROLLBACK;
