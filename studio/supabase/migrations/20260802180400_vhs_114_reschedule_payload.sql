-- VHS-114 — Reschedule production job with payload update (poll mode)
-- Additive only. Not applied remotely by this increment.
-- Gap closed: release_production_job could not update payload.mode to poll.

BEGIN;

CREATE OR REPLACE FUNCTION public.reschedule_production_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_available_at timestamptz,
  p_payload jsonb
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
  IF p_available_at IS NULL THEN
    RAISE EXCEPTION 'available_at_required';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload_required';
  END IF;

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
      available_at = p_available_at,
      payload = p_payload,
      updated_at = v_now
  WHERE id = p_job_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_production_job(uuid, uuid, text, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_production_job(uuid, uuid, text, timestamptz, jsonb) TO service_role;

COMMIT;
