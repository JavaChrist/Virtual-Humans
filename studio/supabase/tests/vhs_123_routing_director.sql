-- VHS-123 — routing director + approvals (pgTAP).
BEGIN;
SELECT plan(23);

SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_type_check' AND pg_get_constraintdef(oid) LIKE '%routing%'), 'director_runs permits routing');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname='director_runs_input_type_check' AND pg_get_constraintdef(oid) LIKE '%scene_package_set%'), 'director_runs permits scene_package_set input');
SELECT ok(has_function_privilege('service_role','public.begin_or_get_routing_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text)','EXECUTE'), 'service role can begin routing');
SELECT ok(NOT has_function_privilege('anon','public.begin_or_get_routing_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text)','EXECUTE'), 'anon cannot begin routing');
SELECT ok(NOT has_function_privilege('authenticated','public.persist_generation_plan(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,bigint,bigint,text,text,text,text,text,integer)','EXECUTE'), 'authenticated cannot persist plan');
SELECT ok(has_function_privilege('service_role','public.persist_artifact_approval(uuid,uuid,uuid,text,uuid,integer,text,text,text,integer,boolean,text,text,text)','EXECUTE'), 'service role can approve');
SELECT ok(NOT has_function_privilege('anon','public.persist_artifact_approval(uuid,uuid,uuid,text,uuid,integer,text,text,text,integer,boolean,text,text,text)','EXECUTE'), 'anon cannot approve');

INSERT INTO public.workspaces (id,slug,name) VALUES ('a123a123-a123-4123-8123-a123a123a123','sql-123','SQL 123');
INSERT INTO public.workspace_budget_policies (workspace_id,hard_limit_minor,currency) VALUES ('a123a123-a123-4123-8123-a123a123a123',100000,'USD');
INSERT INTO public.video_projects (id,workspace_id,name,status,active_revision,schema_version,correlation_id) VALUES ('b123b123-b123-4123-8123-b123b123b123','a123a123-a123-4123-8123-a123a123a123','P123','draft',1,'1.0.0','corr-123');
INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_by,correlation_id) VALUES
('c123c123-c123-4123-8123-c123c123c123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','video_project_brief',1,'1.0.0','{}','tester','corr-123'),
('81238123-8123-4123-8123-812381238123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','storyboard_project',1,'1.0.0','{"scenes":[{"id":"sc-1"}]}','tester','corr-123'),
('91239123-9123-4123-8123-912391239123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','scene_package_set',1,'1.0.0','{"packages":[{"sceneId":"sc-1"}]}','tester','corr-123');
INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_by) VALUES
('a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','video_project_brief','c123c123-c123-4123-8123-c123c123c123',1,'tester'),
('a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','storyboard_project','81238123-8123-4123-8123-812381238123',1,'tester'),
('a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','scene_package_set','91239123-9123-4123-8123-912391239123',1,'tester');

SELECT is((SELECT public.begin_or_get_routing_director_run(
  '11111123-1111-4123-8123-111111231123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123',
  '91239123-9123-4123-8123-912391239123',1,'81238123-8123-4123-8123-812381238123',1,'c123c123-c123-4123-8123-c123c123c123',1,
  'legacy-pricing-usd-v1:abc123','routing-policy-v1','1.0.0','rtg-key-123-001','fingerprint123001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-123'
)->>'status'),'created','begin routing created');

SELECT is((SELECT public.persist_generation_plan(
  'a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','11111123-1111-4123-8123-111111231123','31113123-3111-4123-8123-311131233123',
  '91239123-9123-4123-8123-912391239123',1,'81238123-8123-4123-8123-812381238123',1,'c123c123-c123-4123-8123-c123c123c123',1,
  '{"artifactType":"generation_plan","scenePlans":[{"sceneId":"sc-1","sceneOrder":1}],"budgetDecision":{"allowed":true},"estimatedCost":{"amountMinor":100,"currency":"USD"},"registryVersion":"legacy-pricing-usd-v1:abc123","policyVersion":"routing-policy-v1"}',
  '1.0.0','legacy-pricing-usd-v1:abc123','routing-policy-v1',100,150,'USD','corr-123','shared_password','tester','tester',1
)->>'status'),'created','persist generation plan created');

SELECT is((SELECT revision FROM public.active_artifact_revisions WHERE project_id='b123b123-b123-4123-8123-b123b123b123' AND artifact_type='generation_plan'),1,'generation_plan active revision');
SELECT is((SELECT status FROM public.generation_plans WHERE artifact_id='31113123-3111-4123-8123-311131233123'),'ready','projection ready');
SELECT is((SELECT cost_status FROM public.director_runs WHERE id='11111123-1111-4123-8123-111111231123'),'none','routing run has no budget reservation status');
SELECT is((SELECT count(*)::int FROM public.budget_reservations WHERE project_id='b123b123-b123-4123-8123-b123b123b123'),0,'no budget reservation for routing');
SELECT is((SELECT public.begin_or_get_routing_director_run(
  '41114123-4111-4123-8123-411141234123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123',
  '91239123-9123-4123-8123-912391239123',1,'81238123-8123-4123-8123-812381238123',1,'c123c123-c123-4123-8123-c123c123c123',1,
  'legacy-pricing-usd-v1:abc123','routing-policy-v1','1.0.0','rtg-key-123-001','fingerprint123001aaaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-123'
)->>'status'),'existing','idempotent begin existing');

SELECT is((SELECT public.persist_artifact_approval(
  '51115123-5111-4123-8123-511151235123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123',
  'generation_plan','31113123-3111-4123-8123-311131233123',1,'approved','tester',NULL,1,true,'corr-123','shared_password','tester'
)->>'status'),'created','approval created');
SELECT is((SELECT status FROM public.generation_plans WHERE artifact_id='31113123-3111-4123-8123-311131233123'),'approved','projection approved');
SELECT is((SELECT active_revision FROM public.video_projects WHERE id='b123b123-b123-4123-8123-b123b123b123'),2,'project revision bumped');
SELECT is((SELECT public.persist_artifact_approval(
  '61116123-6111-4123-8123-611161236123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123',
  'generation_plan','31113123-3111-4123-8123-311131233123',1,'approved','tester',NULL,2,true,'corr-123','shared_password','tester'
)->>'status'),'existing','approval double-click idempotent');

SELECT throws_ok(
  $$SELECT public.persist_artifact_approval(
    '71117123-7111-4123-8123-711171237123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123',
    'generation_plan','31113123-3111-4123-8123-311131233123',99,'approved','tester',NULL,2,true,'corr-123','shared_password','tester'
  )$$,
  'approval_revision_not_active',
  'refuse non-active revision approval'
);

SELECT is((SELECT public.begin_or_get_routing_director_run(
  '81118123-8111-4123-8123-811181238123','a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123',
  '91239123-9123-4123-8123-912391239123',1,'81238123-8123-4123-8123-812381238123',1,'c123c123-c123-4123-8123-c123c123c123',1,
  'legacy-pricing-usd-v1:abc123','routing-policy-v1','1.0.0','rtg-key-123-empty','fingerprint123emptyaaaaaaaaaaaaaaaaaaaaaaaaaa','corr-123'
)->>'status'),'created','begin second routing run for empty-plan check');

SELECT throws_ok(
  $$SELECT public.persist_generation_plan(
    'a123a123-a123-4123-8123-a123a123a123','b123b123-b123-4123-8123-b123b123b123','81118123-8111-4123-8123-811181238123','91119123-9111-4123-8123-911191239123',
    '91239123-9123-4123-8123-912391239123',1,'81238123-8123-4123-8123-812381238123',1,'c123c123-c123-4123-8123-c123c123c123',1,
    '{"artifactType":"generation_plan","scenePlans":[]}','1.0.0','legacy-pricing-usd-v1:abc123','routing-policy-v1',0,0,'USD','corr-123','shared_password','tester','tester',1
  )$$,
  'incomplete_generation_plan',
  'refuse empty scenePlans'
);

SELECT is((SELECT count(*)::int FROM public.audit_log WHERE project_id='b123b123-b123-4123-8123-b123b123b123' AND action='director.routing.completed'),1,'audit routing completed');
SELECT is((SELECT count(*)::int FROM public.audit_log WHERE project_id='b123b123-b123-4123-8123-b123b123b123' AND action='artifact.approval.recorded'),1,'audit approval recorded');

SELECT * FROM finish();
ROLLBACK;
