-- VHS-130 — Persist provider usage/cost on fail_director_run (Porte 7G-A).
-- When tokens were consumed before a business reject (e.g. invalid_candidate):
--   - known actual cost → commit that amount + release remainder
--   - usage only / unknown cost → persist usage, release full reservation (no invented cost)
-- Existing callers without the new params keep prior release-only behaviour.

BEGIN;

DROP FUNCTION IF EXISTS public.fail_director_run(uuid, uuid, integer, text, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.fail_director_run(
  p_director_run_id uuid,
  p_workspace_id uuid,
  p_expected_revision integer,
  p_error_code text,
  p_status text DEFAULT 'failed',
  p_reservation_id uuid DEFAULT NULL,
  p_ledger_idempotency_key text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL,
  p_usage jsonb DEFAULT NULL,
  p_actual_cost_minor bigint DEFAULT NULL,
  p_cost_status text DEFAULT NULL
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
  v_commit bigint;
  v_remainder bigint;
  v_run_cost_status text;
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

  v_run_cost_status := v_run.cost_status;

  IF p_reservation_id IS NOT NULL THEN
    SELECT * INTO v_res FROM public.budget_reservations WHERE id = p_reservation_id FOR UPDATE;
    IF FOUND AND v_res.status = 'active' THEN
      IF p_actual_cost_minor IS NOT NULL AND p_actual_cost_minor >= 0 THEN
        -- Fail-closed: never silently commit more than reserved.
        IF p_actual_cost_minor > v_res.amount_minor THEN
          RAISE EXCEPTION 'actual_cost_exceeds_reservation';
        END IF;
        v_commit := p_actual_cost_minor;
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
          v_run.workspace_id, v_run.project_id, NULL, v_res.attempt_id, 'commit',
          v_commit, v_res.currency, p_reservation_id,
          COALESCE(NULLIF(p_cost_status, 'none'), 'committed'),
          'director_budget_fail_commit',
          COALESCE(p_ledger_idempotency_key, 'dir-fail-commit-' || p_director_run_id::text),
          COALESCE(p_correlation_id, v_run.correlation_id)
        );

        IF v_remainder > 0 THEN
          INSERT INTO public.cost_ledger (
            workspace_id, project_id, run_id, attempt_id, entry_type,
            amount_minor, currency, reservation_id, cost_status,
            description_code, idempotency_key, correlation_id
          ) VALUES (
            v_run.workspace_id, v_run.project_id, NULL, v_res.attempt_id, 'release',
            v_remainder, v_res.currency, p_reservation_id, 'released',
            'director_budget_fail_release_remainder',
            'dir-fail-release-rem-' || p_director_run_id::text,
            COALESCE(p_correlation_id, v_run.correlation_id)
          );
        END IF;

        v_run_cost_status := COALESCE(NULLIF(p_cost_status, 'none'), 'committed');
      ELSE
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

        v_run_cost_status := COALESCE(NULLIF(p_cost_status, 'none'), 'released');
      END IF;
    END IF;
  ELSIF p_cost_status IS NOT NULL AND p_cost_status IS DISTINCT FROM 'none' THEN
    v_run_cost_status := p_cost_status;
  END IF;

  UPDATE public.director_runs
  SET status = p_status,
      error_code = p_error_code,
      usage = COALESCE(p_usage, usage),
      actual_cost_minor = COALESCE(p_actual_cost_minor, actual_cost_minor),
      cost_status = v_run_cost_status,
      completed_at = v_now,
      revision = revision + 1
  WHERE id = p_director_run_id;

  RETURN jsonb_build_object('status', p_status, 'director_run_id', p_director_run_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_director_run(uuid, uuid, integer, text, text, uuid, text, text, jsonb, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_director_run(uuid, uuid, integer, text, text, uuid, text, text, jsonb, bigint, text)
  TO service_role;

COMMIT;
