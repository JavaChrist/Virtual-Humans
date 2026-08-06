/**
 * Read-only access to director_runs for text Directors (8I-B).
 * Does not begin, mutate, or enqueue runs.
 */

import {
  publicMessageForTextDirectorRun,
  type TextDirectorRunStatusPort,
  type TextDirectorRunView,
  type TextDirectorType,
} from "@/application/directors/text-run-status";
import { mapSupabaseError } from "../errors";
import type { V2DbClient } from "../supabase-server";

type Row = {
  id: string;
  director_type: string;
  status: string;
  error_code: string | null;
  output_artifact_id: string | null;
  attempt_number?: number | null;
  project_id: string;
  workspace_id: string;
};

function toView(
  row: Row,
  expectedType: TextDirectorType,
): TextDirectorRunView | null {
  if (row.director_type !== expectedType) return null;
  const errorCode = row.error_code;
  const failedTerminal =
    row.status === "failed" ||
    row.status === "cancelled" ||
    row.status === "needs_input";
  return {
    directorRunId: row.id,
    directorType: expectedType,
    status: row.status,
    errorCode,
    publicMessage: failedTerminal
      ? publicMessageForTextDirectorRun(expectedType, errorCode)
      : null,
    outputArtifactId: row.output_artifact_id,
    attemptNumber: row.attempt_number ?? null,
  };
}

export function createSupabaseTextDirectorRunStatusPort(deps: {
  client: V2DbClient;
  workspaceId: string;
}): TextDirectorRunStatusPort {
  const { client, workspaceId } = deps;

  return {
    async findActiveRun({ projectId, directorType }) {
      const { data, error } = await client
        .from("director_runs" as never)
        .select(
          "id, director_type, status, error_code, output_artifact_id, attempt_number, project_id, workspace_id",
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("director_type", directorType)
        .in("status", ["pending", "reserved", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      return toView(data as Row, directorType);
    },

    async loadRun({ projectId, directorRunId, directorType }) {
      const { data, error } = await client
        .from("director_runs" as never)
        .select(
          "id, director_type, status, error_code, output_artifact_id, attempt_number, project_id, workspace_id",
        )
        .eq("workspace_id", workspaceId)
        .eq("project_id", projectId)
        .eq("id", directorRunId)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) return null;
      return toView(data as Row, directorType);
    },
  };
}
