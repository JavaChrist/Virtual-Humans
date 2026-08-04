-- VHS-122 — persisted deterministic Prompt Director (atomic scene_package_set). Local additive only.
BEGIN;

-- Atomic lot type (never activate individual scene_package as active pointer)
ALTER TABLE public.project_artifacts DROP CONSTRAINT project_artifacts_type_check;
ALTER TABLE public.project_artifacts ADD CONSTRAINT project_artifacts_type_check
  CHECK (artifact_type IN (
    'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
    'visual_direction', 'storyboard_project', 'scene_package', 'scene_package_set',
    'generation_plan', 'production_result'
  ));

ALTER TABLE public.active_artifact_revisions DROP CONSTRAINT active_artifact_revisions_type_check;
ALTER TABLE public.active_artifact_revisions ADD CONSTRAINT active_artifact_revisions_type_check
  CHECK (artifact_type IN (
    'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
    'visual_direction', 'storyboard_project', 'scene_package', 'scene_package_set',
    'generation_plan', 'production_result'
  ));

ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_type_check
  CHECK (director_type IN ('marketing', 'creative', 'script', 'art', 'storyboard', 'prompt'));
ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_input_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_input_type_check
  CHECK (input_artifact_type IN (
    'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
    'visual_direction', 'storyboard_project'
  ));

CREATE OR REPLACE FUNCTION public.begin_or_get_prompt_director_run(
  p_id uuid, p_workspace_id uuid, p_project_id uuid,
  p_storyboard_artifact_id uuid, p_storyboard_revision integer,
  p_visual_direction_artifact_id uuid, p_visual_direction_revision integer,
  p_video_script_artifact_id uuid, p_video_script_revision integer,
  p_creative_concept_artifact_id uuid, p_creative_concept_revision integer,
  p_marketing_plan_artifact_id uuid, p_marketing_plan_revision integer,
  p_brief_artifact_id uuid, p_brief_revision integer,
  p_model_id text, p_prompt_version text, p_schema_version text,
  p_idempotency_key text, p_command_fingerprint text, p_correlation_id text
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
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='storyboard_project';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_storyboard_artifact_id OR v_active.revision IS DISTINCT FROM p_storyboard_revision THEN RAISE EXCEPTION 'storyboard_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='visual_direction';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_visual_direction_artifact_id OR v_active.revision IS DISTINCT FROM p_visual_direction_revision THEN RAISE EXCEPTION 'visual_direction_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_script';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_video_script_artifact_id OR v_active.revision IS DISTINCT FROM p_video_script_revision THEN RAISE EXCEPTION 'video_script_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='creative_concept';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_creative_concept_artifact_id OR v_active.revision IS DISTINCT FROM p_creative_concept_revision THEN RAISE EXCEPTION 'creative_concept_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='marketing_plan';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_marketing_plan_artifact_id OR v_active.revision IS DISTINCT FROM p_marketing_plan_revision THEN RAISE EXCEPTION 'marketing_plan_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_project_brief';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id OR v_active.revision IS DISTINCT FROM p_brief_revision THEN RAISE EXCEPTION 'brief_revision_mismatch'; END IF;
  INSERT INTO public.director_runs (
    id,workspace_id,project_id,director_type,input_artifact_type,input_artifact_id,input_revision,status,
    provider_id,model_id,prompt_version,schema_version,idempotency_key,command_fingerprint,
    estimated_cost_minor,cost_status,currency,correlation_id
  ) VALUES (
    p_id,p_workspace_id,p_project_id,'prompt','storyboard_project',p_storyboard_artifact_id,p_storyboard_revision,'pending',
    'deterministic',p_model_id,p_prompt_version,p_schema_version,p_idempotency_key,p_command_fingerprint,
    NULL,'none',NULL,p_correlation_id
  );
  RETURN jsonb_build_object('status','created','director_run_id',p_id,'revision',1,'output_artifact_id',NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.persist_scene_package_set(
  p_workspace_id uuid, p_project_id uuid, p_director_run_id uuid, p_artifact_id uuid,
  p_storyboard_artifact_id uuid, p_storyboard_revision integer,
  p_visual_direction_artifact_id uuid, p_visual_direction_revision integer,
  p_video_script_artifact_id uuid, p_video_script_revision integer,
  p_creative_concept_artifact_id uuid, p_creative_concept_revision integer,
  p_marketing_plan_artifact_id uuid, p_marketing_plan_revision integer,
  p_brief_artifact_id uuid, p_brief_revision integer,
  p_package_set jsonb, p_schema_version text, p_correlation_id text,
  p_actor_type text, p_actor_id text, p_created_by text,
  p_expected_run_revision integer DEFAULT 1
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_next_rev integer;
  v_now timestamptz:=timezone('utc',now());
  v_packages jsonb;
  v_pkg_count integer;
BEGIN
  IF p_package_set IS NULL OR jsonb_typeof(p_package_set)<>'object' THEN RAISE EXCEPTION 'invalid_package_set'; END IF;
  v_packages := p_package_set->'packages';
  IF v_packages IS NULL OR jsonb_typeof(v_packages)<>'array' THEN RAISE EXCEPTION 'incomplete_package_set'; END IF;
  v_pkg_count := jsonb_array_length(v_packages);
  IF v_pkg_count IS NULL OR v_pkg_count < 1 THEN RAISE EXCEPTION 'incomplete_package_set'; END IF;

  SELECT * INTO v_run FROM public.director_runs WHERE id=p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN RAISE EXCEPTION 'workspace_mismatch'; END IF;
  IF v_run.director_type IS DISTINCT FROM 'prompt' THEN RAISE EXCEPTION 'invalid_director_type'; END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_run_revision THEN RAISE EXCEPTION 'optimistic_conflict'; END IF;
  IF v_run.status='completed' AND v_run.output_artifact_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','existing',
      'artifact_id',v_run.output_artifact_id,
      'director_run_id',v_run.id,
      'revision',(SELECT revision FROM public.project_artifacts WHERE id=v_run.output_artifact_id)
    );
  END IF;
  IF v_run.status NOT IN ('pending','reserved','running') THEN RAISE EXCEPTION 'invalid_run_status'; END IF;

  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='storyboard_project';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_storyboard_artifact_id OR v_active.revision IS DISTINCT FROM p_storyboard_revision THEN RAISE EXCEPTION 'storyboard_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='visual_direction';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_visual_direction_artifact_id OR v_active.revision IS DISTINCT FROM p_visual_direction_revision THEN RAISE EXCEPTION 'visual_direction_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_script';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_video_script_artifact_id OR v_active.revision IS DISTINCT FROM p_video_script_revision THEN RAISE EXCEPTION 'video_script_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='creative_concept';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_creative_concept_artifact_id OR v_active.revision IS DISTINCT FROM p_creative_concept_revision THEN RAISE EXCEPTION 'creative_concept_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='marketing_plan';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_marketing_plan_artifact_id OR v_active.revision IS DISTINCT FROM p_marketing_plan_revision THEN RAISE EXCEPTION 'marketing_plan_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_project_brief';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id OR v_active.revision IS DISTINCT FROM p_brief_revision THEN RAISE EXCEPTION 'brief_revision_mismatch'; END IF;

  SELECT COALESCE(MAX(revision),0)+1 INTO v_next_rev FROM public.project_artifacts WHERE project_id=p_project_id AND artifact_type='scene_package_set';
  INSERT INTO public.project_artifacts (
    id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_at,created_by,correlation_id
  ) VALUES (
    p_artifact_id,p_workspace_id,p_project_id,'scene_package_set',v_next_rev,p_schema_version,p_package_set,v_now,p_created_by,p_correlation_id
  );
  INSERT INTO public.active_artifact_revisions (
    workspace_id,project_id,artifact_type,artifact_id,revision,updated_at,updated_by
  ) VALUES (
    p_workspace_id,p_project_id,'scene_package_set',p_artifact_id,v_next_rev,v_now,p_created_by
  ) ON CONFLICT (project_id,artifact_type) DO UPDATE SET
    artifact_id=EXCLUDED.artifact_id,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by;

  UPDATE public.director_runs SET
    status='completed',output_artifact_id=p_artifact_id,cost_status='none',completed_at=v_now,revision=revision+1
  WHERE id=p_director_run_id;

  INSERT INTO public.audit_log (
    workspace_id,project_id,action,resource_type,resource_id,actor_type,actor_id,correlation_id,metadata,created_at
  ) VALUES (
    p_workspace_id,p_project_id,'director.prompt.completed','scene_package_set',p_artifact_id::text,
    p_actor_type,p_actor_id,p_correlation_id,
    jsonb_build_object(
      'directorRunId',p_director_run_id,'revision',v_next_rev,
      'storyboardRevision',p_storyboard_revision,'packageCount',v_pkg_count
    ),
    v_now
  );
  INSERT INTO public.domain_events (
    workspace_id,project_id,run_id,event_type,aggregate_type,aggregate_id,aggregate_revision,payload,correlation_id,created_at
  ) VALUES (
    p_workspace_id,p_project_id,NULL,'director.prompt.completed','scene_package_set',p_artifact_id::text,v_next_rev,
    jsonb_build_object('projectId',p_project_id,'directorRunId',p_director_run_id,'artifactId',p_artifact_id,'revision',v_next_rev,'packageCount',v_pkg_count),
    p_correlation_id,v_now
  );
  RETURN jsonb_build_object('status','created','artifact_id',p_artifact_id,'director_run_id',p_director_run_id,'revision',v_next_rev);
END; $$;

REVOKE ALL ON FUNCTION public.begin_or_get_prompt_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_scene_package_set(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_or_get_prompt_director_run(uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_scene_package_set(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,uuid,integer,jsonb,text,text,text,text,text,integer) TO service_role;
COMMIT;
