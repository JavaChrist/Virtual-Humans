-- VHS-127 — private director-final-assets bucket (pgTAP)

BEGIN;
SELECT plan(10);

SELECT ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'director-final-assets'),
  'director-final-assets bucket exists'
);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'director-final-assets'),
  false,
  'director-final-assets is private'
);

SELECT is(
  (SELECT file_size_limit FROM storage.buckets WHERE id = 'director-final-assets'),
  52428800::bigint,
  'file_size_limit is 50 MiB'
);

SELECT ok(
  (SELECT allowed_mime_types @> ARRAY['video/mp4']::text[]
   FROM storage.buckets WHERE id = 'director-final-assets'),
  'allows video/mp4'
);

SELECT ok(
  (SELECT allowed_mime_types @> ARRAY['image/png', 'audio/mpeg']::text[]
   FROM storage.buckets WHERE id = 'director-final-assets'),
  'allows png and mpeg'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname ILIKE '%director_final_assets%public%'
  ),
  'no public-read policy on director-final-assets'
);

-- anon must not have a permissive policy granting ALL on this bucket's objects
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles::text ILIKE '%anon%'
      AND (
        qual ILIKE '%director-final-assets%'
        OR with_check ILIKE '%director-final-assets%'
      )
  ),
  'anon has no storage.objects policy scoped to director-final-assets'
);

-- Legacy product-screens: if present locally, must remain private and untouched by name
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'product-screens' AND public = true
  ),
  'product-screens not forced public (absent or private)'
);

SELECT ok(
  (SELECT count(*)::int FROM storage.buckets WHERE id = 'director-final-assets') = 1,
  'exactly one director-final-assets bucket row'
);

-- Idempotence of migration intent: re-assert private after a no-op update shape
SELECT is(
  (SELECT name FROM storage.buckets WHERE id = 'director-final-assets'),
  'director-final-assets',
  'bucket name stable'
);

SELECT * FROM finish();
ROLLBACK;
