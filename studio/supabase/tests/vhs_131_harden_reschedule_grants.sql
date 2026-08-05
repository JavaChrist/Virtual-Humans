-- VHS-131 — reschedule_production_job grants (pgTAP). Porte 7G-B.

BEGIN;
SELECT plan(5);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.reschedule_production_job(uuid,uuid,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  'auth no execute reschedule'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.reschedule_production_job(uuid,uuid,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  'anon no execute reschedule'
);

SELECT ok(
  NOT has_function_privilege(
    'public',
    'public.reschedule_production_job(uuid,uuid,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  'PUBLIC no execute reschedule'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.reschedule_production_job(uuid,uuid,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  'service_role execute reschedule'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reschedule_production_job'
   LIMIT 1),
  'reschedule remains SECURITY DEFINER'
);

SELECT * FROM finish();
ROLLBACK;
