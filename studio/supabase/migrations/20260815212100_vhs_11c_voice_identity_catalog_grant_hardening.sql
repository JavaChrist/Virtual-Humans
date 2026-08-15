-- VHS-11C — Harden Voice identity catalog grants.
-- Neutralizes DEFAULT PRIVILEGES overlay on these three objects only.
-- Does not alter global default privileges, schema, data, RLS, or policies.
-- Local-only in this phase: NOT applied to Production here.
-- Schema/grants only: no seed rows, no provider secret, no provider voice identifier.

BEGIN;

REVOKE ALL ON TABLE public.voice_identities FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.voice_consent_attestations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.project_voice_bindings FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.voice_identities TO service_role;
GRANT SELECT, INSERT ON TABLE public.voice_consent_attestations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_voice_bindings TO service_role;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.voice_identities FROM PUBLIC, anon, authenticated, service_role;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.voice_consent_attestations FROM PUBLIC, anon, authenticated, service_role;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.project_voice_bindings FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
