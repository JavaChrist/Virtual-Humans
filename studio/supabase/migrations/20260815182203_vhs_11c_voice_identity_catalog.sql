-- VHS-11C — Voice identity catalog, bounded consent, project binding.
-- Additive / local-only. NOT applied to Production in this phase.
-- Schema only: no seed rows, no provider secret, no fingerprint value.
-- Access: RLS on, no anon/authenticated policies, service_role only.

BEGIN;

-- ---------------------------------------------------------------------------
-- voice_identities
-- ---------------------------------------------------------------------------
CREATE TABLE public.voice_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  stable_key text NOT NULL,
  role text NOT NULL,
  character_id text NULL,
  provider text NOT NULL,
  model_id text NOT NULL,
  locale text NOT NULL,
  secret_locator text NOT NULL,
  voice_fingerprint text NOT NULL,
  status text NOT NULL,
  revocable boolean NOT NULL DEFAULT true,
  active_for_provider_execution boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  revision integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT voice_identities_stable_key_len CHECK (char_length(stable_key) BETWEEN 1 AND 64),
  CONSTRAINT voice_identities_role_check CHECK (role IN ('character', 'narrator')),
  CONSTRAINT voice_identities_character_role CHECK (
    (role = 'character' AND character_id IS NOT NULL)
    OR (role = 'narrator' AND character_id IS NULL)
  ),
  CONSTRAINT voice_identities_provider_check CHECK (provider = 'elevenlabs'),
  CONSTRAINT voice_identities_model_check CHECK (model_id = 'eleven_multilingual_v2'),
  CONSTRAINT voice_identities_locale_len CHECK (char_length(locale) BETWEEN 2 AND 16),
  CONSTRAINT voice_identities_locator_len CHECK (char_length(secret_locator) BETWEEN 8 AND 128),
  CONSTRAINT voice_identities_fingerprint_sha256 CHECK (voice_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT voice_identities_status_check CHECK (
    status IN ('prepared', 'available', 'unavailable', 'blocked', 'revoked')
  ),
  CONSTRAINT voice_identities_revision_pos CHECK (revision >= 1),
  CONSTRAINT voice_identities_execution_off_default CHECK (active_for_provider_execution = false),
  CONSTRAINT voice_identities_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT voice_identities_no_provider_secret_metadata CHECK (
    NOT (metadata ? 'xiApiKey')
  ),
  CONSTRAINT voice_identities_workspace_stable_key_unique UNIQUE (workspace_id, stable_key),
  CONSTRAINT voice_identities_workspace_locator_unique UNIQUE (workspace_id, secret_locator),
  CONSTRAINT voice_identities_workspace_fingerprint_unique UNIQUE (workspace_id, voice_fingerprint)
);

CREATE INDEX voice_identities_workspace_role_status_idx
  ON public.voice_identities (workspace_id, role, status);

COMMENT ON TABLE public.voice_identities IS
  'VHS-11C: catalog of character/narrator voice identities. Server-only. Fingerprint is sha256 of the configured secret.';
COMMENT ON COLUMN public.voice_identities.secret_locator IS
  'Configuration locator resolved call-time. Never a raw provider secret.';
COMMENT ON COLUMN public.voice_identities.voice_fingerprint IS
  'SHA-256 of the configured voice secret. Server-only. Not for client routes.';

-- ---------------------------------------------------------------------------
-- voice_consent_attestations (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.voice_consent_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  voice_identity_id uuid NOT NULL REFERENCES public.voice_identities (id),
  scope text NOT NULL,
  allowed_content_kinds text[] NOT NULL,
  allowed_project_id uuid NULL REFERENCES public.video_projects (id),
  allowed_locale text NOT NULL,
  authorization_source text NOT NULL,
  decision text NOT NULL,
  revocable boolean NOT NULL DEFAULT true,
  revoked_at timestamptz NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  idempotency_key text NOT NULL,
  version text NOT NULL,
  CONSTRAINT voice_consent_scope_check CHECK (
    scope IN ('character_dialogue', 'project_voice_over', 'workspace_voice_over')
  ),
  CONSTRAINT voice_consent_kinds_check CHECK (
    allowed_content_kinds <@ ARRAY['dialogue', 'voice_over']::text[]
    AND cardinality(allowed_content_kinds) >= 1
  ),
  CONSTRAINT voice_consent_locale_len CHECK (char_length(allowed_locale) BETWEEN 2 AND 16),
  CONSTRAINT voice_consent_source_len CHECK (char_length(authorization_source) BETWEEN 4 AND 128),
  CONSTRAINT voice_consent_decision_check CHECK (
    decision IN ('authorized', 'refused', 'revoked', 'insufficient')
  ),
  CONSTRAINT voice_consent_revoked_consistency CHECK (
    (decision = 'revoked' AND revoked_at IS NOT NULL)
    OR (decision <> 'revoked' AND revoked_at IS NULL)
  ),
  CONSTRAINT voice_consent_created_by_len CHECK (char_length(created_by) BETWEEN 1 AND 128),
  CONSTRAINT voice_consent_idempotency_len CHECK (char_length(idempotency_key) BETWEEN 8 AND 160),
  CONSTRAINT voice_consent_version_len CHECK (char_length(version) BETWEEN 1 AND 64),
  CONSTRAINT voice_consent_workspace_idempotency_unique UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX voice_consent_workspace_identity_created_idx
  ON public.voice_consent_attestations (workspace_id, voice_identity_id, created_at DESC);

COMMENT ON TABLE public.voice_consent_attestations IS
  'VHS-11C: append-only Voice consent attestations. Revocation inserts a new row. No silent overwrite.';

-- ---------------------------------------------------------------------------
-- project_voice_bindings (append-only revisions)
-- ---------------------------------------------------------------------------
CREATE TABLE public.project_voice_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  script_artifact_id uuid NOT NULL,
  script_revision integer NOT NULL,
  binding_role text NOT NULL,
  voice_identity_id uuid NOT NULL REFERENCES public.voice_identities (id),
  allowed_content_kind text NOT NULL,
  locale text NOT NULL,
  status text NOT NULL,
  selected_by text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  revision integer NOT NULL,
  CONSTRAINT project_voice_bindings_script_revision_pos CHECK (script_revision >= 1),
  CONSTRAINT project_voice_bindings_role_check CHECK (binding_role IN ('character', 'narrator')),
  CONSTRAINT project_voice_bindings_kind_check CHECK (allowed_content_kind IN ('dialogue', 'voice_over')),
  CONSTRAINT project_voice_bindings_role_kind_check CHECK (
    (binding_role = 'character' AND allowed_content_kind = 'dialogue')
    OR (binding_role = 'narrator' AND allowed_content_kind = 'voice_over')
  ),
  CONSTRAINT project_voice_bindings_locale_len CHECK (char_length(locale) BETWEEN 2 AND 16),
  CONSTRAINT project_voice_bindings_status_check CHECK (
    status IN ('prepared', 'active', 'superseded', 'blocked')
  ),
  CONSTRAINT project_voice_bindings_selected_by_len CHECK (char_length(selected_by) BETWEEN 1 AND 128),
  CONSTRAINT project_voice_bindings_idempotency_len CHECK (char_length(idempotency_key) BETWEEN 8 AND 160),
  CONSTRAINT project_voice_bindings_revision_pos CHECK (revision >= 1),
  CONSTRAINT project_voice_bindings_workspace_idempotency_unique UNIQUE (workspace_id, idempotency_key)
);

CREATE UNIQUE INDEX project_voice_bindings_one_active_narrator_idx
  ON public.project_voice_bindings (
    workspace_id, project_id, script_artifact_id, script_revision
  )
  WHERE binding_role = 'narrator' AND status = 'active';

CREATE INDEX project_voice_bindings_project_role_status_idx
  ON public.project_voice_bindings (workspace_id, project_id, binding_role, status);

COMMENT ON TABLE public.project_voice_bindings IS
  'VHS-11C: explicit per-project Voice bindings. New selection = new revision. No silent overwrite.';

-- ---------------------------------------------------------------------------
-- RLS + grants (no policies → deny anon/authenticated; service_role bypasses RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.voice_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_consent_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_voice_bindings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.voice_identities,
  public.voice_consent_attestations,
  public.project_voice_bindings
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.voice_identities TO service_role;
GRANT SELECT, INSERT ON TABLE public.voice_consent_attestations TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.project_voice_bindings TO service_role;

COMMIT;
