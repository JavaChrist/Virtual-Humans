-- VHS-121B — storyboard director persistence (pgTAP).
BEGIN;
SELECT plan(12);
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_type_check' AND pg_get_constraintdef(oid) LIKE '%storyboard%'), 'director_runs permits storyboard');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_input_type_check' AND pg_get_constraintdef(oid) LIKE '%visual_direction%'), 'director_runs permits visual_direction input');
SELECT ok(has_function_privilege('service_role','public.begin_or_get_storyboard_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)','EXECUTE'), 'service role can begin storyboard');
SELECT ok(NOT has_function_privilege('anon','public.begin_or_get_storyboard_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)','EXECUTE'), 'anon cannot begin storyboard');
SELECT ok(NOT has_function_privilege('authenticated','public.persist_storyboard_project(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,uuid,bigint,text,jsonb,integer,text)','EXECUTE'), 'authenticated cannot persist storyboard');
INSERT INTO public.workspaces (id,slug,name) VALUES ('a121a121-a121-4121-8121-a121a121a121','sql-121b','SQL 121B');
INSERT INTO public.workspace_budget_policies (workspace_id,hard_limit_minor,currency) VALUES ('a121a121-a121-4121-8121-a121a121a121',100000,'USD');
INSERT INTO public.video_projects (id,workspace_id,name,status,active_revision,schema_version,correlation_id) VALUES ('b121b121-b121-4121-8121-b121b121b121','a121a121-a121-4121-8121-a121a121a121','P121B','draft',1,'1.0.0','corr-121b');
INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_by,correlation_id) VALUES
('c121c121-c121-4121-8121-c121c121c121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','video_project_brief',1,'1.0.0','{}','tester','corr-121b'),
('d121d121-d121-4121-8121-d121d121d121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','marketing_plan',1,'1.0.0','{}','tester','corr-121b'),
('e121e121-e121-4121-8121-e121e121e121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','creative_concept',1,'1.0.0','{}','tester','corr-121b'),
('f121f121-f121-4121-8121-f121f121f121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','video_script',1,'1.0.0','{}','tester','corr-121b'),
('71217121-7121-4121-8121-712171217121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','visual_direction',1,'1.0.0','{}','tester','corr-121b');
INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_by) VALUES
('a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','video_project_brief','c121c121-c121-4121-8121-c121c121c121',1,'tester'),
('a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','marketing_plan','d121d121-d121-4121-8121-d121d121d121',1,'tester'),
('a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','creative_concept','e121e121-e121-4121-8121-e121e121e121',1,'tester'),
('a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','video_script','f121f121-f121-4121-8121-f121f121f121',1,'tester'),
('a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','visual_direction','71217121-7121-4121-8121-712171217121',1,'tester');
SELECT is((SELECT public.begin_or_get_storyboard_director_run('11111121-1111-4121-8121-111111211121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','71217121-7121-4121-8121-712171217121',1,'f121f121-f121-4121-8121-f121f121f121',1,'e121e121-e121-4121-8121-e121e121e121',1,'d121d121-d121-4121-8121-d121d121d121',1,'c121c121-c121-4121-8121-c121c121c121',1,'gpt-5.6-terra','stb-v1','1.0.0','stb-key-121b-001','fingerprint121b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-121b',100,'USD')->>'status'),'created','begin storyboard created');
SELECT lives_ok($$SELECT public.reserve_director_budget('21112121-2111-4121-8121-211121212121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','11111121-1111-4121-8121-111111211121','storyboard-1',100,'USD','corr-121b','ledger-121b')$$,'reserve storyboard budget');
SELECT is((SELECT public.persist_storyboard_project('a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','11111121-1111-4121-8121-111111211121','31113121-3111-4121-8121-311131213121','71217121-7121-4121-8121-712171217121',1,'f121f121-f121-4121-8121-f121f121f121',1,'e121e121-e121-4121-8121-e121e121e121',1,'d121d121-d121-4121-8121-d121d121d121',1,'c121c121-c121-4121-8121-c121c121c121',1,'{"title":"SB","scenes":[{"id":"sc-1","order":1,"purpose":"hook","durationSeconds":5}]}','1.0.0','corr-121b','shared_password','tester','tester','21112121-2111-4121-8121-211121212121',100,'committed',NULL,2,'dir-commit-121b')->>'status'),'created','persist storyboard created');
SELECT is((SELECT revision FROM public.active_artifact_revisions WHERE project_id='b121b121-b121-4121-8121-b121b121b121' AND artifact_type='storyboard_project'),1,'storyboard project active revision');
SELECT is((SELECT count(*)::int FROM public.storyboard_scenes WHERE project_id='b121b121-b121-4121-8121-b121b121b121' AND scene_id='sc-1'),1,'storyboard_scenes projection row');
SELECT is((SELECT public.begin_or_get_storyboard_director_run('41114121-4111-4121-8121-411141214121','a121a121-a121-4121-8121-a121a121a121','b121b121-b121-4121-8121-b121b121b121','71217121-7121-4121-8121-712171217121',1,'f121f121-f121-4121-8121-f121f121f121',1,'e121e121-e121-4121-8121-e121e121e121',1,'d121d121-d121-4121-8121-d121d121d121',1,'c121c121-c121-4121-8121-c121c121c121',1,'gpt-5.6-terra','stb-v1','1.0.0','stb-key-121b-001','fingerprint121b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-121b',100,'USD')->>'status'),'existing','idempotent begin existing');
SELECT is((SELECT count(*)::int FROM public.audit_log WHERE project_id='b121b121-b121-4121-8121-b121b121b121' AND action='director.storyboard.completed'),1,'audit storyboard completed');
SELECT * FROM finish();
ROLLBACK;
