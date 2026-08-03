-- VHS-113 — Persistence V2 core (additive).
-- Does NOT recreate or alter vh_spend / vh_products / vh_scenes.
-- RLS: enabled, no anon/authenticated policies (server/service_role only).

BEGIN;

-- ---------------------------------------------------------------------------
-- Workspaces (single_workspace pilot)
-- ---------------------------------------------------------------------------
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'single_workspace',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT workspaces_slug_unique UNIQUE (slug),
  CONSTRAINT workspaces_slug_len CHECK (char_length(slug) BETWEEN 1 AND 64),
  CONSTRAINT workspaces_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT workspaces_mode_check CHECK (mode = 'single_workspace')
);

CREATE TABLE public.workspace_budget_policies (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id),
  hard_limit_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT workspace_budget_hard_limit_nonneg CHECK (hard_limit_minor >= 0),
  CONSTRAINT workspace_budget_currency_len CHECK (char_length(currency) = 3)
);

-- ---------------------------------------------------------------------------
-- video_projects
-- ---------------------------------------------------------------------------
CREATE TABLE public.video_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  name text NOT NULL,
  status text NOT NULL,
  active_revision integer NOT NULL DEFAULT 1,
  schema_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  archived_at timestamptz NULL,
  correlation_id text NOT NULL,
  CONSTRAINT video_projects_name_len CHECK (char_length(name) BETWEEN 1 AND 160),
  CONSTRAINT video_projects_active_revision_pos CHECK (active_revision >= 1),
  CONSTRAINT video_projects_status_check CHECK (
    status IN (
      'draft', 'planning', 'awaiting_approval', 'approved',
      'producing', 'completed', 'failed', 'cancelled', 'archived'
    )
  ),
  CONSTRAINT video_projects_correlation_len CHECK (char_length(correlation_id) BETWEEN 8 AND 128)
);

CREATE INDEX video_projects_workspace_status_updated_idx
  ON public.video_projects (workspace_id, status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- project_artifacts (append-only by policy; no UPDATE of value)
-- ---------------------------------------------------------------------------
CREATE TABLE public.project_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  artifact_type text NOT NULL,
  revision integer NOT NULL,
  schema_version text NOT NULL,
  parent_revision_id uuid NULL REFERENCES public.project_artifacts (id),
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by text NOT NULL,
  correlation_id text NOT NULL,
  CONSTRAINT project_artifacts_revision_pos CHECK (revision >= 1),
  CONSTRAINT project_artifacts_type_check CHECK (
    artifact_type IN (
      'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
      'visual_direction', 'storyboard_project', 'scene_package',
      'generation_plan', 'production_result'
    )
  ),
  CONSTRAINT project_artifacts_unique_rev UNIQUE (project_id, artifact_type, revision),
  CONSTRAINT project_artifacts_created_by_len CHECK (char_length(created_by) BETWEEN 1 AND 120),
  CONSTRAINT project_artifacts_correlation_len CHECK (char_length(correlation_id) BETWEEN 8 AND 128)
);

CREATE INDEX project_artifacts_project_type_rev_idx
  ON public.project_artifacts (project_id, artifact_type, revision DESC);

-- Prevent UPDATE of historical value / identity columns
CREATE OR REPLACE FUNCTION public.prevent_project_artifact_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.artifact_type IS DISTINCT FROM OLD.artifact_type
      OR NEW.revision IS DISTINCT FROM OLD.revision
      OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
      OR NEW.parent_revision_id IS DISTINCT FROM OLD.parent_revision_id
      OR NEW.value IS DISTINCT FROM OLD.value
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
    THEN
      RAISE EXCEPTION 'project_artifacts are append-only';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'project_artifacts deletes are not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_artifacts_append_only
  BEFORE UPDATE OR DELETE ON public.project_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_project_artifact_mutation();

-- ---------------------------------------------------------------------------
-- active_artifact_revisions
-- ---------------------------------------------------------------------------
CREATE TABLE public.active_artifact_revisions (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  artifact_type text NOT NULL,
  artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  revision integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by text NOT NULL,
  PRIMARY KEY (project_id, artifact_type),
  CONSTRAINT active_artifact_revisions_revision_pos CHECK (revision >= 1),
  CONSTRAINT active_artifact_revisions_type_check CHECK (
    artifact_type IN (
      'video_project_brief', 'marketing_plan', 'creative_concept', 'video_script',
      'visual_direction', 'storyboard_project', 'scene_package',
      'generation_plan', 'production_result'
    )
  )
);

CREATE OR REPLACE FUNCTION public.set_active_artifact_revision(
  p_workspace_id uuid,
  p_project_id uuid,
  p_artifact_type text,
  p_artifact_id uuid,
  p_expected_revision integer,
  p_updated_by text
)
RETURNS public.active_artifact_revisions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_art public.project_artifacts%ROWTYPE;
  v_row public.active_artifact_revisions%ROWTYPE;
  v_current integer;
BEGIN
  SELECT * INTO v_art
  FROM public.project_artifacts
  WHERE id = p_artifact_id
    AND workspace_id = p_workspace_id
    AND project_id = p_project_id
    AND artifact_type = p_artifact_type
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'artifact_not_found';
  END IF;

  SELECT revision INTO v_current
  FROM public.active_artifact_revisions
  WHERE project_id = p_project_id AND artifact_type = p_artifact_type
  FOR UPDATE;

  IF FOUND THEN
    IF v_current IS DISTINCT FROM p_expected_revision THEN
      RAISE EXCEPTION 'optimistic_conflict';
    END IF;
    UPDATE public.active_artifact_revisions
    SET artifact_id = p_artifact_id,
        revision = v_art.revision,
        updated_at = timezone('utc', now()),
        updated_by = p_updated_by
    WHERE project_id = p_project_id AND artifact_type = p_artifact_type
    RETURNING * INTO v_row;
  ELSE
    IF p_expected_revision IS DISTINCT FROM 0 THEN
      RAISE EXCEPTION 'optimistic_conflict';
    END IF;
    INSERT INTO public.active_artifact_revisions (
      workspace_id, project_id, artifact_type, artifact_id, revision, updated_by
    ) VALUES (
      p_workspace_id, p_project_id, p_artifact_type, p_artifact_id, v_art.revision, p_updated_by
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- artifact_approvals (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.artifact_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  artifact_type text NOT NULL,
  artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  revision integer NOT NULL,
  status text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  decided_by text NOT NULL,
  comment text NULL,
  CONSTRAINT artifact_approvals_status_check CHECK (status IN ('approved', 'rejected')),
  CONSTRAINT artifact_approvals_revision_pos CHECK (revision >= 1),
  CONSTRAINT artifact_approvals_comment_len CHECK (comment IS NULL OR char_length(comment) <= 2000)
);

CREATE INDEX artifact_approvals_project_type_rev_idx
  ON public.artifact_approvals (project_id, artifact_type, revision DESC);

CREATE OR REPLACE FUNCTION public.prevent_artifact_approvals_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'artifact_approvals are append-only';
END;
$$;

CREATE TRIGGER artifact_approvals_append_only
  BEFORE UPDATE OR DELETE ON public.artifact_approvals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_artifact_approvals_mutation();

-- ---------------------------------------------------------------------------
-- storyboard_scenes (projection)
-- ---------------------------------------------------------------------------
CREATE TABLE public.storyboard_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  storyboard_artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  storyboard_revision integer NOT NULL,
  scene_id text NOT NULL,
  scene_order integer NOT NULL,
  purpose text NOT NULL,
  duration_seconds numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  projection_version text NOT NULL DEFAULT '1.0.0',
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT storyboard_scenes_unique UNIQUE (project_id, storyboard_revision, scene_id),
  CONSTRAINT storyboard_scenes_order_pos CHECK (scene_order >= 1),
  CONSTRAINT storyboard_scenes_duration_pos CHECK (duration_seconds > 0)
);

CREATE INDEX storyboard_scenes_project_order_idx
  ON public.storyboard_scenes (project_id, storyboard_revision, scene_order);

-- ---------------------------------------------------------------------------
-- generation_plans (operational projection)
-- ---------------------------------------------------------------------------
CREATE TABLE public.generation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id),
  project_id uuid NOT NULL REFERENCES public.video_projects (id),
  artifact_id uuid NOT NULL REFERENCES public.project_artifacts (id),
  revision integer NOT NULL,
  registry_version text NOT NULL,
  policy_version text NOT NULL,
  status text NOT NULL,
  estimated_cost_minor bigint NOT NULL,
  maximum_exposure_minor bigint NOT NULL,
  currency text NOT NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT generation_plans_costs_nonneg CHECK (
    estimated_cost_minor >= 0 AND maximum_exposure_minor >= 0
  ),
  CONSTRAINT generation_plans_revision_pos CHECK (revision >= 1)
);

CREATE INDEX generation_plans_project_status_idx
  ON public.generation_plans (project_id, status);

COMMIT;
