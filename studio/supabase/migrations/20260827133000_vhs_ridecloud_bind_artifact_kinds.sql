-- RideCloud bind artifact kinds — local only. NOT applied to Production in this phase.
-- Additive CHECK expansion on public.project_artifacts.
-- Does not expand active_artifact_revisions: bind kinds must remain inactive.
-- Schema only: no DML, RPC, grants, RLS, Storage, budget, flags, or artifacts.

BEGIN;

DO $$
DECLARE
  v_def text;
  v_has_brief boolean;
  v_has_contract boolean;
  v_has_manifest boolean;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'project_artifacts'
    AND c.conname = 'project_artifacts_type_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'project_artifacts_type_check_missing';
  END IF;

  v_has_brief := position('video_project_brief' in v_def) > 0
    AND position('export_package' in v_def) > 0;
  v_has_contract := position('storyboard_contract' in v_def) > 0;
  v_has_manifest := position('media_input_manifest' in v_def) > 0;

  IF NOT v_has_brief THEN
    RAISE EXCEPTION 'project_artifacts_type_check_historical_kinds_missing';
  END IF;

  IF v_has_contract AND v_has_manifest THEN
    RETURN;
  END IF;

  IF v_has_contract OR v_has_manifest THEN
    RAISE EXCEPTION 'project_artifacts_type_check_partial_bind_kinds';
  END IF;

  -- Same transaction: ACCESS EXCLUSIVE lock, no permissive window, no deferred validation.
  ALTER TABLE public.project_artifacts
    DROP CONSTRAINT project_artifacts_type_check;

  ALTER TABLE public.project_artifacts
    ADD CONSTRAINT project_artifacts_type_check
    CHECK (
      artifact_type IN (
        'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
        'visual_direction', 'storyboard_project', 'scene_package', 'scene_package_set',
        'generation_plan', 'production_result',
        'quality_report', 'merge_plan', 'export_package',
        'storyboard_contract', 'media_input_manifest'
      )
    );
END $$;

COMMIT;
