-- VHS-116 — Atomic create project + video_project_brief rev 1 + active pointer + audit + outbox.
-- Local only until explicit remote apply authorization.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_director_project_with_brief(
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_id uuid,
  p_project_name text,
  p_brief jsonb,
  p_schema_version text,
  p_correlation_id text,
  p_actor_type text,
  p_actor_id text,
  p_created_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_ws public.workspaces%ROWTYPE;
  v_existing public.video_projects%ROWTYPE;
  v_art public.project_artifacts%ROWTYPE;
  v_result jsonb;
  v_business_existing jsonb;
  v_business_incoming jsonb;
BEGIN
  IF p_workspace_id IS NULL OR p_project_id IS NULL OR p_artifact_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF p_project_name IS NULL OR char_length(trim(p_project_name)) < 1 OR char_length(p_project_name) > 160 THEN
    RAISE EXCEPTION 'invalid_project_name';
  END IF;
  IF p_brief IS NULL OR jsonb_typeof(p_brief) <> 'object' THEN
    RAISE EXCEPTION 'invalid_brief';
  END IF;
  IF p_schema_version IS NULL OR char_length(p_schema_version) < 1 THEN
    RAISE EXCEPTION 'invalid_schema_version';
  END IF;
  IF p_correlation_id IS NULL OR char_length(p_correlation_id) < 8 OR char_length(p_correlation_id) > 128 THEN
    RAISE EXCEPTION 'invalid_correlation_id';
  END IF;
  IF p_actor_type IS DISTINCT FROM 'shared_password' AND p_actor_type IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'invalid_actor_type';
  END IF;
  IF p_actor_id IS NULL OR char_length(p_actor_id) < 1 OR char_length(p_actor_id) > 120 THEN
    RAISE EXCEPTION 'invalid_actor_id';
  END IF;
  IF p_created_by IS NULL OR char_length(p_created_by) < 1 OR char_length(p_created_by) > 120 THEN
    RAISE EXCEPTION 'invalid_created_by';
  END IF;

  SELECT * INTO v_ws FROM public.workspaces WHERE id = p_workspace_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- Business payload only (ignore volatile artifact metadata for idempotence).
  v_business_incoming := COALESCE(p_brief, '{}'::jsonb)
    - 'id' - 'projectId' - 'createdAt' - 'createdBy'
    - 'correlationId' - 'revision' - 'schemaVersion';

  -- Retry loop for concurrent create on the same project_id.
  FOR i IN 1..3 LOOP
    SELECT * INTO v_existing FROM public.video_projects WHERE id = p_project_id FOR UPDATE;
    IF FOUND THEN
      IF v_existing.workspace_id IS DISTINCT FROM p_workspace_id THEN
        RAISE EXCEPTION 'workspace_mismatch';
      END IF;
      SELECT * INTO v_art
      FROM public.project_artifacts
      WHERE project_id = p_project_id
        AND artifact_type = 'video_project_brief'
        AND revision = 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'project_exists_without_brief';
      END IF;
      v_business_existing := COALESCE(v_art.value, '{}'::jsonb)
        - 'id' - 'projectId' - 'createdAt' - 'createdBy'
        - 'correlationId' - 'revision' - 'schemaVersion';
      IF v_business_existing IS NOT DISTINCT FROM v_business_incoming THEN
        RETURN jsonb_build_object(
          'status', 'existing',
          'project_id', v_existing.id,
          'artifact_id', v_art.id,
          'revision', 1,
          'created_at', v_existing.created_at,
          'updated_at', v_existing.updated_at
        );
      END IF;
      RAISE EXCEPTION 'project_brief_conflict';
    END IF;

    BEGIN
      INSERT INTO public.video_projects (
        id, workspace_id, name, status, active_revision, schema_version,
        created_at, updated_at, correlation_id
      ) VALUES (
        p_project_id, p_workspace_id, trim(p_project_name), 'draft', 1, p_schema_version,
        v_now, v_now, p_correlation_id
      );

      INSERT INTO public.project_artifacts (
        id, workspace_id, project_id, artifact_type, revision, schema_version,
        parent_revision_id, value, created_at, created_by, correlation_id
      ) VALUES (
        p_artifact_id, p_workspace_id, p_project_id, 'video_project_brief', 1, p_schema_version,
        NULL, p_brief, v_now, p_created_by, p_correlation_id
      );

      INSERT INTO public.active_artifact_revisions (
        workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
      ) VALUES (
        p_workspace_id, p_project_id, 'video_project_brief', p_artifact_id, 1, v_now, p_created_by
      );

      INSERT INTO public.audit_log (
        workspace_id, project_id, action, resource_type, resource_id,
        actor_type, actor_id, correlation_id, metadata, created_at
      ) VALUES (
        p_workspace_id, p_project_id, 'director.project.created', 'video_project', p_project_id::text,
        p_actor_type, p_actor_id, p_correlation_id,
        jsonb_build_object('artifactId', p_artifact_id, 'artifactType', 'video_project_brief', 'revision', 1),
        v_now
      );

      INSERT INTO public.domain_events (
        workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id,
        aggregate_revision, payload, correlation_id, created_at
      ) VALUES (
        p_workspace_id, p_project_id, NULL, 'director.project.created', 'video_project', p_project_id::text,
        1,
        jsonb_build_object(
          'projectId', p_project_id,
          'artifactId', p_artifact_id,
          'artifactType', 'video_project_brief',
          'revision', 1
        ),
        p_correlation_id,
        v_now
      );

      RETURN jsonb_build_object(
        'status', 'created',
        'project_id', p_project_id,
        'artifact_id', p_artifact_id,
        'revision', 1,
        'created_at', v_now,
        'updated_at', v_now
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- Concurrent creator won — loop and treat as existing/conflict.
        NULL;
    END;
  END LOOP;

  RAISE EXCEPTION 'create_project_race';
END;
$$;

REVOKE ALL ON FUNCTION public.create_director_project_with_brief(
  uuid, uuid, uuid, text, jsonb, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_director_project_with_brief(
  uuid, uuid, uuid, text, jsonb, text, text, text, text, text
) TO service_role;

COMMIT;
