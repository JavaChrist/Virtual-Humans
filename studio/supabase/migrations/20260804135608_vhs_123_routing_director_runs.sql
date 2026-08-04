-- VHS-123 — persisted Model Router (GenerationPlan) + artifact approvals. Local additive only.
-- No budget reservation, no provider calls, no vh_spend writes.
BEGIN;

ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_type_check
  CHECK (director_type IN ('marketing', 'creative', 'script', 'art', 'storyboard', 'prompt', 'routing'));

ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_input_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_input_type_check
  CHECK (input_artifact_type IN (
    'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
    'visual_direction', 'storyboard_project', 'scene_package_set'
  ));

CREATE OR REPLACE FUNCTION public.begin_or_get_routing_director_run(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_scene_package_set_artifact_id uuid,
  p_scene_package_set_revision integer,
  p_storyboard_artifact_id uuid,
  p_storyboard_revision integer,
  p_brief_artifact_id uuid,
  p_brief_revision integer,
  p_registry_version text,
  p_policy_version text,
  p_schema_version text,
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
  IF p_registry_version IS NULL OR char_length(p_registry_version) < 1 THEN
    RAISE EXCEPTION 'invalid_registry_version';
  END IF;
  IF p_policy_version IS NULL OR char_length(p_policy_version) < 1 THEN
    RAISE EXCEPTION 'invalid_policy_version';
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
        'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'director_run_id', v_existing.id,
        'revision', v_existing.revision,
        'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    RAISE EXCEPTION 'director_run_terminal_reuse';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'scene_package_set';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_scene_package_set_artifact_id
     OR v_active.revision IS DISTINCT FROM p_scene_package_set_revision THEN
    RAISE EXCEPTION 'scene_package_set_revision_mismatch';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'storyboard_project';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_storyboard_artifact_id
     OR v_active.revision IS DISTINCT FROM p_storyboard_revision THEN
    RAISE EXCEPTION 'storyboard_revision_mismatch';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'video_project_brief';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id
     OR v_active.revision IS DISTINCT FROM p_brief_revision THEN
    RAISE EXCEPTION 'brief_revision_mismatch';
  END IF;

  INSERT INTO public.director_runs (
    id, workspace_id, project_id, director_type, input_artifact_type, input_artifact_id, input_revision,
    status, provider_id, model_id, prompt_version, schema_version,
    idempotency_key, command_fingerprint, estimated_cost_minor, cost_status, currency, correlation_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, 'routing', 'scene_package_set',
    p_scene_package_set_artifact_id, p_scene_package_set_revision,
    'pending', 'deterministic', p_registry_version, p_policy_version, p_schema_version,
    p_idempotency_key, p_command_fingerprint, NULL, 'none', NULL, p_correlation_id
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'director_run_id', p_id,
    'revision', 1,
    'output_artifact_id', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.persist_generation_plan(
  p_workspace_id uuid,
  p_project_id uuid,
  p_director_run_id uuid,
  p_artifact_id uuid,
  p_scene_package_set_artifact_id uuid,
  p_scene_package_set_revision integer,
  p_storyboard_artifact_id uuid,
  p_storyboard_revision integer,
  p_brief_artifact_id uuid,
  p_brief_revision integer,
  p_plan jsonb,
  p_schema_version text,
  p_registry_version text,
  p_policy_version text,
  p_estimated_cost_minor bigint,
  p_maximum_exposure_minor bigint,
  p_currency text,
  p_correlation_id text,
  p_actor_type text,
  p_actor_id text,
  p_created_by text,
  p_expected_run_revision integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_next_rev integer;
  v_now timestamptz := timezone('utc', now());
  v_scenes jsonb;
  v_scene_count integer;
BEGIN
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'invalid_generation_plan';
  END IF;
  v_scenes := p_plan->'scenePlans';
  IF v_scenes IS NULL OR jsonb_typeof(v_scenes) <> 'array' THEN
    RAISE EXCEPTION 'incomplete_generation_plan';
  END IF;
  v_scene_count := jsonb_array_length(v_scenes);
  IF v_scene_count IS NULL OR v_scene_count < 1 THEN
    RAISE EXCEPTION 'incomplete_generation_plan';
  END IF;
  IF p_estimated_cost_minor IS NULL OR p_estimated_cost_minor < 0 THEN
    RAISE EXCEPTION 'invalid_estimated_cost';
  END IF;
  IF p_maximum_exposure_minor IS NULL OR p_maximum_exposure_minor < 0 THEN
    RAISE EXCEPTION 'invalid_maximum_exposure';
  END IF;
  IF p_currency IS NULL OR char_length(p_currency) <> 3 THEN
    RAISE EXCEPTION 'invalid_currency';
  END IF;

  SELECT * INTO v_run FROM public.director_runs WHERE id = p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;
  IF v_run.director_type IS DISTINCT FROM 'routing' THEN
    RAISE EXCEPTION 'invalid_director_type';
  END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_run_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;
  IF v_run.status = 'completed' AND v_run.output_artifact_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'existing',
      'artifact_id', v_run.output_artifact_id,
      'director_run_id', v_run.id,
      'revision', (SELECT revision FROM public.project_artifacts WHERE id = v_run.output_artifact_id)
    );
  END IF;
  IF v_run.status NOT IN ('pending', 'reserved', 'running') THEN
    RAISE EXCEPTION 'invalid_run_status';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'scene_package_set';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_scene_package_set_artifact_id
     OR v_active.revision IS DISTINCT FROM p_scene_package_set_revision THEN
    RAISE EXCEPTION 'scene_package_set_revision_mismatch';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'storyboard_project';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_storyboard_artifact_id
     OR v_active.revision IS DISTINCT FROM p_storyboard_revision THEN
    RAISE EXCEPTION 'storyboard_revision_mismatch';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'video_project_brief';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id
     OR v_active.revision IS DISTINCT FROM p_brief_revision THEN
    RAISE EXCEPTION 'brief_revision_mismatch';
  END IF;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_next_rev
  FROM public.project_artifacts
  WHERE project_id = p_project_id AND artifact_type = 'generation_plan';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_at, created_by, correlation_id
  ) VALUES (
    p_artifact_id, p_workspace_id, p_project_id, 'generation_plan', v_next_rev, p_schema_version,
    p_plan, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'generation_plan', p_artifact_id, v_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id,
    revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

  INSERT INTO public.generation_plans (
    id, workspace_id, project_id, artifact_id, revision,
    registry_version, policy_version, status,
    estimated_cost_minor, maximum_exposure_minor, currency, approved_at, created_at
  ) VALUES (
    gen_random_uuid(), p_workspace_id, p_project_id, p_artifact_id, v_next_rev,
    p_registry_version, p_policy_version, 'ready',
    p_estimated_cost_minor, p_maximum_exposure_minor, p_currency, NULL, v_now
  );

  UPDATE public.director_runs SET
    status = 'completed',
    output_artifact_id = p_artifact_id,
    cost_status = 'none',
    completed_at = v_now,
    revision = revision + 1
  WHERE id = p_director_run_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id,
    actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.routing.completed', 'generation_plan', p_artifact_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'directorRunId', p_director_run_id,
      'revision', v_next_rev,
      'scenePackageSetRevision', p_scene_package_set_revision,
      'registryVersion', p_registry_version,
      'policyVersion', p_policy_version,
      'sceneCount', v_scene_count,
      'estimatedCostMinor', p_estimated_cost_minor
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.routing.completed', 'generation_plan',
    p_artifact_id::text, v_next_rev,
    jsonb_build_object(
      'projectId', p_project_id,
      'directorRunId', p_director_run_id,
      'artifactId', p_artifact_id,
      'revision', v_next_rev,
      'sceneCount', v_scene_count
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'artifact_id', p_artifact_id,
    'director_run_id', p_director_run_id,
    'revision', v_next_rev
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.persist_artifact_approval(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_type text,
  p_artifact_id uuid,
  p_revision integer,
  p_status text,
  p_decided_by text,
  p_comment text,
  p_expected_project_revision integer,
  p_confirmation boolean,
  p_correlation_id text,
  p_actor_type text,
  p_actor_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.video_projects%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_plan public.generation_plans%ROWTYPE;
  v_existing public.artifact_approvals%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_allowed boolean;
BEGIN
  IF p_confirmation IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'confirmation_required';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_approval_status';
  END IF;
  IF p_artifact_type IS NULL OR p_artifact_type NOT IN (
    'video_project_brief', 'storyboard_project', 'generation_plan'
  ) THEN
    RAISE EXCEPTION 'invalid_approval_artifact_type';
  END IF;
  IF p_decided_by IS NULL OR char_length(p_decided_by) < 1 THEN
    RAISE EXCEPTION 'invalid_decided_by';
  END IF;
  IF p_comment IS NOT NULL AND char_length(p_comment) > 2000 THEN
    RAISE EXCEPTION 'invalid_comment';
  END IF;

  SELECT * INTO v_project
  FROM public.video_projects
  WHERE id = p_project_id AND workspace_id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
  IF v_project.active_revision IS DISTINCT FROM p_expected_project_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = p_artifact_type;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'artifact_not_active';
  END IF;
  IF v_active.artifact_id IS DISTINCT FROM p_artifact_id OR v_active.revision IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'approval_revision_not_active';
  END IF;

  IF p_artifact_type = 'generation_plan' THEN
    SELECT * INTO v_plan
    FROM public.generation_plans
    WHERE artifact_id = p_artifact_id AND project_id = p_project_id
    ORDER BY created_at DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'generation_plan_projection_missing';
    END IF;
    IF v_plan.status IS DISTINCT FROM 'ready' AND v_plan.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'generation_plan_not_ready';
    END IF;
    SELECT COALESCE((value->'budgetDecision'->>'allowed')::boolean, false) INTO v_allowed
    FROM public.project_artifacts
    WHERE id = p_artifact_id;
    IF v_allowed IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'generation_plan_not_ready';
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM public.artifact_approvals
  WHERE project_id = p_project_id
    AND artifact_type = p_artifact_type
    AND artifact_id = p_artifact_id
    AND revision = p_revision
    AND status = p_status
    AND decided_by = p_decided_by
  ORDER BY decided_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'existing',
      'approval_id', v_existing.id,
      'project_revision', v_project.active_revision,
      'artifact_revision', p_revision
    );
  END IF;

  INSERT INTO public.artifact_approvals (
    id, workspace_id, project_id, artifact_type, artifact_id, revision,
    status, decided_at, decided_by, comment
  ) VALUES (
    p_id, p_workspace_id, p_project_id, p_artifact_type, p_artifact_id, p_revision,
    p_status, v_now, p_decided_by, p_comment
  );

  IF p_artifact_type = 'generation_plan' AND p_status = 'approved' THEN
    UPDATE public.generation_plans
    SET status = 'approved', approved_at = v_now
    WHERE artifact_id = p_artifact_id AND project_id = p_project_id;
  END IF;

  UPDATE public.video_projects
  SET active_revision = active_revision + 1, updated_at = v_now
  WHERE id = p_project_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id,
    actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'artifact.approval.recorded', p_artifact_type, p_artifact_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'approvalId', p_id,
      'revision', p_revision,
      'decision', p_status,
      'previousProjectRevision', p_expected_project_revision
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'artifact.approval.recorded', p_artifact_type,
    p_artifact_id::text, p_revision,
    jsonb_build_object(
      'projectId', p_project_id,
      'approvalId', p_id,
      'artifactId', p_artifact_id,
      'revision', p_revision,
      'decision', p_status
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'approval_id', p_id,
    'project_revision', p_expected_project_revision + 1,
    'artifact_revision', p_revision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_or_get_routing_director_run(
  uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_generation_plan(
  uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, bigint, bigint, text, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_artifact_approval(
  uuid, uuid, uuid, text, uuid, integer, text, text, text, integer, boolean, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_or_get_routing_director_run(
  uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, text, text, text, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_generation_plan(
  uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, bigint, bigint, text, text, text, text, text, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_artifact_approval(
  uuid, uuid, uuid, text, uuid, integer, text, text, text, integer, boolean, text, text, text
) TO service_role;

COMMIT;
