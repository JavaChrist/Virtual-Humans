-- MT-005 — Extend human_review_decisions.decision for Motion Transfer retry intents.
-- Additive / local-only. NOT applied to Production in this ticket.
-- Column is `decision` (not status). Reuses persist_human_review_decision RPC.
-- No new tables. No Storage bucket. service_role grants unchanged.

BEGIN;

ALTER TABLE public.human_review_decisions
  DROP CONSTRAINT IF EXISTS human_review_decisions_decision_check;

ALTER TABLE public.human_review_decisions
  ADD CONSTRAINT human_review_decisions_decision_check CHECK (
    decision IN (
      'approved',
      'rejected',
      'retry_same_reference',
      'retry_updated_constraints',
      'request_new_reference'
    )
  );

COMMENT ON CONSTRAINT human_review_decisions_decision_check ON public.human_review_decisions IS
  'MT-005: approved|rejected plus Motion retry intents (retry_same_reference, retry_updated_constraints, request_new_reference).';

-- Recreate RPC with expanded allowlist (body otherwise identical to VHS-125).
CREATE OR REPLACE FUNCTION public.persist_human_review_decision(
  p_id uuid,
  p_workspace_id uuid,
  p_project_id uuid,
  p_quality_report_artifact_id uuid,
  p_quality_report_revision integer,
  p_production_result_artifact_id uuid,
  p_production_result_revision integer,
  p_decision text,
  p_comment text,
  p_reviewed_issue_codes jsonb,
  p_idempotency_key text,
  p_correlation_id text,
  p_actor_type text,
  p_actor_id text,
  p_updated_production_result jsonb,
  p_production_result_new_id uuid,
  p_expected_production_result_revision integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.human_review_decisions%ROWTYPE;
  v_active_qr public.active_artifact_revisions%ROWTYPE;
  v_active_pr public.active_artifact_revisions%ROWTYPE;
  v_pr_next_rev integer;
  v_now timestamptz := timezone('utc', now());
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN (
    'approved',
    'rejected',
    'retry_same_reference',
    'retry_updated_constraints',
    'request_new_reference'
  ) THEN
    RAISE EXCEPTION 'invalid_review_decision';
  END IF;
  IF p_comment IS NOT NULL AND char_length(p_comment) > 2000 THEN
    RAISE EXCEPTION 'invalid_comment';
  END IF;
  IF p_updated_production_result IS NULL OR jsonb_typeof(p_updated_production_result) <> 'object' THEN
    RAISE EXCEPTION 'invalid_production_result';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.human_review_decisions
    WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', 'existing',
        'decision_id', v_existing.id,
        'production_result_artifact_id', v_existing.production_result_artifact_id,
        'production_result_revision', v_existing.production_result_revision
      );
    END IF;
  END IF;

  SELECT * INTO v_active_qr
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'quality_report';
  IF NOT FOUND
     OR v_active_qr.artifact_id IS DISTINCT FROM p_quality_report_artifact_id
     OR v_active_qr.revision IS DISTINCT FROM p_quality_report_revision THEN
    RAISE EXCEPTION 'quality_report_not_active';
  END IF;

  SELECT * INTO v_active_pr
  FROM public.active_artifact_revisions
  WHERE workspace_id = p_workspace_id AND project_id = p_project_id AND artifact_type = 'production_result'
  FOR UPDATE;
  IF NOT FOUND
     OR v_active_pr.artifact_id IS DISTINCT FROM p_production_result_artifact_id
     OR v_active_pr.revision IS DISTINCT FROM p_expected_production_result_revision
     OR v_active_pr.revision IS DISTINCT FROM p_production_result_revision THEN
    RAISE EXCEPTION 'optimistic_conflict';
  END IF;

  INSERT INTO public.human_review_decisions (
    id, workspace_id, project_id, quality_report_artifact_id, quality_report_revision,
    production_result_artifact_id, production_result_revision, decision, comment,
    reviewed_issue_codes, actor_type, actor_id, correlation_id, idempotency_key, created_at
  ) VALUES (
    p_id, p_workspace_id, p_project_id, p_quality_report_artifact_id, p_quality_report_revision,
    p_production_result_artifact_id, p_production_result_revision, p_decision, p_comment,
    COALESCE(p_reviewed_issue_codes, '[]'::jsonb), p_actor_type, p_actor_id, p_correlation_id,
    p_idempotency_key, v_now
  );

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_pr_next_rev
  FROM public.project_artifacts WHERE project_id = p_project_id AND artifact_type = 'production_result';

  INSERT INTO public.project_artifacts (
    id, workspace_id, project_id, artifact_type, revision, schema_version, value,
    parent_revision_id, created_at, created_by, correlation_id
  ) VALUES (
    p_production_result_new_id, p_workspace_id, p_project_id, 'production_result', v_pr_next_rev,
    COALESCE(p_updated_production_result->>'schemaVersion', '1.1.0'), p_updated_production_result,
    p_production_result_artifact_id, v_now, p_actor_id, p_correlation_id
  );

  INSERT INTO public.active_artifact_revisions (
    workspace_id, project_id, artifact_type, artifact_id, revision, updated_at, updated_by
  ) VALUES (
    p_workspace_id, p_project_id, 'production_result', p_production_result_new_id, v_pr_next_rev, v_now, p_actor_id
  )
  ON CONFLICT (project_id, artifact_type) DO UPDATE SET
    artifact_id = EXCLUDED.artifact_id, revision = EXCLUDED.revision,
    updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

  INSERT INTO public.audit_log (
    workspace_id, project_id, action, resource_type, resource_id, actor_type, actor_id, correlation_id, metadata, created_at
  ) VALUES (
    p_workspace_id, p_project_id, 'director.quality.review_recorded', 'human_review_decision', p_id::text,
    p_actor_type, p_actor_id, p_correlation_id,
    jsonb_build_object(
      'decisionId', p_id, 'decision', p_decision,
      'qualityReportRevision', p_quality_report_revision, 'productionResultRevision', v_pr_next_rev
    ),
    v_now
  );

  INSERT INTO public.domain_events (
    workspace_id, project_id, run_id, event_type, aggregate_type, aggregate_id, aggregate_revision,
    payload, correlation_id, created_at
  ) VALUES (
    p_workspace_id, p_project_id, NULL, 'director.quality.review_recorded', 'human_review_decision', p_id::text, 1,
    jsonb_build_object(
      'projectId', p_project_id, 'decisionId', p_id, 'decision', p_decision,
      'productionResultArtifactId', p_production_result_new_id, 'productionResultRevision', v_pr_next_rev
    ),
    p_correlation_id, v_now
  );

  RETURN jsonb_build_object(
    'status', 'created',
    'decision_id', p_id,
    'production_result_artifact_id', p_production_result_new_id,
    'production_result_revision', v_pr_next_rev
  );
END;
$$;

COMMENT ON FUNCTION public.persist_human_review_decision(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, jsonb, text, text, text, text, jsonb, uuid, integer
) IS
  'MT-005: persist append-only human review; decision allowlist includes Motion retry intents.';

REVOKE ALL ON FUNCTION public.persist_human_review_decision(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, jsonb, text, text, text, text, jsonb, uuid, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.persist_human_review_decision(
  uuid, uuid, uuid, uuid, integer, uuid, integer, text, text, jsonb, text, text, text, text, jsonb, uuid, integer
) TO service_role;

COMMIT;
