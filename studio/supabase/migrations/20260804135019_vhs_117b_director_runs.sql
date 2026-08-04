-- VHS-117B — director_runs + scoped budget for director executions + persist marketing_plan.
-- Local only until explicit remote apply authorization.

BEGIN;

-- ---------------------------------------------------------------------------
-- director_runs
-- ---------------------------------------------------------------------------
CREATE TABLE public.director_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  director_type text NOT NULL,
  input_artifact_type text NOT NULL,
  input_artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  input_revision integer NOT NULL,
  status text NOT NULL,
  provider_id text NULL,
  model_id text NULL,
  prompt_version text NULL,
  schema_version text NOT NULL,
  idempotency_key text NOT NULL,
  command_fingerprint text NOT NULL,
  estimated_cost_minor bigint NULL,
  actual_cost_minor bigint NULL,
  cost_status text NOT NULL DEFAULT 'none',
  currency text NULL,
  usage jsonb NULL,
  error_code text NULL,
  output_artifact_id uuid NULL REFERENCES public.project_artifacts (id),
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  revision integer NOT NULL DEFAULT 1,
  CONSTRAINT director_runs_type_check CHECK (director_type IN ('marketing')),
  CONSTRAINT director_runs_input_type_check CHECK (input_artifact_type IN ('video_project_brief')),
  CONSTRAINT director_runs_status_check CHECK (
    status IN ('pending', 'reserved', 'running', 'completed', 'needs_input', 'failed', 'cancelled')
  ),
  CONSTRAINT director_runs_cost_status_check CHECK (
    cost_status IN ('none', 'estimated', 'reserved', 'committed', 'released', 'unknown')
  ),
  CONSTRAINT director_runs_revision_pos CHECK (revision >= 1),
  CONSTRAINT director_runs_input_revision_pos CHECK (input_revision >= 1),
  CONSTRAINT director_runs_idempotency_key_len CHECK (char_length(idempotency_key) BETWEEN 8 AND 200),
  CONSTRAINT director_runs_fingerprint_len CHECK (char_length(command_fingerprint) BETWEEN 8 AND 128)
);

CREATE UNIQUE INDEX director_runs_idempotency_key_uidx
  ON public.director_runs (workspace_id, idempotency_key);

CREATE INDEX director_runs_project_created_idx
  ON public.director_runs (project_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Scoped budget (additive) — production_attempt | director_run
-- ---------------------------------------------------------------------------
ALTER TABLE public.budget_reservations
  ADD COLUMN scope_type text,
  ADD COLUMN scope_id uuid;

UPDATE public.budget_reservations
SET scope_type = 'production_attempt',
    scope_id = run_id
WHERE scope_type IS NULL;

ALTER TABLE public.budget_reservations
  ALTER COLUMN scope_type SET DEFAULT 'production_attempt',
  ALTER COLUMN scope_type SET NOT NULL,
  ALTER COLUMN scope_id SET NOT NULL;

ALTER TABLE public.budget_reservations
  ALTER COLUMN run_id DROP NOT NULL;

ALTER TABLE public.budget_reservations
  ADD CONSTRAINT budget_reservations_scope_check CHECK (
    (
      scope_type = 'production_attempt'
      AND run_id IS NOT NULL
      AND scope_id = run_id
    )
    OR (
      scope_type = 'director_run'
      AND run_id IS NULL
      AND scope_id IS NOT NULL
    )
  );

DROP INDEX IF EXISTS public.budget_reservations_one_active_per_attempt_idx;

CREATE UNIQUE INDEX budget_reservations_one_active_per_scope_attempt_idx
  ON public.budget_reservations (scope_type, scope_id, attempt_id)
  WHERE status = 'active';

-- Keep production reserve_budget writing scope columns
CREATE OR REPLACE FUNCTION public.reserve_budget(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_run_id uuid,
  p_attempt_id text,
  p_amount_minor bigint,
  p_currency text,
  p_correlation_id text,
  p_ledger_idempotency_key text
)
RETURNS public.budget_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit bigint;
  v_limit_currency text;
  v_held bigint;
  v_exposure bigint;
  v_row public.budget_reservations%ROWTYPE;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT hard_limit_minor, currency INTO v_limit, v_limit_currency
  FROM public.workspace_budget_policies
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'budget_policy_missing';
  END IF;
  IF v_limit_currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'currency_mismatch';
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO v_held
  FROM public.budget_reservations
  WHERE workspace_id = p_workspace_id AND status = 'active';

  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type = 'commit' THEN amount_minor
      WHEN entry_type = 'refund' THEN -amount_minor
      ELSE 0
    END
  ), 0) INTO v_exposure
  FROM public.cost_ledger
  WHERE workspace_id = p_workspace_id
    AND entry_type IN ('commit', 'refund');

  IF v_held + GREATEST(v_exposure, 0) + p_amount_minor > v_limit THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  INSERT INTO public.budget_reservations (
    id, workspace_id, project_id, run_id, attempt_id,
    amount_minor, currency, status, correlation_id,
    scope_type, scope_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, p_run_id, p_attempt_id,
    p_amount_minor, p_currency, 'active', p_correlation_id,
    'production_attempt', p_run_id
  )
  RETURNING * INTO v_row;

  INSERT INTO public.cost_ledger (
    workspace_id, project_id, run_id, attempt_id, entry_type,
    amount_minor, currency, reservation_id, cost_status,
    description_code, idempotency_key, correlation_id
  ) VALUES (
    p_workspace_id, p_project_id, p_run_id, p_attempt_id, 'reservation',
    p_amount_minor, p_currency, p_id, 'reserved',
    'budget_reserve', p_ledger_idempotency_key, p_correlation_id
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_director_budget(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_director_run_id uuid,
  p_attempt_id text,
  p_amount_minor bigint,
  p_currency text,
  p_correlation_id text,
  p_ledger_idempotency_key text
)
RETURNS public.budget_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit bigint;
  v_limit_currency text;
  v_held bigint;
  v_exposure bigint;
  v_run public.director_runs%ROWTYPE;
  v_row public.budget_reservations%ROWTYPE;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
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

  SELECT hard_limit_minor, currency INTO v_limit, v_limit_currency
  FROM public.workspace_budget_policies
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'budget_policy_missing';
  END IF;
  IF v_limit_currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'currency_mismatch';
  END IF;

  SELECT COALESCE(SUM(amount_minor), 0) INTO v_held
  FROM public.budget_reservations
  WHERE workspace_id = p_workspace_id AND status = 'active';

  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type = 'commit' THEN amount_minor
      WHEN entry_type = 'refund' THEN -amount_minor
      ELSE 0
    END
  ), 0) INTO v_exposure
  FROM public.cost_ledger
  WHERE workspace_id = p_workspace_id
    AND entry_type IN ('commit', 'refund');

  IF v_held + GREATEST(v_exposure, 0) + p_amount_minor > v_limit THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  INSERT INTO public.budget_reservations (
    id, workspace_id, project_id, run_id, attempt_id,
    amount_minor, currency, status, correlation_id,
    scope_type, scope_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, NULL, p_attempt_id,
    p_amount_minor, p_currency, 'active', p_correlation_id,
    'director_run', p_director_run_id
  )
  RETURNING * INTO v_row;

  INSERT INTO public.cost_ledger (
    workspace_id, project_id, run_id, attempt_id, entry_type,
    amount_minor, currency, reservation_id, cost_status,
    description_code, idempotency_key, correlation_id
  ) VALUES (
    p_workspace_id, p_project_id, NULL, p_attempt_id, 'reservation',
    p_amount_minor, p_currency, p_id, 'reserved',
    'director_budget_reserve', p_ledger_idempotency_key, p_correlation_id
  );

  UPDATE public.director_runs
  SET status = 'reserved',
      cost_status = 'reserved',
      estimated_cost_minor = p_amount_minor,
      currency = p_currency,
      revision = revision + 1
  WHERE id = p_director_run_id;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Idempotent begin / get marketing director run
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_or_get_marketing_director_run(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_input_artifact_id uuid,
  p_input_revision integer,
  p_model_id text,
  p_prompt_version text,
  p_schema_version text,
  p_idempotency_key text,
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
  v_existing public.director_runs%ROWTYPE;
  v_active_art public.active_artifact_revisions%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
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
        'run_status', v_existing.status,
        'revision', v_existing.revision,
        'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    IF v_existing.status = 'completed' THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'director_run_id', v_existing.id,
        'run_status', v_existing.status,
        'revision', v_existing.revision,
        'output_artifact_id', v_existing.output_artifact_id
      );
    END IF;
    -- failed / needs_input / cancelled → allow new attempt only with new key
    RAISE EXCEPTION 'director_run_terminal_reuse';
  END IF;

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

  INSERT INTO public.director_runs (
    id, workspace_id, project_id, director_type,
    input_artifact_type, input_artifact_id, input_revision,
    status, provider_id, model_id, prompt_version, schema_version,
    idempotency_key, command_fingerprint,
    estimated_cost_minor, cost_status, currency,
    correlation_id, created_at, revision
  ) VALUES (
    p_id, p_workspace_id, p_project_id, 'marketing',
    'video_project_brief', p_input_artifact_id, p_input_revision,
    'pending', 'openai', p_model_id, p_prompt_version, p_schema_version,
    p_idempotency_key, p_command_fingerprint,
    p_estimated_cost_minor,
    CASE WHEN p_estimated_cost_minor IS NULL THEN 'none' ELSE 'estimated' END,
    p_currency,
    p_correlation_id, v_now, 1
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'director_run_id', p_id,
    'run_status', 'pending',
    'revision', 1,
    'output_artifact_id', NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Persist marketing_plan (atomic) — marketing only
-- ---------------------------------------------------------------------------
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

  -- Commit reservation if present
  IF p_reservation_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.budget_reservations
    WHERE id = p_reservation_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reservation_not_found';
    END IF;
    IF v_res.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'reservation_not_active';
    END IF;
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
      COALESCE(p_actual_cost_minor, v_res.amount_minor), v_res.currency, p_reservation_id,
      COALESCE(NULLIF(p_cost_status, 'none'), 'committed'),
      'director_budget_commit',
      COALESCE(p_ledger_idempotency_key, 'dir-commit-' || p_director_run_id::text),
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

CREATE OR REPLACE FUNCTION public.fail_director_run(
  p_director_run_id uuid,
  p_workspace_id uuid,
  p_expected_revision integer,
  p_error_code text,
  p_status text DEFAULT 'failed',
  p_reservation_id uuid DEFAULT NULL,
  p_ledger_idempotency_key text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.director_runs%ROWTYPE;
  v_res public.budget_reservations%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_status IS DISTINCT FROM 'failed' AND p_status IS DISTINCT FROM 'needs_input' AND p_status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_run FROM public.director_runs WHERE id = p_director_run_id FOR UPDATE;
  IF NOT FOUND OR v_run.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'director_run_not_found';
  END IF;
  IF v_run.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;

  IF p_reservation_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.budget_reservations WHERE id = p_reservation_id FOR UPDATE;
    IF FOUND AND v_res.status = 'active' THEN
      UPDATE public.budget_reservations
      SET status = 'released', released_at = v_now, revision = revision + 1
      WHERE id = p_reservation_id;
      INSERT INTO public.cost_ledger (
        workspace_id, project_id, run_id, attempt_id, entry_type,
        amount_minor, currency, reservation_id, cost_status,
        description_code, idempotency_key, correlation_id
      ) VALUES (
        v_run.workspace_id, v_run.project_id, NULL, v_res.attempt_id, 'release',
        v_res.amount_minor, v_res.currency, p_reservation_id, 'released',
        'director_budget_release',
        COALESCE(p_ledger_idempotency_key, 'dir-release-' || p_director_run_id::text),
        COALESCE(p_correlation_id, v_run.correlation_id)
      );
    END IF;
  END IF;

  UPDATE public.director_runs
  SET status = p_status,
      error_code = p_error_code,
      cost_status = CASE WHEN p_reservation_id IS NOT NULL THEN 'released' ELSE cost_status END,
      completed_at = v_now,
      revision = revision + 1
  WHERE id = p_director_run_id;

  RETURN jsonb_build_object('status', p_status, 'director_run_id', p_director_run_id);
END;
$$;

-- RLS + grants
ALTER TABLE public.director_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.director_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.director_runs TO service_role;

REVOKE ALL ON FUNCTION public.reserve_director_budget(uuid, uuid, uuid, uuid, text, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_or_get_marketing_director_run(uuid, uuid, uuid, uuid, integer, text, text, text, text, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_marketing_plan(uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_director_run(uuid, uuid, integer, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_director_budget(uuid, uuid, uuid, uuid, text, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_or_get_marketing_director_run(uuid, uuid, uuid, uuid, integer, text, text, text, text, text, text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_marketing_plan(uuid, uuid, uuid, uuid, uuid, integer, jsonb, text, text, text, text, text, uuid, bigint, text, jsonb, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_director_run(uuid, uuid, integer, text, text, uuid, text, text) TO service_role;

COMMIT;
