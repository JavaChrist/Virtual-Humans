-- VHS-119B — script director persistence (pgTAP).
BEGIN;
SELECT plan(11);
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_type_check' AND pg_get_constraintdef(oid) LIKE '%script%'), 'director_runs permits script');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_input_type_check' AND pg_get_constraintdef(oid) LIKE '%creative_concept%'), 'director_runs permits creative_concept input');
SELECT ok(has_function_privilege('service_role','public.begin_or_get_script_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)','EXECUTE'), 'service role can begin script');
SELECT ok(NOT has_function_privilege('anon','public.begin_or_get_script_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)','EXECUTE'), 'anon cannot begin script');
SELECT ok(NOT has_function_privilege('authenticated','public.persist_video_script(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,uuid,bigint,text,jsonb,integer,text)','EXECUTE'), 'authenticated cannot persist script');
INSERT INTO public.workspaces (id,slug,name) VALUES ('a119a119-a119-4119-8119-a119a119a119','sql-119b','SQL 119B');
INSERT INTO public.workspace_budget_policies (workspace_id,hard_limit_minor,currency) VALUES ('a119a119-a119-4119-8119-a119a119a119',100000,'USD');
INSERT INTO public.video_projects (id,workspace_id,name,status,active_revision,schema_version,correlation_id) VALUES ('b119b119-b119-4119-8119-b119b119b119','a119a119-a119-4119-8119-a119a119a119','P119B','draft',1,'1.0.0','corr-119b');
INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_by,correlation_id) VALUES
('c119c119-c119-4119-8119-c119c119c119','a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','video_project_brief',1,'1.0.0','{}','tester','corr-119b'),
('d119d119-d119-4119-8119-d119d119d119','a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','marketing_plan',1,'1.0.0','{}','tester','corr-119b'),
('e119e119-e119-4119-8119-e119e119e119','a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','creative_concept',1,'1.0.0','{}','tester','corr-119b');
INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_by) VALUES
('a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','video_project_brief','c119c119-c119-4119-8119-c119c119c119',1,'tester'),
('a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','marketing_plan','d119d119-d119-4119-8119-d119d119d119',1,'tester'),
('a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','creative_concept','e119e119-e119-4119-8119-e119e119e119',1,'tester');
SELECT is((SELECT public.begin_or_get_script_director_run('f119f119-f119-4119-8119-f119f119f119','a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','e119e119-e119-4119-8119-e119e119e119',1,'d119d119-d119-4119-8119-d119d119d119',1,'c119c119-c119-4119-8119-c119c119c119',1,'gpt-5.6-terra','script-v1','1.0.0','scr-key-119b-001','fingerprint119b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-119b',100,'USD')->>'status'),'created','begin script created');
SELECT lives_ok($$SELECT public.reserve_director_budget('11191119-1119-4119-8119-111911191119','a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','f119f119-f119-4119-8119-f119f119f119','script-1',100,'USD','corr-119b','ledger-119b')$$,'reserve script budget');
SELECT is((SELECT public.persist_video_script('a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','f119f119-f119-4119-8119-f119f119f119','21192119-2119-4119-8119-211921192119','e119e119-e119-4119-8119-e119e119e119',1,'d119d119-d119-4119-8119-d119d119d119',1,'c119c119-c119-4119-8119-c119c119c119',1,'{"title":"Script"}','1.0.0','corr-119b','shared_password','tester','tester','11191119-1119-4119-8119-111911191119',100,'committed',NULL,2,'dir-commit-119b')->>'status'),'created','persist script created');
SELECT is((SELECT revision FROM public.active_artifact_revisions WHERE project_id='b119b119-b119-4119-8119-b119b119b119' AND artifact_type='video_script'),1,'video script active revision');
SELECT is((SELECT public.begin_or_get_script_director_run('31193119-3119-4119-8119-311931193119','a119a119-a119-4119-8119-a119a119a119','b119b119-b119-4119-8119-b119b119b119','e119e119-e119-4119-8119-e119e119e119',1,'d119d119-d119-4119-8119-d119d119d119',1,'c119c119-c119-4119-8119-c119c119c119',1,'gpt-5.6-terra','script-v1','1.0.0','scr-key-119b-001','fingerprint119b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-119b',100,'USD')->>'status'),'existing','idempotent begin existing');
SELECT is((SELECT count(*)::int FROM public.audit_log WHERE project_id='b119b119-b119-4119-8119-b119b119b119' AND action='director.script.completed'),1,'audit script completed');
SELECT * FROM finish();
ROLLBACK;
