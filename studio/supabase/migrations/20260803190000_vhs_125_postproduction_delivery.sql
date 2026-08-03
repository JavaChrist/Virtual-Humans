-- VHS-125 — Postproduction delivery: quality / human review / merge / export.
-- Additive after VHS-124. Fake merge only in app layer; no real provider/AICCOS calls here.
BEGIN;

-- ---------------------------------------------------------------------------
-- Expand artifact type checks (quality_report, merge_plan, export_package).
-- production_result already allowed since VHS-113.
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_artifacts DROP CONSTRAINT project_artifacts_type_check;
ALTER TABLE public.project_artifacts ADD CONSTRAINT project_artifacts_type_check
  CHECK (
    artifact_type IN (
      'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
      'visual_direction', 'storyboard_project', 'scene_package', 'scene_package_set',
      'generation_plan', 'production_result',
      'quality_report', 'merge_plan', 'export_package'
    )
  );

ALTER TABLE public.active_artifact_revisions DROP CONSTRAINT active_artifact_revisions_type_check;
ALTER TABLE public.active_artifact_revisions ADD CONSTRAINT active_artifact_revisions_type_check
  CHECK (
    artifact_type IN (
      'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
      'visual_direction', 'storyboard_project', 'scene_package', 'scene_package_set',
      'generation_plan', 'production_result',
      'quality_report', 'merge_plan', 'export_package'
    )
  );

-- ---------------------------------------------------------------------------
-- Expand director_runs type checks (quality, merge, export).
-- ---------------------------------------------------------------------------
ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_type_check
  CHECK (
    director_type IN (
      'marketing', 'creative', 'script', 'art', 'storyboard', 'prompt', 'routing', 'production',
      'quality', 'merge', 'export'
    )
  );

ALTER TABLE public.director_runs DROP CONSTRAINT director_runs_input_type_check;
ALTER TABLE public.director_runs ADD CONSTRAINT director_runs_input_type_check
  CHECK (
    input_artifact_type IN (
      'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
      'visual_direction', 'storyboard_project', 'scene_package_set', 'generation_plan',
      'production_result', 'quality_report', 'merge_plan'
    )
  );

-- ---------------------------------------------------------------------------
-- human_review_decisions (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.human_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  quality_report_artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  quality_report_revision integer NOT NULL,
  production_result_artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  production_result_revision integer NOT NULL,
  decision text NOT NULL,
  comment text NULL,
  reviewed_issue_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT human_review_decisions_decision_check CHECK (decision IN ('approved', 'rejected')),
  CONSTRAINT human_review_decisions_comment_len CHECK (comment IS NULL OR char_length(comment) <= 2000),
  CONSTRAINT human_review_decisions_qr_rev_pos CHECK (quality_report_revision >= 1),
  CONSTRAINT human_review_decisions_pr_rev_pos CHECK (production_result_revision >= 1),
  CONSTRAINT human_review_decisions_actor_type_len CHECK (char_length(actor_type) BETWEEN 1 AND 60),
  CONSTRAINT human_review_decisions_actor_id_len CHECK (char_length(actor_id) BETWEEN 1 AND 120),
  CONSTRAINT human_review_decisions_correlation_len CHECK (char_length(correlation_id) BETWEEN 8 AND 128),
  CONSTRAINT human_review_decisions_idem_key_unique UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX human_review_decisions_project_idx
  ON public.human_review_decisions (project_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_human_review_decisions_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'human_review_decisions are append-only';
END;
$$;

CREATE TRIGGER human_review_decisions_append_only
  BEFORE UPDATE OR DELETE ON public.human_review_decisions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_human_review_decisions_mutation();

ALTER TABLE public.human_review_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.human_review_decisions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.human_review_decisions TO service_role;

-- ---------------------------------------------------------------------------
-- 1. persist_production_result — first persistence of a ProductionResult
--    (idempotent on manifest->runId when an active revision already exists).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.persist_production_result(
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_id uuid,
  p_production_run_id uuid,
  p_result jsonb,
  p_schema_version text,
  p_correlation_id text,
  p_created_by text,
  p_actor_type text,
  p_actor_id text,
  p_expected_active_revision integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active public.active_artifact_revisions%ROWTYPE;
  v_existing public.project_artifacts%ROWTYPE;
  v_next_rev integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_result IS NULL OR jsonb_typeof(p_result) <> 'object' THEN
    RAISE EXCEPTION 'invalid_production_result';
  END IF;
  IF p_production_run_id IS NULL THEN
    RAISE EXCEPTION 'invalid_production_run_id';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result'
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_active_revision IS NOT NULL AND v_active.revision IS DISTINCT FROM p_expected_active_revision THEN
      RAISE EXCEPTION 'optimistic_conflict';
    END IF;
    SELECT * INTO v_existing FROM public.project_artifacts WHERE id = v_active.artifact_id;
    IF FOUND AND (v_existing.value #>> '{manifest,runId}') = p_production_run_id::text THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'artifact_id', v_existing.id,
        'revision', v_existing.revision
      );
    END IF;
  ELSE
    IF p_expected_active_revision IS NOT NULL AND p_expected_active_revision <> 0 THEN
      RAISE EXCEPTION 'optimistic_conflict';
    END IF;
  END IF;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_next_rev
  FROM public.project_artifacts
  WHERE project_id = p_project_id AND artifact_type = 'production_result';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_at, created_by, correlation_id
  ) VALUES (
    p_artifact_id, p_workspace_id, p_project_id, 'production_result', v_next_rev, p_schema_version,
    p_result, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'production_result', p_artifact_id, v_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id,
    revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id, actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'production_result.persisted', 'production_result', p_artifact_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object('productionRunId', p_production_run_id, 'revision', v_next_rev),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, p_production_run_id, 'production_result.persisted', 'production_result',
    p_artifact_id::text, v_next_rev,
    jsonb_build_object('projectId', p_project_id, 'artifactId', p_artifact_id, 'revision', v_next_rev),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object('status', 'created', 'artifact_id', p_artifact_id, 'revision', v_next_rev);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. begin_or_get_quality_director_run — input: production_result.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_or_get_quality_director_run(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
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
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'production_result_revision_mismatch';
  END IF;

  INSERT INTO public.director_runs (
    id, workspace_id, project_id, director_type, input_artifact_type, input_artifact_id, input_revision,
    status, provider_id, model_id, prompt_version, schema_version,
    idempotency_key, command_fingerprint, estimated_cost_minor, cost_status, currency, correlation_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, 'quality', 'production_result',
    p_production_result_artifact_id, p_production_result_revision,
    'pending', 'deterministic', 'quality-director-v1', 'vhs-125', '1.0.0',
    p_idempotency_key, p_command_fingerprint, NULL, 'none', NULL, p_correlation_id
  );

  RETURN jsonb_build_object(
    'status', 'created', 'director_run_id', p_id, 'revision', 1, 'output_artifact_id', NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. persist_quality_report — completes quality run, inserts quality_report
--    artifact + a new production_result revision (delivery patched).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.persist_quality_report(
  p_director_run_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_id uuid,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
  p_report jsonb,
  p_schema_version text,
  p_updated_production_result jsonb,
  p_production_result_new_id uuid,
  p_correlation_id text,
  p_created_by text,
  p_actor_type text,
  p_actor_id text,
  p_expected_run_revision integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_qr_next_rev integer;
  v_pr_next_rev integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_report IS NULL OR jsonb_typeof(p_report) <> 'object' THEN
    RAISE EXCEPTION 'invalid_quality_report';
  END IF;
  IF p_updated_production_result IS NULL OR jsonb_typeof(p_updated_production_result) <> 'object' THEN
    RAISE EXCEPTION 'invalid_production_result';
  END IF;

  SELECT * INTO v_run FROM public.director_runs WHERE id = p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;
  IF v_run.director_type IS DISTINCT FROM 'quality' THEN
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
      'revision', (SELECT revision FROM public.project_artifacts WHERE id = v_run.output_artifact_id),
      'production_result_artifact_id', (
        SELECT artifact_id FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND artifact_type = 'production_result'
      ),
      'production_result_revision', (
        SELECT revision FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND artifact_type = 'production_result'
      )
    );
  END IF;
  IF v_run.status NOT IN ('pending', 'reserved', 'running') THEN
    RAISE EXCEPTION 'invalid_run_status';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result'
  FOR UPDATE;
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'production_result_revision_mismatch';
  END IF;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_qr_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'quality_report';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_at, created_by, correlation_id
  ) VALUES (
    p_artifact_id, p_workspace_id, p_project_id, 'quality_report', v_qr_next_rev, p_schema_version,
    p_report, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'quality_report', p_artifact_id, v_qr_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_pr_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'production_result';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value,
    parent_revision_id, created_at, created_by, correlation_id
  ) VALUES (
    p_production_result_new_id, p_workspace_id, p_project_id, 'production_result', v_pr_next_rev, p_schema_version,
    p_updated_production_result, p_production_result_artifact_id, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'production_result', p_production_result_new_id, v_pr_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  UPDATE public.director_runs
  SET status = 'completed', output_artifact_id = p_artifact_id, cost_status = 'none',
      completed_at = v_now, revision = revision + 1
  WHERE id = p_director_run_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id, actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.quality.completed', 'quality_report', p_artifact_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'directorRunId', p_director_run_id,
      'revision', v_qr_next_rev,
      'productionResultRevision', v_pr_next_rev,
      'qualityStatus', p_report->>'status'
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.quality.completed', 'quality_report', p_artifact_id::text, v_qr_next_rev,
    jsonb_build_object(
      'projectId', p_project_id, 'directorRunId', p_director_run_id, 'artifactId', p_artifact_id,
      'revision', v_qr_next_rev, 'productionResultArtifactId', p_production_result_new_id,
      'productionResultRevision', v_pr_next_rev
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'artifact_id', p_artifact_id,
    'director_run_id', p_director_run_id,
    'revision', v_qr_next_rev,
    'production_result_artifact_id', p_production_result_new_id,
    'production_result_revision', v_pr_next_rev
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. persist_human_review_decision — append-only, optimistic on production_result.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.persist_human_review_decision(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_quality_report_artifact_id uuid,
  p_quality_report_revision integer,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
  p_decision text,
  p_comment text,
  p_reviewed_issue_codes jsonb,
  p_idempotency_key text,
  p_correlation_id text,
  p_actor_type text,
  p_actor_id text,
  p_updated_production_result jsonb,
  p_production_result_new_id uuid,
  p_expected_production_result_revision integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.human_review_decisions%ROWTYPE;
  v_active_qr public.active_artifact_revisions%ROWTYPE;
  v_active_pr public.active_artifact_revisions%ROWTYPE;
  v_pr_next_rev integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_review_decision';
  END IF;
  IF p_comment IS NOT NULL AND char_length(p_comment) > 2000 THEN
    RAISE EXCEPTION 'invalid_comment';
  END IF;
  IF p_updated_production_result IS NULL OR jsonb_typeof(p_updated_production_result) <> 'object' THEN
    RAISE EXCEPTION 'invalid_production_result';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.human_review_decisions
    WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'decision_id', v_existing.id,
        'production_result_artifact_id', v_existing.production_result_artifact_id,
        'production_result_revision', v_existing.production_result_revision
      );
    END IF;
  END IF;

  SELECT * INTO v_active_qr
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'quality_report';
  IF NOT FOUND
     OR v_active_qr.artifact_id IS DISTINCT FROM p_quality_report_artifact_id
     OR v_active_qr.revision IS DISTINCT FROM p_quality_report_revision THEN
    RAISE EXCEPTION 'quality_report_not_active';
  END IF;

  SELECT * INTO v_active_pr
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result'
  FOR UPDATE;
  IF NOT FOUND
     OR v_active_pr.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active_pr.revision IS DISTINCT FROM p_expected_production_result_revision
     OR v_active_pr.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;

  INSERT INTO public.human_review_decisions (
    id, workspace_id, project_id, quality_report_artifact_id, quality_report_revision,
    production_result_artifact_id, production_result_revision, decision, comment,
    reviewed_issue_codes, actor_type, actor_id, correlation_id, idempotency_key, created_at
  ) VALUES (
    p_id, p_workspace_id, p_project_id, p_quality_report_artifact_id, p_quality_report_revision,
    p_production_result_artifact_id, p_production_result_revision, p_decision, p_comment,
    COALESCE(p_reviewed_issue_codes, '[]'::jsonb), p_actor_type, p_actor_id, p_correlation_id,
    p_idempotency_key, v_now
  );

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_pr_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'production_result';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value,
    parent_revision_id, created_at, created_by, correlation_id
  ) VALUES (
    p_production_result_new_id, p_workspace_id, p_project_id, 'production_result', v_pr_next_rev,
    COALESCE(p_updated_production_result->>'schemaVersion', '1.1.0'), p_updated_production_result,
    p_production_result_artifact_id, v_now, p_actor_id, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'production_result', p_production_result_new_id, v_pr_next_rev, v_now, p_actor_id
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id, actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.quality.review_recorded', 'human_review_decision', p_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'decisionId', p_id, 'decision', p_decision,
      'qualityReportRevision', p_quality_report_revision, 'productionResultRevision', v_pr_next_rev
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.quality.review_recorded', 'human_review_decision', p_id::text, 1,
    jsonb_build_object(
      'projectId', p_project_id, 'decisionId', p_id, 'decision', p_decision,
      'productionResultArtifactId', p_production_result_new_id, 'productionResultRevision', v_pr_next_rev
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'decision_id', p_id,
    'production_result_artifact_id', p_production_result_new_id,
    'production_result_revision', v_pr_next_rev
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. begin_or_get_merge_director_run — input: quality_report (validated
--    against the currently active production_result too).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_or_get_merge_director_run(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_quality_report_artifact_id uuid,
  p_quality_report_revision integer,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
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
        'status', 'already_running', 'director_run_id', v_existing.id,
        'revision', v_existing.revision, 'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'status', 'existing', 'director_run_id', v_existing.id,
        'revision', v_existing.revision, 'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    RAISE EXCEPTION 'director_run_terminal_reuse';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'quality_report';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_quality_report_artifact_id
     OR v_active.revision IS DISTINCT FROM p_quality_report_revision THEN
    RAISE EXCEPTION 'quality_report_revision_mismatch';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'production_result_revision_mismatch';
  END IF;

  INSERT INTO public.director_runs (
    id, workspace_id, project_id, director_type, input_artifact_type, input_artifact_id, input_revision,
    status, provider_id, model_id, prompt_version, schema_version,
    idempotency_key, command_fingerprint, estimated_cost_minor, cost_status, currency, correlation_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, 'merge', 'quality_report',
    p_quality_report_artifact_id, p_quality_report_revision,
    'pending', 'deterministic', 'fake-merge.v1', 'vhs-125', '1.0.0',
    p_idempotency_key, p_command_fingerprint, NULL, 'none', NULL, p_correlation_id
  );

  RETURN jsonb_build_object('status', 'created', 'director_run_id', p_id, 'revision', 1, 'output_artifact_id', NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. persist_merge_outcome — persists a merge_plan revision (envelope with
--    status + optional final asset) + a new production_result revision.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.persist_merge_outcome(
  p_director_run_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_id uuid,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
  p_merge_outcome jsonb,
  p_schema_version text,
  p_merge_status text,
  p_updated_production_result jsonb,
  p_production_result_new_id uuid,
  p_correlation_id text,
  p_created_by text,
  p_actor_type text,
  p_actor_id text,
  p_expected_run_revision integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_mp_next_rev integer;
  v_pr_next_rev integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_merge_status IS NULL OR p_merge_status NOT IN ('prepared', 'blocked', 'completed', 'failed') THEN
    RAISE EXCEPTION 'invalid_merge_status';
  END IF;
  IF p_merge_outcome IS NULL OR jsonb_typeof(p_merge_outcome) <> 'object' THEN
    RAISE EXCEPTION 'invalid_merge_outcome';
  END IF;
  IF p_updated_production_result IS NULL OR jsonb_typeof(p_updated_production_result) <> 'object' THEN
    RAISE EXCEPTION 'invalid_production_result';
  END IF;

  SELECT * INTO v_run FROM public.director_runs WHERE id = p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;
  IF v_run.director_type IS DISTINCT FROM 'merge' THEN
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
      'revision', (SELECT revision FROM public.project_artifacts WHERE id = v_run.output_artifact_id),
      'merge_status', v_run.usage->>'mergeStatus',
      'production_result_artifact_id', (
        SELECT artifact_id FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND artifact_type = 'production_result'
      ),
      'production_result_revision', (
        SELECT revision FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND artifact_type = 'production_result'
      )
    );
  END IF;
  IF v_run.status NOT IN ('pending', 'reserved', 'running') THEN
    RAISE EXCEPTION 'invalid_run_status';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result'
  FOR UPDATE;
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'production_result_revision_mismatch';
  END IF;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_mp_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'merge_plan';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_at, created_by, correlation_id
  ) VALUES (
    p_artifact_id, p_workspace_id, p_project_id, 'merge_plan', v_mp_next_rev, p_schema_version,
    p_merge_outcome, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'merge_plan', p_artifact_id, v_mp_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_pr_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'production_result';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value,
    parent_revision_id, created_at, created_by, correlation_id
  ) VALUES (
    p_production_result_new_id, p_workspace_id, p_project_id, 'production_result', v_pr_next_rev, p_schema_version,
    p_updated_production_result, p_production_result_artifact_id, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'production_result', p_production_result_new_id, v_pr_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  UPDATE public.director_runs
  SET status = 'completed', output_artifact_id = p_artifact_id, cost_status = 'none',
      usage = jsonb_build_object('mergeStatus', p_merge_status),
      completed_at = v_now, revision = revision + 1
  WHERE id = p_director_run_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id, actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.merge.completed', 'merge_plan', p_artifact_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'directorRunId', p_director_run_id, 'revision', v_mp_next_rev,
      'mergeStatus', p_merge_status, 'productionResultRevision', v_pr_next_rev
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.merge.completed', 'merge_plan', p_artifact_id::text, v_mp_next_rev,
    jsonb_build_object(
      'projectId', p_project_id, 'directorRunId', p_director_run_id, 'artifactId', p_artifact_id,
      'revision', v_mp_next_rev, 'mergeStatus', p_merge_status,
      'productionResultArtifactId', p_production_result_new_id, 'productionResultRevision', v_pr_next_rev
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'artifact_id', p_artifact_id,
    'director_run_id', p_director_run_id,
    'revision', v_mp_next_rev,
    'merge_status', p_merge_status,
    'production_result_artifact_id', p_production_result_new_id,
    'production_result_revision', v_pr_next_rev
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. begin_or_get_export_director_run — input: merge_plan.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_or_get_export_director_run(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_merge_plan_artifact_id uuid,
  p_merge_plan_revision integer,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
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
        'status', 'already_running', 'director_run_id', v_existing.id,
        'revision', v_existing.revision, 'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'status', 'existing', 'director_run_id', v_existing.id,
        'revision', v_existing.revision, 'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    RAISE EXCEPTION 'director_run_terminal_reuse';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'merge_plan';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_merge_plan_artifact_id
     OR v_active.revision IS DISTINCT FROM p_merge_plan_revision THEN
    RAISE EXCEPTION 'merge_plan_revision_mismatch';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result';
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'production_result_revision_mismatch';
  END IF;

  INSERT INTO public.director_runs (
    id, workspace_id, project_id, director_type, input_artifact_type, input_artifact_id, input_revision,
    status, provider_id, model_id, prompt_version, schema_version,
    idempotency_key, command_fingerprint, estimated_cost_minor, cost_status, currency, correlation_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, 'export', 'merge_plan',
    p_merge_plan_artifact_id, p_merge_plan_revision,
    'pending', 'deterministic', 'export-director-v1', 'vhs-125', '1.0.0',
    p_idempotency_key, p_command_fingerprint, NULL, 'none', NULL, p_correlation_id
  );

  RETURN jsonb_build_object('status', 'created', 'director_run_id', p_id, 'revision', 1, 'output_artifact_id', NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. persist_export_package — persists export_package + a new production_result
--    revision (delivery patched to export_ready / delivered).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.persist_export_package(
  p_director_run_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_id uuid,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
  p_export_package jsonb,
  p_schema_version text,
  p_destination_id text,
  p_updated_production_result jsonb,
  p_production_result_new_id uuid,
  p_correlation_id text,
  p_created_by text,
  p_actor_type text,
  p_actor_id text,
  p_expected_run_revision integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_ep_next_rev integer;
  v_pr_next_rev integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_export_package IS NULL OR jsonb_typeof(p_export_package) <> 'object' THEN
    RAISE EXCEPTION 'invalid_export_package';
  END IF;
  IF p_updated_production_result IS NULL OR jsonb_typeof(p_updated_production_result) <> 'object' THEN
    RAISE EXCEPTION 'invalid_production_result';
  END IF;
  IF p_destination_id IS NULL OR p_destination_id NOT IN ('download', 'aiccos') THEN
    RAISE EXCEPTION 'invalid_destination';
  END IF;

  SELECT * INTO v_run FROM public.director_runs WHERE id = p_director_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'director_run_not_found'; END IF;
  IF v_run.workspace_id IS DISTINCT FROM p_workspace_id OR v_run.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;
  IF v_run.director_type IS DISTINCT FROM 'export' THEN
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
      'revision', (SELECT revision FROM public.project_artifacts WHERE id = v_run.output_artifact_id),
      'production_result_artifact_id', (
        SELECT artifact_id FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND artifact_type = 'production_result'
      ),
      'production_result_revision', (
        SELECT revision FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND artifact_type = 'production_result'
      )
    );
  END IF;
  IF v_run.status NOT IN ('pending', 'reserved', 'running') THEN
    RAISE EXCEPTION 'invalid_run_status';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result'
  FOR UPDATE;
  IF NOT FOUND
     OR v_active.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'production_result_revision_mismatch';
  END IF;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_ep_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'export_package';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value, created_at, created_by, correlation_id
  ) VALUES (
    p_artifact_id, p_workspace_id, p_project_id, 'export_package', v_ep_next_rev, p_schema_version,
    p_export_package, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'export_package', p_artifact_id, v_ep_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_pr_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'production_result';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value,
    parent_revision_id, created_at, created_by, correlation_id
  ) VALUES (
    p_production_result_new_id, p_workspace_id, p_project_id, 'production_result', v_pr_next_rev, p_schema_version,
    p_updated_production_result, p_production_result_artifact_id, v_now, p_created_by, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'production_result', p_production_result_new_id, v_pr_next_rev, v_now, p_created_by
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  UPDATE public.director_runs
  SET status = 'completed', output_artifact_id = p_artifact_id, cost_status = 'none',
      usage = jsonb_build_object('destinationId', p_destination_id),
      completed_at = v_now, revision = revision + 1
  WHERE id = p_director_run_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id, actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.export.completed', 'export_package', p_artifact_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'directorRunId', p_director_run_id, 'revision', v_ep_next_rev,
      'destinationId', p_destination_id, 'productionResultRevision', v_pr_next_rev
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.export.completed', 'export_package', p_artifact_id::text, v_ep_next_rev,
    jsonb_build_object(
      'projectId', p_project_id, 'directorRunId', p_director_run_id, 'artifactId', p_artifact_id,
      'revision', v_ep_next_rev, 'destinationId', p_destination_id,
      'productionResultArtifactId', p_production_result_new_id, 'productionResultRevision', v_pr_next_rev
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'artifact_id', p_artifact_id,
    'director_run_id', p_director_run_id,
    'revision', v_ep_next_rev,
    'production_result_artifact_id', p_production_result_new_id,
    'production_result_revision', v_pr_next_rev
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants — SECURITY DEFINER RPCs restricted to service_role only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.persist_production_result(
  uuid, uuid, uuid, uuid, jsonb, text, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_or_get_quality_director_run(
  uuid, uuid, uuid, uuid, integer, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_quality_report(
  uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, jsonb, uuid, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_human_review_decision(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, jsonb, text, text, text, text, jsonb, uuid, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_or_get_merge_director_run(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_merge_outcome(
  uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, jsonb, uuid, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_or_get_export_director_run(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_export_package(
  uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, jsonb, uuid, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.persist_production_result(
  uuid, uuid, uuid, uuid, jsonb, text, text, text, text, text, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_or_get_quality_director_run(
  uuid, uuid, uuid, uuid, integer, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_quality_report(
  uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, jsonb, uuid, text, text, text, text, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_human_review_decision(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, jsonb, text, text, text, text, jsonb, uuid, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_or_get_merge_director_run(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_merge_outcome(
  uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, jsonb, uuid, text, text, text, text, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_or_get_export_director_run(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_export_package(
  uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, jsonb, uuid, text, text, text, text, integer
) TO service_role;

COMMIT;
