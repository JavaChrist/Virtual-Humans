-- VHS-131 — Harden reschedule_production_job EXECUTE grants (Porte 7G-B).
--
-- Diagnosis:
--   Schema public has default privileges granting EXECUTE on new functions to
--   anon + authenticated. VHS-114 only revoked PUBLIC, so authenticated kept
--   EXECUTE and vhs_115 test 49 failed after local resets on current Supabase
--   images. VHS-130 does not touch this RPC.
--
-- Fix (idempotent): revoke PUBLIC/anon/authenticated; grant service_role only.

BEGIN;

REVOKE ALL ON FUNCTION public.reschedule_production_job(uuid, uuid, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_production_job(uuid, uuid, text, timestamptz, jsonb)
  TO service_role;

COMMIT;
