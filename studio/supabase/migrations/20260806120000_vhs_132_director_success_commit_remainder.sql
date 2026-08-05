-- VHS-132 — Director success commit + release remainder (align VHS-113).
-- Additive only: does not rewrite prior migration files.
BEGIN;

CREATE OR REPLACE FUNCTION public.director_budget_commit_reservation(
  p_workspace_id uuid,
  p_project_id uuid,
  p_reservation_id uuid,
  p_director_run_id uuid,
  p_actual_cost_minor bigint,
  p_cost_status text,
  p_ledger_idempotency_key text,
  p_correlation_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.budget_reservations%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_commit bigint;
  v_remainder bigint;
BEGIN
  SELECT * INTO v_res FROM public.budget_reservations
  WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found';
  END IF;
  IF v_res.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'reservation_not_active';
  END IF;
  IF v_res.workspace_id IS DISTINCT FROM p_workspace_id
     OR v_res.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;

  v_commit := COALESCE(p_actual_cost_minor, v_res.amount_minor);
  IF v_commit < 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  -- Fail-closed: never silently commit more than reserved.
  IF v_commit > v_res.amount_minor THEN
    RAISE EXCEPTION 'actual_cost_exceeds_reservation';
  END IF;
  v_remainder := v_res.amount_minor - v_commit;

  UPDATE public.budget_reservations
  SET status = 'committed',
      committed_at = v_now,
      revision = revision + 1
  WHERE id = p_reservation_id;

  INSERT INTO public.cost_ledger (
    workspace_id, project_id, run_id, attempt_id, entry_type,
    amount_minor, currency, reservation_id, cost_status,
    description_code, idempotency_key, correlation_id
  ) VALUES (
    p_workspace_id, p_project_id, NULL, v_res.attempt_id, 'commit',
    v_commit, v_res.currency, p_reservation_id,
    COALESCE(NULLIF(p_cost_status, 'none'), 'committed'),
    'director_budget_commit',
    COALESCE(p_ledger_idempotency_key, 'dir-commit-' || p_director_run_id::text),
    p_correlation_id
  );

  IF v_remainder > 0 THEN
    INSERT INTO public.cost_ledger (
      workspace_id, project_id, run_id, attempt_id, entry_type,
      amount_minor, currency, reservation_id, cost_status,
      description_code, idempotency_key, correlation_id
    ) VALUES (
      p_workspace_id, p_project_id, NULL, v_res.attempt_id, 'release',
      v_remainder, v_res.currency, p_reservation_id, 'released',
      'director_budget_commit_release_remainder',
      COALESCE(p_ledger_idempotency_key, 'dir-commit-' || p_director_run_id::text) || ':release',
      p_correlation_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.director_budget_commit_reservation(uuid, uuid, uuid, uuid, bigint, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.director_budget_commit_reservation(uuid, uuid, uuid, uuid, bigint, text, text, text)
  TO service_role;



-- persist_marketing_plan: commit + release remainder via helper
CREATE OR REPLACE FUNCTION public.persist_marketing_plan(
  p_workspace_id uuid,
  p_project_id uuid,
  p_director_run_id uuid,
  p_artifact_id uuid,
  p_brief_artifact_id uuid,
  p_brief_revision integer,
  p_plan jsonb,
  p_schema_version text,
  p_correlation_id text,
  p_actor_type text,
  p_actor_id text,
  p_created_by text,
  p_reservation_id uuid DEFAULT NULL,
  p_actual_cost_minor bigint DEFAULT NULL,
  p_cost_status text DEFAULT 'unknown',
  p_usage jsonb DEFAULT NULL,
  p_expected_run_revision integer DEFAULT 1,
  p_ledger_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_next_rev integer;
  v_now timestamptz := timezone('utc', now());
  v_res public.budget_reservations%ROWTYPE;
BEGIN
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;
  IF p_actor_type IS DISTINCT FROM 'shared_password' AND p_actor_type IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'invalid_actor_type';
  END IF;

  SELECT * INTO v_run FROM public.director_runs
  WHERE id = p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'director_run_not_found';
  END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id
     OR v_run.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;
  IF v_run.director_type IS DISTINCT FROM 'marketing' THEN
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
      'revision', (
        SELECT revision FROM public.project_artifacts WHERE id = v_run.output_artifact_id
      )
    );
  END IF;
  IF v_run.status NOT IN ('pending', 'reserved', 'running') THEN
    RAISE EXCEPTION 'invalid_run_status';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE project_id = p_project_id AND artifact_type = 'video_project_brief';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id
     OR v_active.revision IS DISTINCT FROM p_brief_revision THEN
    RAISE EXCEPTION 'brief_revision_mismatch';
  END IF;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_next_rev
  FROM public.project_artifacts
  WHERE project_id = p_project_id AND artifact_type = 'marketing_plan';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version,
    parent_revision_id, value, created_at, created_by, correlation_id
  ) VALUES (
    p_artifact_id, p_workspace_id, p_project_id, 'marketing_plan', v_next_rev, p_schema_version,
    NULL, p_plan, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'marketing_plan', p_artifact_id, v_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE
  SET artifact_id = EXCLUDED.artifact_id,
      revision = EXCLUDED.revision,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

  IF p_reservation_id IS NOT NULL THEN
    PERFORM public.director_budget_commit_reservation(
      p_workspace_id,
      p_project_id,
      p_reservation_id,
      p_director_run_id,
      p_actual_cost_minor,
      p_cost_status,
      p_ledger_idempotency_key,
      p_correlation_id
    );
  END IF;

  UPDATE public.director_runs
  SET status = 'completed',
      output_artifact_id = p_artifact_id,
      actual_cost_minor = p_actual_cost_minor,
      cost_status = COALESCE(NULLIF(p_cost_status, 'none'), cost_status),
      usage = p_usage,
      completed_at = v_now,
      revision = revision + 1
  WHERE id = p_director_run_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id,
    actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.marketing.completed', 'marketing_plan', p_artifact_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'directorRunId', p_director_run_id,
      'revision', v_next_rev,
      'briefRevision', p_brief_revision
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id,
    aggregate_revision, payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.marketing.completed', 'marketing_plan', p_artifact_id::text,
    v_next_rev,
    jsonb_build_object(
      'projectId', p_project_id,
      'directorRunId', p_director_run_id,
      'artifactId', p_artifact_id,
      'revision', v_next_rev
    ),
    p_correlation_id,
    v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'artifact_id', p_artifact_id,
    'director_run_id', p_director_run_id,
    'revision', v_next_rev
  );
END;
$$;

-- persist_creative_concept: commit + release remainder via helper
CREATE OR REPLACE FUNCTION public.persist_creative_concept(
  p_workspace_id uuid, p_project_id uuid, p_director_run_id uuid, p_artifact_id uuid,
  p_marketing_plan_artifact_id uuid, p_marketing_plan_revision integer, p_brief_artifact_id uuid, p_brief_revision integer,
  p_concept jsonb, p_schema_version text, p_correlation_id text, p_actor_type text, p_actor_id text, p_created_by text,
  p_reservation_id uuid DEFAULT NULL, p_actual_cost_minor bigint DEFAULT NULL, p_cost_status text DEFAULT 'unknown',
  p_usage jsonb DEFAULT NULL, p_expected_run_revision integer DEFAULT 1, p_ledger_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.director_runs%ROWTYPE; v_active public.active_artifact_revisions%ROWTYPE; v_next_rev integer; v_now timestamptz:=timezone('utc',now()); v_res public.budget_reservations%ROWTYPE;
BEGIN
  IF p_concept IS NULL OR jsonb_typeof(p_concept)<>'object' THEN RAISE EXCEPTION 'invalid_concept'; END IF;
  SELECT * INTO v_run FROM public.director_runs WHERE id=p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN RAISE EXCEPTION 'workspace_mismatch'; END IF;
  IF v_run.director_type IS DISTINCT FROM 'creative' THEN RAISE EXCEPTION 'invalid_director_type'; END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_run_revision THEN RAISE EXCEPTION 'optimistic_conflict'; END IF;
  IF v_run.status='completed' AND v_run.output_artifact_id IS NOT NULL THEN RETURN jsonb_build_object('status','existing','artifact_id',v_run.output_artifact_id,'director_run_id',v_run.id,'revision',(SELECT revision FROM public.project_artifacts WHERE id=v_run.output_artifact_id)); END IF;
  IF v_run.status NOT IN ('pending','reserved','running') THEN RAISE EXCEPTION 'invalid_run_status'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='marketing_plan';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_marketing_plan_artifact_id OR v_active.revision IS DISTINCT FROM p_marketing_plan_revision THEN RAISE EXCEPTION 'marketing_plan_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_project_brief';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id OR v_active.revision IS DISTINCT FROM p_brief_revision THEN RAISE EXCEPTION 'brief_revision_mismatch'; END IF;
  SELECT COALESCE(MAX(revision),0)+1 INTO v_next_rev FROM public.project_artifacts WHERE project_id=p_project_id AND artifact_type='creative_concept';
  INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_at,created_by,correlation_id) VALUES (p_artifact_id,p_workspace_id,p_project_id,'creative_concept',v_next_rev,p_schema_version,p_concept,v_now,p_created_by,p_correlation_id);
  INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_at,updated_by) VALUES (p_workspace_id,p_project_id,'creative_concept',p_artifact_id,v_next_rev,v_now,p_created_by) ON CONFLICT (project_id,artifact_type) DO UPDATE SET artifact_id=EXCLUDED.artifact_id,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by;
  IF p_reservation_id IS NOT NULL THEN
    PERFORM public.director_budget_commit_reservation(
      p_workspace_id,
      p_project_id,
      p_reservation_id,
      p_director_run_id,
      p_actual_cost_minor,
      p_cost_status,
      p_ledger_idempotency_key,
      p_correlation_id
    );
  END IF;
  UPDATE public.director_runs SET status='completed',output_artifact_id=p_artifact_id,actual_cost_minor=p_actual_cost_minor,cost_status=COALESCE(NULLIF(p_cost_status,'none'),cost_status),usage=p_usage,completed_at=v_now,revision=revision+1 WHERE id=p_director_run_id;
  INSERT INTO public.audit_log (workspace_id,project_id,action,resource_type,resource_id,actor_type,actor_id,correlation_id,metadata,created_at) VALUES (p_workspace_id,p_project_id,'director.creative.completed','creative_concept',p_artifact_id::text,p_actor_type,p_actor_id,p_correlation_id,jsonb_build_object('directorRunId',p_director_run_id,'revision',v_next_rev,'briefRevision',p_brief_revision,'marketingPlanRevision',p_marketing_plan_revision),v_now);
  INSERT INTO public.domain_events (workspace_id,project_id,run_id,event_type,aggregate_type,aggregate_id,aggregate_revision,payload,correlation_id,created_at) VALUES (p_workspace_id,p_project_id,NULL,'director.creative.completed','creative_concept',p_artifact_id::text,v_next_rev,jsonb_build_object('projectId',p_project_id,'directorRunId',p_director_run_id,'artifactId',p_artifact_id,'revision',v_next_rev),p_correlation_id,v_now);
  RETURN jsonb_build_object('status','created','artifact_id',p_artifact_id,'director_run_id',p_director_run_id,'revision',v_next_rev);
END; $$;

-- persist_video_script: commit + release remainder via helper
CREATE OR REPLACE FUNCTION public.persist_video_script(
  p_workspace_id uuid, p_project_id uuid, p_director_run_id uuid, p_artifact_id uuid,
  p_creative_concept_artifact_id uuid, p_creative_concept_revision integer,
  p_marketing_plan_artifact_id uuid, p_marketing_plan_revision integer, p_brief_artifact_id uuid, p_brief_revision integer,
  p_script jsonb, p_schema_version text, p_correlation_id text, p_actor_type text, p_actor_id text, p_created_by text,
  p_reservation_id uuid DEFAULT NULL, p_actual_cost_minor bigint DEFAULT NULL, p_cost_status text DEFAULT 'unknown',
  p_usage jsonb DEFAULT NULL, p_expected_run_revision integer DEFAULT 1, p_ledger_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.director_runs%ROWTYPE; v_active public.active_artifact_revisions%ROWTYPE; v_next_rev integer; v_now timestamptz:=timezone('utc',now()); v_res public.budget_reservations%ROWTYPE;
BEGIN
  IF p_script IS NULL OR jsonb_typeof(p_script)<>'object' THEN RAISE EXCEPTION 'invalid_script'; END IF;
  SELECT * INTO v_run FROM public.director_runs WHERE id=p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN RAISE EXCEPTION 'workspace_mismatch'; END IF;
  IF v_run.director_type IS DISTINCT FROM 'script' THEN RAISE EXCEPTION 'invalid_director_type'; END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_run_revision THEN RAISE EXCEPTION 'optimistic_conflict'; END IF;
  IF v_run.status='completed' AND v_run.output_artifact_id IS NOT NULL THEN RETURN jsonb_build_object('status','existing','artifact_id',v_run.output_artifact_id,'director_run_id',v_run.id,'revision',(SELECT revision FROM public.project_artifacts WHERE id=v_run.output_artifact_id)); END IF;
  IF v_run.status NOT IN ('pending','reserved','running') THEN RAISE EXCEPTION 'invalid_run_status'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='creative_concept';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_creative_concept_artifact_id OR v_active.revision IS DISTINCT FROM p_creative_concept_revision THEN RAISE EXCEPTION 'creative_concept_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='marketing_plan';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_marketing_plan_artifact_id OR v_active.revision IS DISTINCT FROM p_marketing_plan_revision THEN RAISE EXCEPTION 'marketing_plan_revision_mismatch'; END IF;
  SELECT * INTO v_active FROM public.active_artifact_revisions WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND artifact_type='video_project_brief';
  IF NOT FOUND OR v_active.artifact_id IS DISTINCT FROM p_brief_artifact_id OR v_active.revision IS DISTINCT FROM p_brief_revision THEN RAISE EXCEPTION 'brief_revision_mismatch'; END IF;
  SELECT COALESCE(MAX(revision),0)+1 INTO v_next_rev FROM public.project_artifacts WHERE project_id=p_project_id AND artifact_type='video_script';
  INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_at,created_by,correlation_id) VALUES (p_artifact_id,p_workspace_id,p_project_id,'video_script',v_next_rev,p_schema_version,p_script,v_now,p_created_by,p_correlation_id);
  INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_at,updated_by) VALUES (p_workspace_id,p_project_id,'video_script',p_artifact_id,v_next_rev,v_now,p_created_by) ON CONFLICT (project_id,artifact_type) DO UPDATE SET artifact_id=EXCLUDED.artifact_id,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by;
  IF p_reservation_id IS NOT NULL THEN
    PERFORM public.director_budget_commit_reservation(
      p_workspace_id,
      p_project_id,
      p_reservation_id,
      p_director_run_id,
      p_actual_cost_minor,
      p_cost_status,
      p_ledger_idempotency_key,
      p_correlation_id
    );
  END IF;
  UPDATE public.director_runs SET status='completed',output_artifact_id=p_artifact_id,actual_cost_minor=p_actual_cost_minor,cost_status=COALESCE(NULLIF(p_cost_status,'none'),cost_status),usage=p_usage,completed_at=v_now,revision=revision+1 WHERE id=p_director_run_id;
  INSERT INTO public.audit_log (workspace_id,project_id,action,resource_type,resource_id,actor_type,actor_id,correlation_id,metadata,created_at) VALUES (p_workspace_id,p_project_id,'director.script.completed','video_script',p_artifact_id::text,p_actor_type,p_actor_id,p_correlation_id,jsonb_build_object('directorRunId',p_director_run_id,'revision',v_next_rev,'briefRevision',p_brief_revision,'marketingPlanRevision',p_marketing_plan_revision,'creativeConceptRevision',p_creative_concept_revision),v_now);
  INSERT INTO public.domain_events (workspace_id,project_id,run_id,event_type,aggregate_type,aggregate_id,aggregate_revision,payload,correlation_id,created_at) VALUES (p_workspace_id,p_project_id,NULL,'director.script.completed','video_script',p_artifact_id::text,v_next_rev,jsonb_build_object('projectId',p_project_id,'directorRunId',p_director_run_id,'artifactId',p_artifact_id,'revision',v_next_rev),p_correlation_id,v_now);
  RETURN jsonb_build_object('status','created','artifact_id',p_artifact_id,'director_run_id',p_director_run_id,'revision',v_next_rev);
END; $$;

-- persist_visual_direction: commit + release remainder via helper
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
    PERFORM public.director_budget_commit_reservation(
      p_workspace_id,
      p_project_id,
      p_reservation_id,
      p_director_run_id,
      p_actual_cost_minor,
      p_cost_status,
      p_ledger_idempotency_key,
      p_correlation_id
    );
  END IF;
  UPDATE public.director_runs SET status='completed',output_artifact_id=p_artifact_id,actual_cost_minor=p_actual_cost_minor,cost_status=COALESCE(NULLIF(p_cost_status,'none'),cost_status),usage=p_usage,completed_at=v_now,revision=revision+1 WHERE id=p_director_run_id;
  INSERT INTO public.audit_log (workspace_id,project_id,action,resource_type,resource_id,actor_type,actor_id,correlation_id,metadata,created_at) VALUES (p_workspace_id,p_project_id,'director.art.completed','visual_direction',p_artifact_id::text,p_actor_type,p_actor_id,p_correlation_id,jsonb_build_object('directorRunId',p_director_run_id,'revision',v_next_rev,'briefRevision',p_brief_revision,'marketingPlanRevision',p_marketing_plan_revision,'creativeConceptRevision',p_creative_concept_revision,'videoScriptRevision',p_video_script_revision),v_now);
  INSERT INTO public.domain_events (workspace_id,project_id,run_id,event_type,aggregate_type,aggregate_id,aggregate_revision,payload,correlation_id,created_at) VALUES (p_workspace_id,p_project_id,NULL,'director.art.completed','visual_direction',p_artifact_id::text,v_next_rev,jsonb_build_object('projectId',p_project_id,'directorRunId',p_director_run_id,'artifactId',p_artifact_id,'revision',v_next_rev),p_correlation_id,v_now);
  RETURN jsonb_build_object('status','created','artifact_id',p_artifact_id,'director_run_id',p_director_run_id,'revision',v_next_rev);
END; $$;

-- persist_storyboard_project: commit + release remainder via helper
CREATE OR REPLACE FUNCTION public.persist_storyboard_project(
  p_workspace_id uuid, p_project_id uuid, p_director_run_id uuid, p_artifact_id uuid,
  p_visual_direction_artifact_id uuid, p_visual_direction_revision integer,
  p_video_script_artifact_id uuid, p_video_script_revision integer,
  p_creative_concept_artifact_id uuid, p_creative_concept_revision integer,
  p_marketing_plan_artifact_id uuid, p_marketing_plan_revision integer, p_brief_artifact_id uuid, p_brief_revision integer,
  p_storyboard jsonb, p_schema_version text, p_correlation_id text, p_actor_type text, p_actor_id text, p_created_by text,
  p_reservation_id uuid DEFAULT NULL, p_actual_cost_minor bigint DEFAULT NULL, p_cost_status text DEFAULT 'unknown',
  p_usage jsonb DEFAULT NULL, p_expected_run_revision integer DEFAULT 1, p_ledger_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_run public.director_runs%ROWTYPE; v_active public.active_artifact_revisions%ROWTYPE; v_next_rev integer; v_now timestamptz:=timezone('utc',now()); v_res public.budget_reservations%ROWTYPE; v_scene jsonb;
BEGIN
  IF p_storyboard IS NULL OR jsonb_typeof(p_storyboard)<>'object' THEN RAISE EXCEPTION 'invalid_storyboard'; END IF;
  SELECT * INTO v_run FROM public.director_runs WHERE id=p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN RAISE EXCEPTION 'workspace_mismatch'; END IF;
  IF v_run.director_type IS DISTINCT FROM 'storyboard' THEN RAISE EXCEPTION 'invalid_director_type'; END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_run_revision THEN RAISE EXCEPTION 'optimistic_conflict'; END IF;
  IF v_run.status='completed' AND v_run.output_artifact_id IS NOT NULL THEN RETURN jsonb_build_object('status','existing','artifact_id',v_run.output_artifact_id,'director_run_id',v_run.id,'revision',(SELECT revision FROM public.project_artifacts WHERE id=v_run.output_artifact_id)); END IF;
  IF v_run.status NOT IN ('pending','reserved','running') THEN RAISE EXCEPTION 'invalid_run_status'; END IF;
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
  SELECT COALESCE(MAX(revision),0)+1 INTO v_next_rev FROM public.project_artifacts WHERE project_id=p_project_id AND artifact_type='storyboard_project';
  INSERT INTO public.project_artifacts (id,workspace_id,project_id,artifact_type,revision,schema_version,value,created_at,created_by,correlation_id) VALUES (p_artifact_id,p_workspace_id,p_project_id,'storyboard_project',v_next_rev,p_schema_version,p_storyboard,v_now,p_created_by,p_correlation_id);
  INSERT INTO public.active_artifact_revisions (workspace_id,project_id,artifact_type,artifact_id,revision,updated_at,updated_by) VALUES (p_workspace_id,p_project_id,'storyboard_project',p_artifact_id,v_next_rev,v_now,p_created_by) ON CONFLICT (project_id,artifact_type) DO UPDATE SET artifact_id=EXCLUDED.artifact_id,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by;
  FOR v_scene IN SELECT * FROM jsonb_array_elements(COALESCE(p_storyboard->'scenes','[]'::jsonb)) LOOP
    INSERT INTO public.storyboard_scenes (workspace_id,project_id,storyboard_artifact_id,storyboard_revision,scene_id,scene_order,purpose,duration_seconds,status,projection_version,updated_at)
    VALUES (p_workspace_id,p_project_id,p_artifact_id,v_next_rev,v_scene->>'id',(v_scene->>'order')::integer,v_scene->>'purpose',(v_scene->>'durationSeconds')::numeric,'pending','1.0.0',v_now);
  END LOOP;
  IF p_reservation_id IS NOT NULL THEN
    PERFORM public.director_budget_commit_reservation(
      p_workspace_id,
      p_project_id,
      p_reservation_id,
      p_director_run_id,
      p_actual_cost_minor,
      p_cost_status,
      p_ledger_idempotency_key,
      p_correlation_id
    );
  END IF;
  UPDATE public.director_runs SET status='completed',output_artifact_id=p_artifact_id,actual_cost_minor=p_actual_cost_minor,cost_status=COALESCE(NULLIF(p_cost_status,'none'),cost_status),usage=p_usage,completed_at=v_now,revision=revision+1 WHERE id=p_director_run_id;
  INSERT INTO public.audit_log (workspace_id,project_id,action,resource_type,resource_id,actor_type,actor_id,correlation_id,metadata,created_at) VALUES (p_workspace_id,p_project_id,'director.storyboard.completed','storyboard_project',p_artifact_id::text,p_actor_type,p_actor_id,p_correlation_id,jsonb_build_object('directorRunId',p_director_run_id,'revision',v_next_rev,'visualDirectionRevision',p_visual_direction_revision),v_now);
  INSERT INTO public.domain_events (workspace_id,project_id,run_id,event_type,aggregate_type,aggregate_id,aggregate_revision,payload,correlation_id,created_at) VALUES (p_workspace_id,p_project_id,NULL,'director.storyboard.completed','storyboard_project',p_artifact_id::text,v_next_rev,jsonb_build_object('projectId',p_project_id,'directorRunId',p_director_run_id,'artifactId',p_artifact_id,'revision',v_next_rev),p_correlation_id,v_now);
  RETURN jsonb_build_object('status','created','artifact_id',p_artifact_id,'director_run_id',p_director_run_id,'revision',v_next_rev);
END; $$;

REVOKE ALL ON FUNCTION public.persist_marketing_plan(uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_creative_concept(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_video_script(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_visual_direction(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_storyboard_project(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.persist_marketing_plan(uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_creative_concept(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_video_script(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_visual_direction(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_storyboard_project(uuid, uuid, uuid, uuid, uuid, integer, uuid, integer, uuid, integer, uuid, integer, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) TO service_role;

COMMIT;
