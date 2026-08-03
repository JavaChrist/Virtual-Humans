-- VHS-120B — art director persistence (pgTAP).
BEGIN;
SELECT plan(11);
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_type_check' AND pg_get_constraintdef(oid) LIKE '%art%'), 'director_runs permits art');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_input_type_check' AND pg_get_constraintdef(oid) LIKE '%video_script%'), 'director_runs permits video_script input');
SELECT ok(has_function_privilege('service_role','public.begin_or_get_art_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)','EXECUTE'), 'service role can begin art');
SELECT ok(NOT has_function_privilege('anon','public.begin_or_get_art_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text)','EXECUTE'), 'anon cannot begin art');
SELECT ok(NOT has_function_privilege('authenticated','public.persist_visual_direction(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,uuid,bigint,text,jsonb,integer,text)','EXECUTE'), 'authenticated cannot persist art');
INSERT INTO public.workspaces (id,slug,name) VALUES ('a120a120-a120-4120-8120-a120a120a120','sql-120b','SQL 120B');
INSERT INTO public.workspace_budget_policies (workspace_id,hard_limit_minor,currency) VALUES ('a120a120-a120-4120-8120-a120a120a120',100000,'USD');
INSERT INTO public.video_projects (id,workspace_id,name,status,active_revision,schema_version,correlation_id) VALUES ('b120b120-b120-4120-8120-b120b120b120','a120a120-a120-4120-8120-a120a120a120','P120B','draft',1,'1.0.0','corr-120b');
INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_by,correlation_id) VALUES
('c120c120-c120-4120-8120-c120c120c120','a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','video_project_brief',1,'1.0.0','{}','tester','corr-120b'),
('d120d120-d120-4120-8120-d120d120d120','a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','marketing_plan',1,'1.0.0','{}','tester','corr-120b'),
('e120e120-e120-4120-8120-e120e120e120','a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','creative_concept',1,'1.0.0','{}','tester','corr-120b'),
('f120f120-f120-4120-8120-f120f120f120','a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','video_script',1,'1.0.0','{}','tester','corr-120b');
INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_by) VALUES
('a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','video_project_brief','c120c120-c120-4120-8120-c120c120c120',1,'tester'),
('a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','marketing_plan','d120d120-d120-4120-8120-d120d120d120',1,'tester'),
('a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','creative_concept','e120e120-e120-4120-8120-e120e120e120',1,'tester'),
('a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','video_script','f120f120-f120-4120-8120-f120f120f120',1,'tester');
SELECT is((SELECT public.begin_or_get_art_director_run('11101110-1110-4110-8110-111011101110','a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','f120f120-f120-4120-8120-f120f120f120',1,'e120e120-e120-4120-8120-e120e120e120',1,'d120d120-d120-4120-8120-d120d120d120',1,'c120c120-c120-4120-8120-c120c120c120',1,'gpt-5.6-terra','art-v1','1.0.0','art-key-120b-001','fingerprint120b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-120b',100,'USD')->>'status'),'created','begin art created');
SELECT lives_ok($$SELECT public.reserve_director_budget('21102110-2110-4110-8110-211021102110','a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','11101110-1110-4110-8110-111011101110','art-1',100,'USD','corr-120b','ledger-120b')$$,'reserve art budget');
SELECT is((SELECT public.persist_visual_direction('a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','11101110-1110-4110-8110-111011101110','31103110-3110-4110-8110-311031103110','f120f120-f120-4120-8120-f120f120f120',1,'e120e120-e120-4120-8120-e120e120e120',1,'d120d120-d120-4120-8120-d120d120d120',1,'c120c120-c120-4120-8120-c120c120c120',1,'{"globalStyle":{"style":"commercial"}}','1.0.0','corr-120b','shared_password','tester','tester','21102110-2110-4110-8110-211021102110',100,'committed',NULL,2,'dir-commit-120b')->>'status'),'created','persist art created');
SELECT is((SELECT revision FROM public.active_artifact_revisions WHERE project_id='b120b120-b120-4120-8120-b120b120b120' AND artifact_type='visual_direction'),1,'visual direction active revision');
SELECT is((SELECT public.begin_or_get_art_director_run('41104110-4110-4110-8110-411041104110','a120a120-a120-4120-8120-a120a120a120','b120b120-b120-4120-8120-b120b120b120','f120f120-f120-4120-8120-f120f120f120',1,'e120e120-e120-4120-8120-e120e120e120',1,'d120d120-d120-4120-8120-d120d120d120',1,'c120c120-c120-4120-8120-c120c120c120',1,'gpt-5.6-terra','art-v1','1.0.0','art-key-120b-001','fingerprint120b001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-120b',100,'USD')->>'status'),'existing','idempotent begin existing');
SELECT is((SELECT count(*)::int FROM public.audit_log WHERE project_id='b120b120-b120-4120-8120-b120b120b120' AND action='director.art.completed'),1,'audit art completed');
SELECT * FROM finish();
ROLLBACK;
