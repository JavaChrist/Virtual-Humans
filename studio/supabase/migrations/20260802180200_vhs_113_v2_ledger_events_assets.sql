-- VHS-113 — cost_ledger, budget_reservations, idempotency, outbox, assets, audit.
-- Sign convention (documented):
--   All amount_minor values are non-negative integers.
--   entry_type determines effect:
--     reservation = hold against hard limit
--     commit      = finalize spend (releases matching reservation separately)
--     release     = free unused reservation
--     adjustment  = corrective entry (positive increase of committed exposure)
--     refund      = reduce committed exposure
-- vh_spend remains untouched; no triggers between systems.

BEGIN;

CREATE TABLE public.cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  run_id uuid NULL REFERENCES public.production_runs (id),
  scene_id text NULL,
  step_id text NULL,
  attempt_id text NULL,
  entry_type text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  estimate_id text NULL,
  reservation_id uuid NULL,
  provider_id text NULL,
  model_id text NULL,
  cost_status text NOT NULL,
  description_code text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  correlation_id text NOT NULL,
  CONSTRAINT cost_ledger_amount_nonneg CHECK (amount_minor >= 0),
  CONSTRAINT cost_ledger_entry_type_check CHECK (
    entry_type IN ('reservation', 'commit', 'release', 'adjustment', 'refund')
  ),
  CONSTRAINT cost_ledger_cost_status_check CHECK (
    cost_status IN ('estimated', 'reserved', 'committed', 'released', 'provisional', 'refunded')
  ),
  CONSTRAINT cost_ledger_idem_unique UNIQUE (idempotency_key),
  CONSTRAINT cost_ledger_correlation_len CHECK (char_length(correlation_id) BETWEEN 8 AND 128)
);

CREATE INDEX cost_ledger_workspace_created_idx
  ON public.cost_ledger (workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_cost_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'cost_ledger is append-only';
END;
$$;

CREATE TRIGGER cost_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.cost_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cost_ledger_mutation();

CREATE TABLE public.budget_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  run_id uuid NOT NULL REFERENCES public.production_runs (id),
  attempt_id text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  committed_at timestamptz NULL,
  released_at timestamptz NULL,
  expires_at timestamptz NULL,
  correlation_id text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  CONSTRAINT budget_reservations_amount_pos CHECK (amount_minor > 0),
  CONSTRAINT budget_reservations_status_check CHECK (
    status IN ('active', 'committed', 'released', 'expired')
  ),
  CONSTRAINT budget_reservations_revision_pos CHECK (revision >= 1)
);

CREATE UNIQUE INDEX budget_reservations_one_active_per_attempt_idx
  ON public.budget_reservations (run_id, attempt_id)
  WHERE status = 'active';

CREATE TABLE public.idempotency_records (
  key text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  command_fingerprint text NOT NULL,
  status text NOT NULL,
  result jsonb NULL,
  error jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NULL,
  CONSTRAINT idempotency_records_status_check CHECK (
    status IN ('begun', 'completed', 'failed')
  ),
  CONSTRAINT idempotency_records_key_len CHECK (char_length(key) BETWEEN 1 AND 200)
);

CREATE TABLE public.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  run_id uuid NULL REFERENCES public.production_runs (id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_revision integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  published_at timestamptz NULL,
  publish_attempts integer NOT NULL DEFAULT 0,
  last_error_code text NULL,
  CONSTRAINT domain_events_revision_pos CHECK (aggregate_revision >= 0)
  -- Dedupe is by primary key id (event id). Multiple events of the same type
  -- may exist per aggregate (e.g. step.completed × N).
);

CREATE INDEX domain_events_unpublished_idx
  ON public.domain_events (created_at)
  WHERE published_at IS NULL;

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  run_id uuid NULL REFERENCES public.production_runs (id),
  scene_id text NULL,
  step_id text NULL,
  kind text NOT NULL,
  mime_type text NOT NULL,
  storage_bucket text NULL,
  storage_path text NULL,
  source_kind text NOT NULL,
  source_provider text NULL,
  external_job_id text NULL,
  checksum text NULL,
  size_bytes bigint NULL,
  width integer NULL,
  height integer NULL,
  duration_seconds numeric(10, 2) NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NULL,
  CONSTRAINT assets_kind_check CHECK (
    kind IN ('image', 'video', 'audio', 'lipsync', 'carousel')
  ),
  CONSTRAINT assets_source_kind_check CHECK (
    source_kind IN ('temporary_external', 'inline_data_url', 'internal')
  ),
  CONSTRAINT assets_size_nonneg CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

CREATE INDEX assets_project_scene_kind_idx
  ON public.assets (project_id, scene_id, kind);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NULL REFERENCES public.video_projects (id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT audit_log_actor_type_check CHECK (
    actor_type IN ('shared_password', 'system', 'worker')
  )
);

CREATE INDEX audit_log_workspace_created_idx
  ON public.audit_log (workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- Atomic budget reserve: checks hard limit vs active reservations + commits
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
  v_committed bigint;
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

  SELECT COALESCE(SUM(amount_minor), 0) INTO v_committed
  FROM public.cost_ledger
  WHERE workspace_id = p_workspace_id AND entry_type = 'commit';

  -- Subtract refunds
  SELECT v_committed - COALESCE(SUM(amount_minor), 0) INTO v_committed
  FROM public.cost_ledger
  WHERE workspace_id = p_workspace_id AND entry_type = 'refund';

  IF v_held + GREATEST(v_committed, 0) + p_amount_minor > v_limit THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  INSERT INTO public.budget_reservations (
    id, workspace_id, project_id, run_id, attempt_id,
    amount_minor, currency, status, correlation_id
  ) VALUES (
    p_id, p_workspace_id, p_project_id, p_run_id, p_attempt_id,
    p_amount_minor, p_currency, 'active', p_correlation_id
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

CREATE OR REPLACE FUNCTION public.commit_budget_reservation(
  p_reservation_id uuid,
  p_amount_minor bigint,
  p_cost_status text,
  p_ledger_idempotency_key text,
  p_expected_revision integer
)
RETURNS public.budget_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.budget_reservations%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT * INTO v_row FROM public.budget_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_reservation'; END IF;
  IF v_row.status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'invalid_reservation_status'; END IF;
  IF v_row.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'optimistic_conflict'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor < 0 OR p_amount_minor > v_row.amount_minor THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.budget_reservations
  SET status = 'committed',
      committed_at = v_now,
      revision = revision + 1
  WHERE id = p_reservation_id
  RETURNING * INTO v_row;

  INSERT INTO public.cost_ledger (
    workspace_id, project_id, run_id, attempt_id, entry_type,
    amount_minor, currency, reservation_id, cost_status,
    description_code, idempotency_key, correlation_id
  ) VALUES (
    v_row.workspace_id, v_row.project_id, v_row.run_id, v_row.attempt_id, 'commit',
    p_amount_minor, v_row.currency, p_reservation_id, COALESCE(p_cost_status, 'committed'),
    'budget_commit', p_ledger_idempotency_key, v_row.correlation_id
  );

  IF p_amount_minor < v_row.amount_minor THEN
    INSERT INTO public.cost_ledger (
      workspace_id, project_id, run_id, attempt_id, entry_type,
      amount_minor, currency, reservation_id, cost_status,
      description_code, idempotency_key, correlation_id
    ) VALUES (
      v_row.workspace_id, v_row.project_id, v_row.run_id, v_row.attempt_id, 'release',
      v_row.amount_minor - p_amount_minor, v_row.currency, p_reservation_id, 'released',
      'budget_commit_release_remainder',
      p_ledger_idempotency_key || ':release',
      v_row.correlation_id
    );
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_budget_reservation(
  p_reservation_id uuid,
  p_ledger_idempotency_key text,
  p_expected_revision integer
)
RETURNS public.budget_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.budget_reservations%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT * INTO v_row FROM public.budget_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_reservation'; END IF;
  IF v_row.status IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'invalid_reservation_status'; END IF;
  IF v_row.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'optimistic_conflict'; END IF;

  UPDATE public.budget_reservations
  SET status = 'released',
      released_at = v_now,
      revision = revision + 1
  WHERE id = p_reservation_id
  RETURNING * INTO v_row;

  INSERT INTO public.cost_ledger (
    workspace_id, project_id, run_id, attempt_id, entry_type,
    amount_minor, currency, reservation_id, cost_status,
    description_code, idempotency_key, correlation_id
  ) VALUES (
    v_row.workspace_id, v_row.project_id, v_row.run_id, v_row.attempt_id, 'release',
    v_row.amount_minor, v_row.currency, p_reservation_id, 'released',
    'budget_release', p_ledger_idempotency_key, v_row.correlation_id
  );

  RETURN v_row;
END;
$$;

-- Idempotency begin (atomic)
CREATE OR REPLACE FUNCTION public.idempotency_begin(
  p_key text,
  p_workspace_id uuid,
  p_project_id uuid,
  p_fingerprint text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.idempotency_records%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.idempotency_records WHERE key = p_key FOR UPDATE;
  IF FOUND THEN
    IF v_row.status = 'completed' THEN
      RETURN 'already_completed';
    END IF;
    IF v_row.command_fingerprint IS DISTINCT FROM p_fingerprint THEN
      RETURN 'fingerprint_mismatch';
    END IF;
    IF v_row.status = 'begun' THEN
      RETURN 'begun';
    END IF;
    -- failed → allow restart
    UPDATE public.idempotency_records
    SET status = 'begun',
        command_fingerprint = p_fingerprint,
        result = NULL,
        error = NULL,
        updated_at = timezone('utc', now())
    WHERE key = p_key;
    RETURN 'begun';
  END IF;

  INSERT INTO public.idempotency_records (
    key, workspace_id, project_id, command_fingerprint, status
  ) VALUES (
    p_key, p_workspace_id, p_project_id, p_fingerprint, 'begun'
  );
  RETURN 'begun';
END;
$$;

COMMIT;
