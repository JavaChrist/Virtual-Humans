-- VHS-124 — Production Director run lifecycle (local additive only).
-- No budget reservation on begin/complete; fake providers only in app layer.
BEGIN;

ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_type_check
  CHECK (director_type IN (
    'marketing', 'creative', 'script', 'art', 'storyboard', 'prompt', 'routing', 'production'
  ));

ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_input_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_input_type_check
  CHECK (input_artifact_type IN (
    'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
    'visual_direction', 'storyboard_project', 'scene_package_set', 'generation_plan'
  ));

CREATE OR REPLACE FUNCTION public.begin_or_get_production_director_run(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_generation_plan_artifact_id uuid,
  p_generation_plan_revision integer,
  p_idempotency_key text,
  p_command_fingerprint text,
  p_correlation_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.director_runs%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;
  IF p_command_fingerprint IS NULL OR char_length(p_command_fingerprint) < 8 THEN
    RAISE EXCEPTION 'invalid_fingerprint';
  END IF;

  SELECT * INTO v_existing
  FROM public.director_runs
  WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.command_fingerprint IS DISTINCT FROM p_command_fingerprint THEN
      RAISE EXCEPTION 'idempotency_fingerprint_mismatch';
    END IF;
    IF v_existing.status IN ('pending', 'reserved', 'running') THEN
      RETURN jsonb_build_object(
        'status', 'already_running',
        'director_run_id', v_existing.id,
        'revision', v_existing.revision,
        'production_run_id', v_existing.usage->>'productionRunId'
      );
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'director_run_id', v_existing.id,
        'revision', v_existing.revision,
        'production_run_id', v_existing.usage->>'productionRunId'
      );
    END IF;
    RAISE EXCEPTION 'director_run_terminal_reuse';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id
    AND project_id = p_project_id
    AND artifact_type = 'generation_plan';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_generation_plan_artifact_id
     OR v_active.revision IS DISTINCT FROM p_generation_plan_revision THEN
    RAISE EXCEPTION 'generation_plan_revision_mismatch';
  END IF;

  INSERT INTO public.director_runs (
    id, workspace_id, project_id, director_type, input_artifact_type, input_artifact_id, input_revision,
    status, provider_id, model_id, prompt_version, schema_version,
    idempotency_key, command_fingerprint, estimated_cost_minor, cost_status, currency, correlation_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, 'production', 'generation_plan',
    p_generation_plan_artifact_id, p_generation_plan_revision,
    'pending', 'deterministic', 'production-director-v1', 'vhs-124', '1.0.0',
    p_idempotency_key, p_command_fingerprint, NULL, 'none', NULL, p_correlation_id
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'director_run_id', p_id,
    'revision', 1,
    'production_run_id', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_production_director_run(
  p_director_run_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_production_run_id uuid,
  p_expected_run_revision integer,
  p_correlation_id text,
  p_actor_type text DEFAULT 'shared_password',
  p_actor_id text DEFAULT 'shared-password-user'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_existing_run_id text;
BEGIN
  IF p_production_run_id IS NULL THEN
    RAISE EXCEPTION 'invalid_production_run_id';
  END IF;

  SELECT * INTO v_run FROM public.director_runs WHERE id = p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;
  IF v_run.director_type IS DISTINCT FROM 'production' THEN
    RAISE EXCEPTION 'invalid_director_type';
  END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_run_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;

  IF v_run.status = 'completed' THEN
    v_existing_run_id := v_run.usage->>'productionRunId';
    IF v_existing_run_id IS NOT NULL AND v_existing_run_id = p_production_run_id::text THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'director_run_id', v_run.id,
        'revision', v_run.revision,
        'production_run_id', p_production_run_id
      );
    END IF;
    RAISE EXCEPTION 'director_run_terminal_reuse';
  END IF;

  IF v_run.status NOT IN ('pending', 'reserved', 'running') THEN
    RAISE EXCEPTION 'invalid_run_status';
  END IF;

  -- output_artifact_id stays NULL (FK to project_artifacts; production_run is not an artifact).
  UPDATE public.director_runs
  SET
    status = 'completed',
    output_artifact_id = NULL,
    cost_status = 'none',
    usage = jsonb_build_object('productionRunId', p_production_run_id::text),
    completed_at = v_now,
    revision = revision + 1
  WHERE id = p_director_run_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id,
    actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.production.completed', 'production_run', p_production_run_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'directorRunId', p_director_run_id,
      'productionRunId', p_production_run_id,
      'generationPlanArtifactId', v_run.input_artifact_id,
      'generationPlanRevision', v_run.input_revision
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, p_production_run_id, 'director.production.completed', 'production_run',
    p_production_run_id::text, 1,
    jsonb_build_object(
      'projectId', p_project_id,
      'directorRunId', p_director_run_id,
      'productionRunId', p_production_run_id
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'director_run_id', p_director_run_id,
    'revision', p_expected_run_revision + 1,
    'production_run_id', p_production_run_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_or_get_production_director_run(
  uuid, uuid, uuid, uuid, integer, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_production_director_run(
  uuid, uuid, uuid, uuid, integer, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_or_get_production_director_run(
  uuid, uuid, uuid, uuid, integer, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_production_director_run(
  uuid, uuid, uuid, uuid, integer, text, text, text
) TO service_role;

COMMIT;
