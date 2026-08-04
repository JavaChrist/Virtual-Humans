-- VHS-120B — persisted Art Director runs. Local additive migration only.
BEGIN;

ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_type_check
  CHECK (director_type IN ('marketing', 'creative', 'script', 'art'));
ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_input_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_input_type_check
  CHECK (input_artifact_type IN ('video_project_brief', 'marketing_plan', 'creative_concept', 'video_script'));

CREATE OR REPLACE FUNCTION public.begin_or_get_art_director_run(
  p_id uuid, p_workspace_id uuid, p_project_id uuid,
  p_video_script_artifact_id uuid, p_video_script_revision integer,
  p_creative_concept_artifact_id uuid, p_creative_concept_revision integer,
  p_marketing_plan_artifact_id uuid, p_marketing_plan_revision integer,
  p_brief_artifact_id uuid, p_brief_revision integer,
  p_model_id text, p_prompt_version text, p_schema_version text,
  p_idempotency_key text, p_command_fingerprint text, p_correlation_id text,
  p_estimated_cost_minor bigint DEFAULT NULL, p_currency text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing public.director_runs%ROWTYPE; v_active public.active_artifact_revisions%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 8 THEN RAISE EXCEPTION 'invalid_idempotency_key'; END IF;
  IF p_command_fingerprint IS NULL OR char_length(p_command_fingerprint) < 8 THEN RAISE EXCEPTION 'invalid_fingerprint'; END IF;
  SELECT * INTO v_existing FROM public.director_runs WHERE workspace_id=p_workspace_id AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.command_fingerprint IS DISTINCT FROM p_command_fingerprint THEN RAISE EXCEPTION 'idempotency_fingerprint_mismatch'; END IF;
    IF v_existing.status IN ('pending','reserved','running') THEN RETURN jsonb_build_object('status','already_running','director_run_id',v_existing.id,'revision',v_existing.revision,'output_artifact_id',v_existing.output_artifact_id); END IF;
    IF v_existing.status='completed' THEN RETURN jsonb_build_object('status','existing','director_run_id',v_existing.id,'revision',v_existing.revision,'output_artifact_id',v_existing.output_artifact_id); END IF;
    RAISE EXCEPTION 'director_run_terminal_reuse';
  END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_script';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_video_script_artifact_id OR v_active.revision IS DISTINCT FROM p_video_script_revision THEN RAISE EXCEPTION 'video_script_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='creative_concept';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_creative_concept_artifact_id OR v_active.revision IS DISTINCT FROM p_creative_concept_revision THEN RAISE EXCEPTION 'creative_concept_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='marketing_plan';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_marketing_plan_artifact_id OR v_active.revision IS DISTINCT FROM p_marketing_plan_revision THEN RAISE EXCEPTION 'marketing_plan_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_project_brief';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id OR v_active.revision IS DISTINCT FROM p_brief_revision THEN RAISE EXCEPTION 'brief_revision_mismatch'; END IF;
  INSERT INTO public.director_runs (id,workspace_id,project_id,director_type,input_artifact_type,input_artifact_id,input_revision,status,provider_id,model_id,prompt_version,schema_version,idempotency_key,command_fingerprint,estimated_cost_minor,cost_status,currency,correlation_id)
  VALUES (p_id,p_workspace_id,p_project_id,'art','video_script',p_video_script_artifact_id,p_video_script_revision,'pending','openai',p_model_id,p_prompt_version,p_schema_version,p_idempotency_key,p_command_fingerprint,p_estimated_cost_minor,CASE WHEN p_estimated_cost_minor IS NULL THEN 'none' ELSE 'estimated' END,p_currency,p_correlation_id);
  RETURN jsonb_build_object('status','created','director_run_id',p_id,'revision',1,'output_artifact_id',NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.persist_visual_direction(
  p_workspace_id uuid, p_project_id uuid, p_director_run_id uuid, p_artifact_id uuid,
  p_video_script_artifact_id uuid, p_video_script_revision integer,
  p_creative_concept_artifact_id uuid, p_creative_concept_revision integer,
  p_marketing_plan_artifact_id uuid, p_marketing_plan_revision integer, p_brief_artifact_id uuid, p_brief_revision integer,
  p_visual_direction jsonb, p_schema_version text, p_correlation_id text, p_actor_type text, p_actor_id text, p_created_by text,
  p_reservation_id uuid DEFAULT NULL, p_actual_cost_minor bigint DEFAULT NULL, p_cost_status text DEFAULT 'unknown',
  p_usage jsonb DEFAULT NULL, p_expected_run_revision integer DEFAULT 1, p_ledger_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.director_runs%ROWTYPE; v_active public.active_artifact_revisions%ROWTYPE; v_next_rev integer; v_now timestamptz:=timezone('utc',now()); v_res public.budget_reservations%ROWTYPE;
BEGIN
  IF p_visual_direction IS NULL OR jsonb_typeof(p_visual_direction)<>'object' THEN RAISE EXCEPTION 'invalid_visual_direction'; END IF;
  SELECT * INTO v_run FROM public.director_runs WHERE id=p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN RAISE EXCEPTION 'workspace_mismatch'; END IF;
  IF v_run.director_type IS DISTINCT FROM 'art' THEN RAISE EXCEPTION 'invalid_director_type'; END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_run_revision THEN RAISE EXCEPTION 'optimistic_conflict'; END IF;
  IF v_run.status='completed' AND v_run.output_artifact_id IS NOT NULL THEN RETURN jsonb_build_object('status','existing','artifact_id',v_run.output_artifact_id,'director_run_id',v_run.id,'revision',(SELECT revision FROM public.project_artifacts WHERE id=v_run.output_artifact_id)); END IF;
  IF v_run.status NOT IN ('pending','reserved','running') THEN RAISE EXCEPTION 'invalid_run_status'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_script';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_video_script_artifact_id OR v_active.revision IS DISTINCT FROM p_video_script_revision THEN RAISE EXCEPTION 'video_script_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='creative_concept';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_creative_concept_artifact_id OR v_active.revision IS DISTINCT FROM p_creative_concept_revision THEN RAISE EXCEPTION 'creative_concept_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='marketing_plan';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_marketing_plan_artifact_id OR v_active.revision IS DISTINCT FROM p_marketing_plan_revision THEN RAISE EXCEPTION 'marketing_plan_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_project_brief';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id OR v_active.revision IS DISTINCT FROM p_brief_revision THEN RAISE EXCEPTION 'brief_revision_mismatch'; END IF;
  SELECT COALESCE(MAX(revision),0)+1 INTO v_next_rev FROM public.project_artifacts WHERE project_id=p_project_id AND artifact_type='visual_direction';
  INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_at,created_by,correlation_id) VALUES (p_artifact_id,p_workspace_id,p_project_id,'visual_direction',v_next_rev,p_schema_version,p_visual_direction,v_now,p_created_by,p_correlation_id);
  INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_at,updated_by) VALUES (p_workspace_id,p_project_id,'visual_direction',p_artifact_id,v_next_rev,v_now,p_created_by) ON CONFLICT (project_id,artifact_type) DO UPDATE SET artifact_id=EXCLUDED.artifact_id,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by;
  IF p_reservation_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.budget_reservations WHERE id=p_reservation_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'reservation_not_found'; END IF;
    IF v_res.status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'reservation_not_active'; END IF;
    UPDATE public.budget_reservations SET status='committed',committed_at=v_now,revision=revision+1 WHERE id=p_reservation_id;
    INSERT INTO public.cost_ledger (workspace_id,project_id,run_id,attempt_id,entry_type,amount_minor,currency,reservation_id,cost_status,description_code,idempotency_key,correlation_id) VALUES (p_workspace_id,p_project_id,NULL,v_res.attempt_id,'commit',COALESCE(p_actual_cost_minor,v_res.amount_minor),v_res.currency,p_reservation_id,COALESCE(NULLIF(p_cost_status,'none'),'committed'),'director_budget_commit',COALESCE(p_ledger_idempotency_key,'dir-commit-'||p_director_run_id::text),p_correlation_id);
  END IF;
  UPDATE public.director_runs SET status='completed',output_artifact_id=p_artifact_id,actual_cost_minor=p_actual_cost_minor,cost_status=COALESCE(NULLIF(p_cost_status,'none'),cost_status),usage=p_usage,completed_at=v_now,revision=revision+1 WHERE id=p_director_run_id;
  INSERT INTO public.audit_log (workspace_id,project_id,action,resource_type,resource_id,actor_type,actor_id,correlation_id,metadata,created_at) VALUES (p_workspace_id,p_project_id,'director.art.completed','visual_direction',p_artifact_id::text,p_actor_type,p_actor_id,p_correlation_id,jsonb_build_object('directorRunId',p_director_run_id,'revision',v_next_rev,'briefRevision',p_brief_revision,'marketingPlanRevision',p_marketing_plan_revision,'creativeConceptRevision',p_creative_concept_revision,'videoScriptRevision',p_video_script_revision),v_now);
  INSERT INTO public.domain_events (workspace_id,project_id,run_id,event_type,aggregate_type,aggregate_id,aggregate_revision,payload,correlation_id,created_at) VALUES (p_workspace_id,p_project_id,NULL,'director.art.completed','visual_direction',p_artifact_id::text,v_next_rev,jsonb_build_object('projectId',p_project_id,'directorRunId',p_director_run_id,'artifactId',p_artifact_id,'revision',v_next_rev),p_correlation_id,v_now);
  RETURN jsonb_build_object('status','created','artifact_id',p_artifact_id,'director_run_id',p_director_run_id,'revision',v_next_rev);
END; $$;

REVOKE ALL ON FUNCTION public.begin_or_get_art_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_visual_direction(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,uuid,bigint,text,jsonb,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_or_get_art_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_visual_direction(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,uuid,bigint,text,jsonb,integer,text) TO service_role;
COMMIT;
