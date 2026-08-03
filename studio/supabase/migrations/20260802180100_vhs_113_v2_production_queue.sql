-- VHS-113 — Production runs, jobs, attempts, queue RPCs.

BEGIN;

CREATE TABLE public.production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  generation_plan_artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  generation_plan_revision integer NOT NULL,
  status text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  policy_version text NOT NULL,
  estimated_cost_minor bigint NOT NULL DEFAULT 0,
  committed_cost_minor bigint NOT NULL DEFAULT 0,
  released_cost_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL,
  cancellation_requested_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz NULL,
  correlation_id text NOT NULL,
  state jsonb NOT NULL,
  CONSTRAINT production_runs_status_check CHECK (
    status IN (
      'pending', 'validating', 'running', 'cancelling',
      'completed', 'partial', 'failed', 'cancelled'
    )
  ),
  CONSTRAINT production_runs_revision_pos CHECK (revision >= 1),
  CONSTRAINT production_runs_costs_nonneg CHECK (
    estimated_cost_minor >= 0
    AND committed_cost_minor >= 0
    AND released_cost_minor >= 0
  ),
  CONSTRAINT production_runs_correlation_len CHECK (char_length(correlation_id) BETWEEN 8 AND 128)
);

CREATE INDEX production_runs_status_updated_idx
  ON public.production_runs (status, updated_at DESC);

CREATE UNIQUE INDEX production_runs_one_active_per_plan_idx
  ON public.production_runs (generation_plan_artifact_id)
  WHERE status IN ('pending', 'validating', 'running', 'cancelling');

CREATE TABLE public.production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  run_id uuid NOT NULL REFERENCES public.production_runs (id),
  scene_id text NOT NULL,
  step_id text NOT NULL,
  attempt_id text NOT NULL,
  action text NOT NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  status text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  available_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  lease_token uuid NULL,
  leased_by text NULL,
  leased_at timestamptz NULL,
  lease_expires_at timestamptz NULL,
  heartbeat_at timestamptz NULL,
  external_job_id text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NULL,
  error jsonb NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz NULL,
  CONSTRAINT production_jobs_unique_attempt UNIQUE (run_id, scene_id, step_id, attempt_id),
  CONSTRAINT production_jobs_status_check CHECK (
    status IN (
      'queued', 'leased', 'running', 'completed', 'failed',
      'cancelled', 'expired_lease'
    )
  ),
  CONSTRAINT production_jobs_attempts_bounds CHECK (
    attempt_count >= 0 AND max_attempts >= 1 AND attempt_count <= max_attempts + 1
  )
);

CREATE INDEX production_jobs_claim_idx
  ON public.production_jobs (status, available_at, priority, created_at)
  WHERE status IN ('queued', 'expired_lease');

CREATE INDEX production_jobs_lease_expires_idx
  ON public.production_jobs (lease_expires_at)
  WHERE status = 'leased';

CREATE TABLE public.generation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  run_id uuid NOT NULL REFERENCES public.production_runs (id),
  scene_id text NOT NULL,
  step_id text NOT NULL,
  attempt_number integer NOT NULL,
  kind text NOT NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL,
  estimate_minor bigint NULL,
  actual_cost_minor bigint NULL,
  cost_status text NULL,
  currency text NULL,
  external_job_id text NULL,
  error_code text NULL,
  retryable boolean NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT generation_attempts_number_pos CHECK (attempt_number >= 1),
  CONSTRAINT generation_attempts_kind_check CHECK (kind IN ('primary', 'fallback')),
  CONSTRAINT generation_attempts_idem_unique UNIQUE (idempotency_key)
);

CREATE INDEX generation_attempts_run_idx
  ON public.generation_attempts (run_id, scene_id, step_id, attempt_number);

-- Claim: queued or expired leases → leased
CREATE OR REPLACE FUNCTION public.claim_production_jobs(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
RETURNS SETOF public.production_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp() AT TIME ZONE 'utc';
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 1), 1), 50);
  v_lease integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 60), 15), 900);
BEGIN
  IF p_worker_id IS NULL OR char_length(p_worker_id) < 1 OR char_length(p_worker_id) > 120 THEN
    RAISE EXCEPTION 'invalid_worker_id';
  END IF;

  -- Expire stale leases first (recoverable)
  UPDATE public.production_jobs
  SET status = 'expired_lease',
      updated_at = v_now
  WHERE status = 'leased'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < v_now;

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.production_jobs j
    WHERE (
        j.status = 'queued'
        OR j.status = 'expired_lease'
      )
      AND j.available_at <= v_now
    ORDER BY j.priority ASC, j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.production_jobs j
  SET status = 'leased',
      lease_token = gen_random_uuid(),
      leased_by = p_worker_id,
      leased_at = v_now,
      lease_expires_at = v_now + make_interval(secs => v_lease),
      heartbeat_at = v_now,
      updated_at = v_now,
      attempt_count = j.attempt_count + 1
  FROM candidates c
  WHERE j.id = c.id
  RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_production_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS public.production_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp() AT TIME ZONE 'utc';
  v_lease integer := LEAST(GREATEST(COALESCE(p_lease_seconds, 60), 15), 900);
  v_row public.production_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.production_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;
  IF v_row.lease_token IS DISTINCT FROM p_lease_token
     OR v_row.leased_by IS DISTINCT FROM p_worker_id
     OR v_row.status NOT IN ('leased', 'running')
     OR v_row.lease_expires_at IS NULL
     OR v_row.lease_expires_at < v_now
  THEN
    RAISE EXCEPTION 'lease_invalid';
  END IF;

  UPDATE public.production_jobs
  SET heartbeat_at = v_now,
      lease_expires_at = v_now + make_interval(secs => v_lease),
      status = CASE WHEN status = 'leased' THEN 'running' ELSE status END,
      updated_at = v_now
  WHERE id = p_job_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_production_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_result jsonb
)
RETURNS public.production_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp() AT TIME ZONE 'utc';
  v_row public.production_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.production_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;
  IF v_row.lease_token IS DISTINCT FROM p_lease_token
     OR v_row.leased_by IS DISTINCT FROM p_worker_id
     OR v_row.status NOT IN ('leased', 'running')
     OR v_row.lease_expires_at IS NULL
     OR v_row.lease_expires_at < v_now
  THEN
    RAISE EXCEPTION 'lease_invalid';
  END IF;

  UPDATE public.production_jobs
  SET status = 'completed',
      result = p_result,
      error = NULL,
      completed_at = v_now,
      updated_at = v_now,
      lease_token = NULL,
      lease_expires_at = NULL
  WHERE id = p_job_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_production_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_error jsonb
)
RETURNS public.production_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp() AT TIME ZONE 'utc';
  v_row public.production_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.production_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;
  IF v_row.lease_token IS DISTINCT FROM p_lease_token
     OR v_row.leased_by IS DISTINCT FROM p_worker_id
     OR v_row.status NOT IN ('leased', 'running')
     OR v_row.lease_expires_at IS NULL
     OR v_row.lease_expires_at < v_now
  THEN
    RAISE EXCEPTION 'lease_invalid';
  END IF;

  UPDATE public.production_jobs
  SET status = 'failed',
      error = p_error,
      completed_at = v_now,
      updated_at = v_now,
      lease_token = NULL,
      lease_expires_at = NULL
  WHERE id = p_job_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_production_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_available_at timestamptz DEFAULT NULL
)
RETURNS public.production_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp() AT TIME ZONE 'utc';
  v_row public.production_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.production_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;
  IF v_row.lease_token IS DISTINCT FROM p_lease_token
     OR v_row.leased_by IS DISTINCT FROM p_worker_id
     OR v_row.status NOT IN ('leased', 'running')
  THEN
    RAISE EXCEPTION 'lease_invalid';
  END IF;

  UPDATE public.production_jobs
  SET status = 'queued',
      lease_token = NULL,
      leased_by = NULL,
      leased_at = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL,
      available_at = COALESCE(p_available_at, v_now),
      updated_at = v_now
  WHERE id = p_job_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMIT;
