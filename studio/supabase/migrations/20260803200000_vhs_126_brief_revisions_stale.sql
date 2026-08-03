-- VHS-126 — Brief revisions + persistent downstream stale invalidation.
-- Additive after VHS-125. No remote apply. No provider calls.
BEGIN;

-- ---------------------------------------------------------------------------
-- Stale columns on active_artifact_revisions (authoritative, queryable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.active_artifact_revisions
  ADD COLUMN IF NOT EXISTS stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stale_reason text NULL,
  ADD COLUMN IF NOT EXISTS stale_since timestamptz NULL,
  ADD COLUMN IF NOT EXISTS stale_caused_by_artifact_id uuid NULL REFERENCES public.project_artifacts (id),
  ADD COLUMN IF NOT EXISTS stale_caused_by_type text NULL,
  ADD COLUMN IF NOT EXISTS stale_source_revision integer NULL;

ALTER TABLE public.active_artifact_revisions
  DROP CONSTRAINT IF EXISTS active_artifact_revisions_stale_reason_len;
ALTER TABLE public.active_artifact_revisions
  ADD CONSTRAINT active_artifact_revisions_stale_reason_len
  CHECK (stale_reason IS NULL OR char_length(stale_reason) <= 240);

CREATE INDEX IF NOT EXISTS active_artifact_revisions_stale_idx
  ON public.active_artifact_revisions (project_id)
  WHERE stale = true;

-- ---------------------------------------------------------------------------
-- clear_active_artifact_stale — after a fresh director persist of that type
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_active_artifact_stale(
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.active_artifact_revisions
  SET
    stale = false,
    stale_reason = NULL,
    stale_since = NULL,
    stale_caused_by_artifact_id = NULL,
    stale_caused_by_type = NULL,
    stale_source_revision = NULL
  WHERE workspace_id = p_workspace_id
    AND project_id = p_project_id
    AND artifact_type = p_artifact_type;

  RETURN jsonb_build_object('status', 'cleared', 'artifact_type', p_artifact_type);
END;
$$;

-- ---------------------------------------------------------------------------
-- revise_project_brief — atomic: new rev + activate + stale cascade + audit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revise_project_brief(
  p_workspace_id uuid,
  p_project_id uuid,
  p_new_artifact_id uuid,
  p_brief jsonb,
  p_schema_version text,
  p_expected_brief_revision integer,
  p_expected_project_revision integer,
  p_idempotency_key text,
  p_command_fingerprint text,
  p_correlation_id text,
  p_created_by text,
  p_actor_type text,
  p_actor_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.video_projects%ROWTYPE;
  v_active public.active_artifact_revisions%ROWTYPE;
  v_old public.project_artifacts%ROWTYPE;
  v_existing public.project_artifacts%ROWTYPE;
  v_next_rev integer;
  v_now timestamptz := timezone('utc', now());
  v_stale_types text[] := ARRAY[]::text[];
  v_invalidated_ids uuid[] := ARRAY[]::uuid[];
  v_type text;
  v_row public.active_artifact_revisions%ROWTYPE;
  v_art public.project_artifacts%ROWTYPE;
  v_depends boolean;
  v_pipeline text[] := ARRAY[
    'marketing_plan', 'creative_concept', 'video_script', 'visual_direction',
    'storyboard_project', 'scene_package_set', 'generation_plan',
    'production_result', 'quality_report', 'merge_plan', 'export_package'
  ];
  v_active_run_id uuid;
BEGIN
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;
  IF p_command_fingerprint IS NULL OR char_length(p_command_fingerprint) < 8 THEN
    RAISE EXCEPTION 'invalid_fingerprint';
  END IF;
  IF p_correlation_id IS NULL OR char_length(p_correlation_id) < 8 THEN
    RAISE EXCEPTION 'invalid_correlation_id';
  END IF;

  -- Idempotence: same fingerprint already produced this brief revision
  SELECT * INTO v_existing
  FROM public.project_artifacts
  WHERE workspace_id = p_workspace_id
    AND project_id = p_project_id
    AND artifact_type = 'video_project_brief'
    AND value ? 'correlationId'
    AND id = p_new_artifact_id;
  IF FOUND THEN
    SELECT * INTO v_active
    FROM public.active_artifact_revisions
    WHERE project_id = p_project_id AND artifact_type = 'video_project_brief';
    RETURN jsonb_build_object(
      'status', 'existing',
      'artifact_id', v_existing.id,
      'revision', v_existing.revision,
      'project_revision', (SELECT active_revision FROM public.video_projects WHERE id = p_project_id),
      'restart_point', 'marketing_plan',
      'stale_types', COALESCE((
        SELECT jsonb_agg(artifact_type ORDER BY artifact_type)
        FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND stale = true
      ), '[]'::jsonb)
    );
  END IF;

  -- Also idempotent via audit metadata fingerprint
  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE workspace_id = p_workspace_id
      AND project_id = p_project_id
      AND action = 'director.brief.revised'
      AND metadata->>'idempotencyKey' = p_idempotency_key
      AND metadata->>'commandFingerprint' = p_command_fingerprint
  ) THEN
    SELECT * INTO v_active
    FROM public.active_artifact_revisions
    WHERE project_id = p_project_id AND artifact_type = 'video_project_brief';
    SELECT * INTO v_existing FROM public.project_artifacts WHERE id = v_active.artifact_id;
    RETURN jsonb_build_object(
      'status', 'existing',
      'artifact_id', v_existing.id,
      'revision', v_existing.revision,
      'project_revision', (SELECT active_revision FROM public.video_projects WHERE id = p_project_id),
      'restart_point', 'marketing_plan',
      'stale_types', COALESCE((
        SELECT jsonb_agg(artifact_type ORDER BY artifact_type)
        FROM public.active_artifact_revisions
        WHERE project_id = p_project_id AND stale = true
      ), '[]'::jsonb)
    );
  END IF;

  SELECT * INTO v_project
  FROM public.video_projects
  WHERE id = p_project_id AND workspace_id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
  IF v_project.active_revision IS DISTINCT FROM p_expected_project_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;

  SELECT * INTO v_active
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id
    AND project_id = p_project_id
    AND artifact_type = 'video_project_brief'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'brief_not_found'; END IF;
  IF v_active.revision IS DISTINCT FROM p_expected_brief_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;

  SELECT * INTO v_old FROM public.project_artifacts WHERE id = v_active.artifact_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'brief_not_found'; END IF;

  -- Block revise while a non-terminal production run is active
  SELECT id INTO v_active_run_id
  FROM public.production_runs
  WHERE workspace_id = p_workspace_id
    AND project_id = p_project_id
    AND status IN ('pending', 'validating', 'running', 'cancelling')
  LIMIT 1;
  IF v_active_run_id IS NOT NULL THEN
    RAISE EXCEPTION 'production_run_active';
  END IF;

  v_next_rev := v_active.revision + 1;

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version,
    parent_revision_id, value, created_at, created_by, correlation_id
  ) VALUES (
    p_new_artifact_id, p_workspace_id, p_project_id, 'video_project_brief', v_next_rev,
    p_schema_version, v_old.id, p_brief, v_now, p_created_by, p_correlation_id
  );

  UPDATE public.active_artifact_revisions
  SET
    artifact_id = p_new_artifact_id,
    revision = v_next_rev,
    updated_at = v_now,
    updated_by = p_created_by,
    stale = false,
    stale_reason = NULL,
    stale_since = NULL,
    stale_caused_by_artifact_id = NULL,
    stale_caused_by_type = NULL,
    stale_source_revision = NULL
  WHERE project_id = p_project_id AND artifact_type = 'video_project_brief';

  -- Seed invalidated ids with the replaced brief artifact id
  v_invalidated_ids := array_append(v_invalidated_ids, v_old.id);

  FOREACH v_type IN ARRAY v_pipeline LOOP
    SELECT * INTO v_row
    FROM public.active_artifact_revisions
    WHERE workspace_id = p_workspace_id
      AND project_id = p_project_id
      AND artifact_type = v_type
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_art FROM public.project_artifacts WHERE id = v_row.artifact_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Provenance-based: any referenced upstream id in the invalidated set, or
    -- quality_report soft-linked when production_result already stale.
    IF v_type = 'quality_report' THEN
      v_depends := EXISTS (
        SELECT 1 FROM public.active_artifact_revisions a
        WHERE a.project_id = p_project_id
          AND a.artifact_type = 'production_result'
          AND a.stale = true
      );
    ELSE
      v_depends := EXISTS (
        SELECT 1
        FROM unnest(v_invalidated_ids) AS u(id)
        WHERE
          v_art.value->>'briefRevisionId' = u.id::text
          OR v_art.value->>'marketingPlanRevisionId' = u.id::text
          OR v_art.value->>'creativeConceptRevisionId' = u.id::text
          OR v_art.value->>'videoScriptRevisionId' = u.id::text
          OR v_art.value->>'visualDirectionRevisionId' = u.id::text
          OR v_art.value->>'storyboardRevisionId' = u.id::text
          OR v_art.value->>'generationPlanRevisionId' = u.id::text
          OR v_art.value->>'productionResultRevisionId' = u.id::text
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(v_art.value->'scenePackageRevisionIds', '[]'::jsonb)) sp
            WHERE sp = u.id::text
          )
      )
      OR EXISTS (
        -- Also depend on already-stale actives referenced by provenance
        SELECT 1
        FROM public.active_artifact_revisions a
        WHERE a.project_id = p_project_id
          AND a.stale = true
          AND (
            a.artifact_id::text = v_art.value->>'briefRevisionId'
            OR a.artifact_id::text = v_art.value->>'marketingPlanRevisionId'
            OR a.artifact_id::text = v_art.value->>'creativeConceptRevisionId'
            OR a.artifact_id::text = v_art.value->>'videoScriptRevisionId'
            OR a.artifact_id::text = v_art.value->>'visualDirectionRevisionId'
            OR a.artifact_id::text = v_art.value->>'storyboardRevisionId'
            OR a.artifact_id::text = v_art.value->>'generationPlanRevisionId'
            OR a.artifact_id::text = v_art.value->>'productionResultRevisionId'
          )
      );
    END IF;

    IF v_depends THEN
      UPDATE public.active_artifact_revisions
      SET
        stale = true,
        stale_reason = 'upstream_brief_revised',
        stale_since = v_now,
        stale_caused_by_artifact_id = p_new_artifact_id,
        stale_caused_by_type = 'video_project_brief',
        stale_source_revision = v_next_rev
      WHERE project_id = p_project_id AND artifact_type = v_type;

      v_stale_types := array_append(v_stale_types, v_type);
      v_invalidated_ids := array_append(v_invalidated_ids, v_row.artifact_id);
    END IF;
  END LOOP;

  UPDATE public.video_projects
  SET
    active_revision = active_revision + 1,
    name = COALESCE(p_brief->>'projectName', name),
    updated_at = v_now
  WHERE id = p_project_id;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id,
    actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.brief.revised', 'video_project_brief',
    p_new_artifact_id::text, p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'previousArtifactId', v_old.id,
      'previousRevision', v_old.revision,
      'revision', v_next_rev,
      'parentRevisionId', v_old.id,
      'restartPoint', 'marketing_plan',
      'staleTypes', to_jsonb(v_stale_types),
      'idempotencyKey', p_idempotency_key,
      'commandFingerprint', p_command_fingerprint
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id,
    aggregate_revision, payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.brief.revised', 'video_project_brief',
    p_new_artifact_id::text, v_next_rev,
    jsonb_build_object(
      'previousArtifactId', v_old.id,
      'restartPoint', 'marketing_plan',
      'staleTypes', to_jsonb(v_stale_types)
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'artifact_id', p_new_artifact_id,
    'revision', v_next_rev,
    'project_revision', v_project.active_revision + 1,
    'previous_artifact_id', v_old.id,
    'previous_revision', v_old.revision,
    'restart_point', 'marketing_plan',
    'stale_types', to_jsonb(v_stale_types)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- list_project_stale_artifacts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_project_stale_artifacts(
  p_workspace_id uuid,
  p_project_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.video_projects
    WHERE id = p_project_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'artifactType', artifact_type,
        'artifactId', artifact_id,
        'revision', revision,
        'stale', stale,
        'staleReason', stale_reason,
        'staleSince', stale_since,
        'causedByArtifactId', stale_caused_by_artifact_id,
        'causedByType', stale_caused_by_type,
        'sourceRevision', stale_source_revision
      )
      ORDER BY artifact_type
    )
    FROM public.active_artifact_revisions
    WHERE workspace_id = p_workspace_id
      AND project_id = p_project_id
      AND stale = true
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.clear_active_artifact_stale(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revise_project_brief(
  uuid, uuid, uuid, jsonb, text, integer, integer, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_project_stale_artifacts(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.clear_active_artifact_stale(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revise_project_brief(
  uuid, uuid, uuid, jsonb, text, integer, integer, text, text, text, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_project_stale_artifacts(uuid, uuid) TO service_role;

COMMIT;
