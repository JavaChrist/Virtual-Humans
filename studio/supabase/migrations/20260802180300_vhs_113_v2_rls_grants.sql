-- VHS-113 — RLS + revoke public execute on sensitive RPCs.
-- Pilot: server/service_role only. No owner policies (no Supabase Auth users yet).

BEGIN;

-- Fix reserve_budget exposure calculation
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

-- Enable RLS on all V2 tables (no policies → deny anon/authenticated; service_role bypasses RLS)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_budget_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_artifact_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storyboard_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Table privileges: service_role needs explicit GRANTs (RLS bypass alone is insufficient).
-- anon/authenticated: revoke table access (defense in depth; RLS already has no policies).
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.workspaces,
  public.workspace_budget_policies,
  public.video_projects,
  public.project_artifacts,
  public.active_artifact_revisions,
  public.artifact_approvals,
  public.storyboard_scenes,
  public.generation_plans,
  public.production_runs,
  public.production_jobs,
  public.generation_attempts,
  public.cost_ledger,
  public.budget_reservations,
  public.idempotency_records,
  public.domain_events,
  public.assets,
  public.audit_log
TO service_role;

REVOKE ALL ON TABLE
  public.workspaces,
  public.workspace_budget_policies,
  public.video_projects,
  public.project_artifacts,
  public.active_artifact_revisions,
  public.artifact_approvals,
  public.storyboard_scenes,
  public.generation_plans,
  public.production_runs,
  public.production_jobs,
  public.generation_attempts,
  public.cost_ledger,
  public.budget_reservations,
  public.idempotency_records,
  public.domain_events,
  public.assets,
  public.audit_log
FROM anon, authenticated;

-- Revoke execute from PUBLIC / anon / authenticated on sensitive RPCs
REVOKE ALL ON FUNCTION public.set_active_artifact_revision(uuid, uuid, text, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_production_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_production_job(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_production_job(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_production_job(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_production_job(uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_budget(uuid, uuid, uuid, uuid, text, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_budget_reservation(uuid, bigint, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_budget_reservation(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.idempotency_begin(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Grant to service_role only (Supabase server role)
GRANT EXECUTE ON FUNCTION public.set_active_artifact_revision(uuid, uuid, text, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_production_jobs(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_production_job(uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_production_job(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_production_job(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_production_job(uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_budget(uuid, uuid, uuid, uuid, text, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.commit_budget_reservation(uuid, bigint, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_budget_reservation(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.idempotency_begin(text, uuid, uuid, text) TO service_role;

COMMIT;
