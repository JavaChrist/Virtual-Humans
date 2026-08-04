-- VHS-128 — Explicit human retry attempts for director_runs (additive).
-- Attempt 1 keys unchanged. Attempt N>=2 uses <base-key>:attempt:<N>.
-- No destructive cascades. service_role only.

BEGIN;

-- ---------------------------------------------------------------------------
-- Columns (existing rows → attempt_number = 1)
-- ---------------------------------------------------------------------------
ALTER TABLE public.director_runs
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS retry_of_run_id uuid NULL,
  ADD COLUMN IF NOT EXISTS retry_request_id uuid NULL;

ALTER TABLE public.director_runs
  DROP CONSTRAINT IF EXISTS director_runs_attempt_number_check;
ALTER TABLE public.director_runs
  ADD CONSTRAINT director_runs_attempt_number_check
  CHECK (attempt_number >= 1);

ALTER TABLE public.director_runs
  DROP CONSTRAINT IF EXISTS director_runs_retry_of_run_id_fkey;
ALTER TABLE public.director_runs
  ADD CONSTRAINT director_runs_retry_of_run_id_fkey
  FOREIGN KEY (retry_of_run_id)
  REFERENCES public.director_runs (id)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

CREATE UNIQUE INDEX IF NOT EXISTS director_runs_retry_request_id_uidx
  ON public.director_runs (workspace_id, retry_request_id)
  WHERE retry_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS director_runs_retry_of_run_id_idx
  ON public.director_runs (retry_of_run_id)
  WHERE retry_of_run_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Retryable provider / director error codes (human retry only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.director_error_code_is_retryable(p_code text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_code IN ('rate_limited', 'timeout', 'provider_unavailable');
$$;

-- ---------------------------------------------------------------------------
-- Atomic begin-or-retry (reusable by director_type; Marketing wired in app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_or_retry_director_run(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_previous_run_id uuid,
  p_retry_request_id uuid,
  p_director_type text,
  p_input_artifact_id uuid,
  p_input_revision integer,
  p_model_id text,
  p_prompt_version text,
  p_schema_version text,
  p_command_fingerprint text,
  p_correlation_id text,
  p_estimated_cost_minor bigint DEFAULT NULL,
  p_currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev public.director_runs%ROWTYPE;
  v_existing public.director_runs%ROWTYPE;
  v_newer public.director_runs%ROWTYPE;
  v_active_art public.active_artifact_revisions%ROWTYPE;
  v_res public.budget_reservations%ROWTYPE;
  v_base_key text;
  v_new_key text;
  v_next_attempt integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_retry_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid_retry_request_id';
  END IF;
  IF p_command_fingerprint IS NULL OR char_length(p_command_fingerprint) < 8 THEN
    RAISE EXCEPTION 'invalid_fingerprint';
  END IF;
  IF p_director_type IS NULL OR char_length(p_director_type) < 2 THEN
    RAISE EXCEPTION 'invalid_director_type';
  END IF;

  -- Idempotent replay of the same human retry request
  SELECT * INTO v_existing
  FROM public.director_runs
  WHERE workspace_id = p_workspace_id
    AND retry_request_id = p_retry_request_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status IN ('pending', 'reserved', 'running') THEN
      RETURN jsonb_build_object(
        'status', 'already_running',
        'director_run_id', v_existing.id,
        'run_status', v_existing.status,
        'revision', v_existing.revision,
        'attempt_number', v_existing.attempt_number,
        'retry_of_run_id', v_existing.retry_of_run_id,
        'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'director_run_id', v_existing.id,
        'run_status', v_existing.status,
        'revision', v_existing.revision,
        'attempt_number', v_existing.attempt_number,
        'retry_of_run_id', v_existing.retry_of_run_id,
        'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    -- Same request already produced a terminal run — replay that outcome, no new attempt / no provider
    RETURN jsonb_build_object(
      'status', 'terminal_replay',
      'director_run_id', v_existing.id,
      'run_status', v_existing.status,
      'revision', v_existing.revision,
      'attempt_number', v_existing.attempt_number,
      'retry_of_run_id', v_existing.retry_of_run_id,
      'output_artifact_id', v_existing.output_artifact_id,
      'error_code', v_existing.error_code
    );
  END IF;

  SELECT * INTO v_prev
  FROM public.director_runs
  WHERE id = p_previous_run_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'director_run_not_found';
  END IF;
  IF v_prev.workspace_id IS DISTINCT FROM p_workspace_id
     OR v_prev.project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'workspace_mismatch';
  END IF;
  IF v_prev.director_type IS DISTINCT FROM p_director_type THEN
    RAISE EXCEPTION 'invalid_director_type';
  END IF;
  IF v_prev.status IS DISTINCT FROM 'failed' THEN
    RAISE EXCEPTION 'retry_not_allowed';
  END IF;
  IF NOT public.director_error_code_is_retryable(v_prev.error_code) THEN
    RAISE EXCEPTION 'retry_not_allowed';
  END IF;
  IF v_prev.output_artifact_id IS NOT NULL THEN
    RAISE EXCEPTION 'retry_not_allowed';
  END IF;

  -- Previous reservation must be terminal (released / committed / none) — never reactivate
  SELECT * INTO v_res
  FROM public.budget_reservations
  WHERE scope_type = 'director_run'
    AND scope_id = v_prev.id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND AND v_res.status = 'active' THEN
    RAISE EXCEPTION 'retry_reservation_active';
  END IF;

  -- Active brief must match the retry inputs (same brief as execute)
  SELECT * INTO v_active_art
  FROM public.active_artifact_revisions
  WHERE project_id = p_project_id
    AND artifact_type = 'video_project_brief'
    AND workspace_id = p_workspace_id;
  IF NOT FOUND
     OR v_active_art.artifact_id IS DISTINCT FROM p_input_artifact_id
     OR v_active_art.revision IS DISTINCT FROM p_input_revision THEN
    RAISE EXCEPTION 'brief_revision_mismatch';
  END IF;

  -- Config compatibility with previous attempt
  IF v_prev.model_id IS DISTINCT FROM p_model_id
     OR v_prev.prompt_version IS DISTINCT FROM p_prompt_version
     OR v_prev.schema_version IS DISTINCT FROM p_schema_version THEN
    RAISE EXCEPTION 'retry_config_mismatch';
  END IF;
  IF v_prev.input_artifact_id IS DISTINCT FROM p_input_artifact_id
     OR v_prev.input_revision IS DISTINCT FROM p_input_revision THEN
    RAISE EXCEPTION 'brief_revision_mismatch';
  END IF;

  v_base_key := regexp_replace(v_prev.idempotency_key, ':attempt:[0-9]+$', '');
  v_next_attempt := v_prev.attempt_number + 1;
  v_new_key := v_base_key || ':attempt:' || v_next_attempt::text;
  IF char_length(v_new_key) > 200 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  -- Any newer attempt in the same base-key lineage blocks this retry
  SELECT * INTO v_newer
  FROM public.director_runs
  WHERE workspace_id = p_workspace_id
    AND (
      idempotency_key = v_base_key
      OR idempotency_key LIKE v_base_key || ':attempt:%'
    )
    AND attempt_number > v_prev.attempt_number
  ORDER BY attempt_number DESC
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    IF v_newer.status IN ('pending', 'reserved', 'running') THEN
      RETURN jsonb_build_object(
        'status', 'already_running',
        'director_run_id', v_newer.id,
        'run_status', v_newer.status,
        'revision', v_newer.revision,
        'attempt_number', v_newer.attempt_number,
        'retry_of_run_id', v_newer.retry_of_run_id,
        'output_artifact_id', v_newer.output_artifact_id
      );
    END IF;
    RAISE EXCEPTION 'retry_superseded';
  END IF;

  BEGIN
    INSERT INTO public.director_runs (
      id, workspace_id, project_id, director_type,
      input_artifact_type, input_artifact_id, input_revision,
      status, provider_id, model_id, prompt_version, schema_version,
      idempotency_key, command_fingerprint,
      estimated_cost_minor, cost_status, currency,
      correlation_id, created_at, revision,
      attempt_number, retry_of_run_id, retry_request_id
    ) VALUES (
      p_id, p_workspace_id, p_project_id, p_director_type,
      v_prev.input_artifact_type, p_input_artifact_id, p_input_revision,
      'pending', v_prev.provider_id, p_model_id, p_prompt_version, p_schema_version,
      v_new_key, p_command_fingerprint,
      p_estimated_cost_minor,
      CASE WHEN p_estimated_cost_minor IS NULL THEN 'none' ELSE 'estimated' END,
      p_currency,
      p_correlation_id, v_now, 1,
      v_next_attempt, v_prev.id, p_retry_request_id
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Concurrent same retry_request_id or key — reload winner
      SELECT * INTO v_existing
      FROM public.director_runs
      WHERE workspace_id = p_workspace_id
        AND (
          retry_request_id = p_retry_request_id
          OR idempotency_key = v_new_key
        )
      ORDER BY created_at ASC
      LIMIT 1;
      IF NOT FOUND THEN
        RAISE;
      END IF;
      IF v_existing.status IN ('pending', 'reserved', 'running') THEN
        RETURN jsonb_build_object(
          'status', 'already_running',
          'director_run_id', v_existing.id,
          'run_status', v_existing.status,
          'revision', v_existing.revision,
          'attempt_number', v_existing.attempt_number,
          'retry_of_run_id', v_existing.retry_of_run_id,
          'output_artifact_id', v_existing.output_artifact_id
        );
      END IF;
      RETURN jsonb_build_object(
        'status', 'existing',
        'director_run_id', v_existing.id,
        'run_status', v_existing.status,
        'revision', v_existing.revision,
        'attempt_number', v_existing.attempt_number,
        'retry_of_run_id', v_existing.retry_of_run_id,
        'output_artifact_id', v_existing.output_artifact_id
      );
  END;

  RETURN jsonb_build_object(
    'status', 'created',
    'director_run_id', p_id,
    'run_status', 'pending',
    'revision', 1,
    'attempt_number', v_next_attempt,
    'retry_of_run_id', v_prev.id,
    'output_artifact_id', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.director_error_code_is_retryable(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_or_retry_director_run(
  uuid, uuid, uuid, uuid, uuid, text, uuid, integer, text, text, text, text, text, bigint, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.director_error_code_is_retryable(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_or_retry_director_run(
  uuid, uuid, uuid, uuid, uuid, text, uuid, integer, text, text, text, text, text, bigint, text
) TO service_role;

COMMIT;
