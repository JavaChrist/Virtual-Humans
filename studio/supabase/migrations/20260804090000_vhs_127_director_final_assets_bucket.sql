-- VHS-127 / Porte 1 — private Storage bucket for Director final media.
-- Idempotent. Never touches product-screens. Never deletes objects.
-- Access: service_role via server AssetContentPort only; anon has no policies.

BEGIN;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'director-final-assets',
  'director-final-assets',
  false,
  52428800, -- 50 MiB — aligned with DOWNLOAD_MAX_BYTES
  ARRAY[
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  name = EXCLUDED.name;

-- Ensure no accidental public exposure.
UPDATE storage.buckets
SET public = false
WHERE id = 'director-final-assets';

-- Drop any previously misconfigured open policies on this bucket (idempotent).
DROP POLICY IF EXISTS "director_final_assets_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "director_final_assets_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "director_final_assets_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "director_final_assets_anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "director_final_assets_authenticated_all" ON storage.objects;
DROP POLICY IF EXISTS "director_final_assets_public_read" ON storage.objects;

-- Explicit deny-style: no GRANT to anon/authenticated on objects for this bucket.
-- service_role bypasses RLS and is used exclusively by the server adapter.
-- (Absence of permissive policies is the security boundary for anon.)

COMMIT;
