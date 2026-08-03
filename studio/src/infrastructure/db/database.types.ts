/**
 * Generated from local Supabase schema (VHS-115).
 * Reproduce:
 *   npx supabase gen types typescript --local > src/infrastructure/db/database.types.ts
 * Never point this command at a remote project.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      active_artifact_revisions: {
        Row: {
          artifact_id: string
          artifact_type: string
          project_id: string
          revision: number
          updated_at: string
          updated_by: string
          workspace_id: string
        }
        Insert: {
          artifact_id: string
          artifact_type: string
          project_id: string
          revision: number
          updated_at?: string
          updated_by: string
          workspace_id: string
        }
        Update: {
          artifact_id?: string
          artifact_type?: string
          project_id?: string
          revision?: number
          updated_at?: string
          updated_by?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_artifact_revisions_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "project_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_artifact_revisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_artifact_revisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      artifact_approvals: {
        Row: {
          artifact_id: string
          artifact_type: string
          comment: string | null
          decided_at: string
          decided_by: string
          id: string
          project_id: string
          revision: number
          status: string
          workspace_id: string
        }
        Insert: {
          artifact_id: string
          artifact_type: string
          comment?: string | null
          decided_at?: string
          decided_by: string
          id?: string
          project_id: string
          revision: number
          status: string
          workspace_id: string
        }
        Update: {
          artifact_id?: string
          artifact_type?: string
          comment?: string | null
          decided_at?: string
          decided_by?: string
          id?: string
          project_id?: string
          revision?: number
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_approvals_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "project_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifact_approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          checksum: string | null
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          external_job_id: string | null
          height: number | null
          id: string
          kind: string
          mime_type: string
          project_id: string
          provenance: Json
          run_id: string | null
          scene_id: string | null
          size_bytes: number | null
          source_kind: string
          source_provider: string | null
          status: string
          step_id: string | null
          storage_bucket: string | null
          storage_path: string | null
          width: number | null
          workspace_id: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          external_job_id?: string | null
          height?: number | null
          id?: string
          kind: string
          mime_type: string
          project_id: string
          provenance?: Json
          run_id?: string | null
          scene_id?: string | null
          size_bytes?: number | null
          source_kind: string
          source_provider?: string | null
          status?: string
          step_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          width?: number | null
          workspace_id: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          external_job_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string
          project_id?: string
          provenance?: Json
          run_id?: string | null
          scene_id?: string | null
          size_bytes?: number | null
          source_kind?: string
          source_provider?: string | null
          status?: string
          step_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_type: string
          correlation_id: string
          created_at: string
          id: string
          metadata: Json
          project_id: string | null
          resource_id: string
          resource_type: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_type: string
          correlation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string | null
          resource_id: string
          resource_type: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_type?: string
          correlation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string | null
          resource_id?: string
          resource_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_reservations: {
        Row: {
          amount_minor: number
          attempt_id: string
          committed_at: string | null
          correlation_id: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          project_id: string
          released_at: string | null
          revision: number
          run_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          amount_minor: number
          attempt_id: string
          committed_at?: string | null
          correlation_id: string
          created_at?: string
          currency: string
          expires_at?: string | null
          id?: string
          project_id: string
          released_at?: string | null
          revision?: number
          run_id: string
          status: string
          workspace_id: string
        }
        Update: {
          amount_minor?: number
          attempt_id?: string
          committed_at?: string | null
          correlation_id?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          project_id?: string
          released_at?: string | null
          revision?: number
          run_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_reservations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_reservations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_ledger: {
        Row: {
          amount_minor: number
          attempt_id: string | null
          correlation_id: string
          cost_status: string
          created_at: string
          currency: string
          description_code: string
          entry_type: string
          estimate_id: string | null
          id: string
          idempotency_key: string
          model_id: string | null
          project_id: string
          provider_id: string | null
          reservation_id: string | null
          run_id: string | null
          scene_id: string | null
          step_id: string | null
          workspace_id: string
        }
        Insert: {
          amount_minor: number
          attempt_id?: string | null
          correlation_id: string
          cost_status: string
          created_at?: string
          currency: string
          description_code: string
          entry_type: string
          estimate_id?: string | null
          id?: string
          idempotency_key: string
          model_id?: string | null
          project_id: string
          provider_id?: string | null
          reservation_id?: string | null
          run_id?: string | null
          scene_id?: string | null
          step_id?: string | null
          workspace_id: string
        }
        Update: {
          amount_minor?: number
          attempt_id?: string | null
          correlation_id?: string
          cost_status?: string
          created_at?: string
          currency?: string
          description_code?: string
          entry_type?: string
          estimate_id?: string | null
          id?: string
          idempotency_key?: string
          model_id?: string | null
          project_id?: string
          provider_id?: string | null
          reservation_id?: string | null
          run_id?: string | null
          scene_id?: string | null
          step_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_ledger_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_ledger_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          aggregate_id: string
          aggregate_revision: number
          aggregate_type: string
          correlation_id: string
          created_at: string
          event_type: string
          id: string
          last_error_code: string | null
          payload: Json
          project_id: string
          publish_attempts: number
          published_at: string | null
          run_id: string | null
          workspace_id: string
        }
        Insert: {
          aggregate_id: string
          aggregate_revision: number
          aggregate_type: string
          correlation_id: string
          created_at?: string
          event_type: string
          id?: string
          last_error_code?: string | null
          payload?: Json
          project_id: string
          publish_attempts?: number
          published_at?: string | null
          run_id?: string | null
          workspace_id: string
        }
        Update: {
          aggregate_id?: string
          aggregate_revision?: number
          aggregate_type?: string
          correlation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          last_error_code?: string | null
          payload?: Json
          project_id?: string
          publish_attempts?: number
          published_at?: string | null
          run_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_attempts: {
        Row: {
          actual_cost_minor: number | null
          attempt_number: number
          completed_at: string | null
          cost_status: string | null
          created_at: string
          currency: string | null
          error_code: string | null
          estimate_minor: number | null
          external_job_id: string | null
          id: string
          idempotency_key: string
          kind: string
          model_id: string
          project_id: string
          provider_id: string
          retryable: boolean | null
          run_id: string
          scene_id: string
          started_at: string | null
          status: string
          step_id: string
          workspace_id: string
        }
        Insert: {
          actual_cost_minor?: number | null
          attempt_number: number
          completed_at?: string | null
          cost_status?: string | null
          created_at?: string
          currency?: string | null
          error_code?: string | null
          estimate_minor?: number | null
          external_job_id?: string | null
          id?: string
          idempotency_key: string
          kind: string
          model_id: string
          project_id: string
          provider_id: string
          retryable?: boolean | null
          run_id: string
          scene_id: string
          started_at?: string | null
          status: string
          step_id: string
          workspace_id: string
        }
        Update: {
          actual_cost_minor?: number | null
          attempt_number?: number
          completed_at?: string | null
          cost_status?: string | null
          created_at?: string
          currency?: string | null
          error_code?: string | null
          estimate_minor?: number | null
          external_job_id?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          model_id?: string
          project_id?: string
          provider_id?: string
          retryable?: boolean | null
          run_id?: string
          scene_id?: string
          started_at?: string | null
          status?: string
          step_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_attempts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_attempts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_attempts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_plans: {
        Row: {
          approved_at: string | null
          artifact_id: string
          created_at: string
          currency: string
          estimated_cost_minor: number
          id: string
          maximum_exposure_minor: number
          policy_version: string
          project_id: string
          registry_version: string
          revision: number
          status: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          artifact_id: string
          created_at?: string
          currency: string
          estimated_cost_minor: number
          id?: string
          maximum_exposure_minor: number
          policy_version: string
          project_id: string
          registry_version: string
          revision: number
          status: string
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          artifact_id?: string
          created_at?: string
          currency?: string
          estimated_cost_minor?: number
          id?: string
          maximum_exposure_minor?: number
          policy_version?: string
          project_id?: string
          registry_version?: string
          revision?: number
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_plans_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "project_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          command_fingerprint: string
          created_at: string
          error: Json | null
          expires_at: string | null
          key: string
          project_id: string
          result: Json | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          command_fingerprint: string
          created_at?: string
          error?: Json | null
          expires_at?: string | null
          key: string
          project_id: string
          result?: Json | null
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          command_fingerprint?: string
          created_at?: string
          error?: Json | null
          expires_at?: string | null
          key?: string
          project_id?: string
          result?: Json | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idempotency_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      production_jobs: {
        Row: {
          action: string
          attempt_count: number
          attempt_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          error: Json | null
          external_job_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          model_id: string
          payload: Json
          priority: number
          project_id: string
          provider_id: string
          result: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action: string
          attempt_count?: number
          attempt_id: string
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          external_job_id?: string | null
          heartbeat_at?: string | null
          id?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          leased_at?: string | null
          leased_by?: string | null
          max_attempts?: number
          model_id: string
          payload?: Json
          priority?: number
          project_id: string
          provider_id: string
          result?: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: string
          attempt_count?: number
          attempt_id?: string
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          external_job_id?: string | null
          heartbeat_at?: string | null
          id?: string
          lease_expires_at?: string | null
          lease_token?: string | null
          leased_at?: string | null
          leased_by?: string | null
          max_attempts?: number
          model_id?: string
          payload?: Json
          priority?: number
          project_id?: string
          provider_id?: string
          result?: Json | null
          run_id?: string
          scene_id?: string
          status?: string
          step_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      production_runs: {
        Row: {
          cancellation_requested_at: string | null
          committed_cost_minor: number
          completed_at: string | null
          correlation_id: string
          created_at: string
          currency: string
          estimated_cost_minor: number
          generation_plan_artifact_id: string
          generation_plan_revision: number
          id: string
          policy_version: string
          project_id: string
          released_cost_minor: number
          revision: number
          state: Json
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cancellation_requested_at?: string | null
          committed_cost_minor?: number
          completed_at?: string | null
          correlation_id: string
          created_at?: string
          currency: string
          estimated_cost_minor?: number
          generation_plan_artifact_id: string
          generation_plan_revision: number
          id?: string
          policy_version: string
          project_id: string
          released_cost_minor?: number
          revision?: number
          state: Json
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cancellation_requested_at?: string | null
          committed_cost_minor?: number
          completed_at?: string | null
          correlation_id?: string
          created_at?: string
          currency?: string
          estimated_cost_minor?: number
          generation_plan_artifact_id?: string
          generation_plan_revision?: number
          id?: string
          policy_version?: string
          project_id?: string
          released_cost_minor?: number
          revision?: number
          state?: Json
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_runs_generation_plan_artifact_id_fkey"
            columns: ["generation_plan_artifact_id"]
            isOneToOne: false
            referencedRelation: "project_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_artifacts: {
        Row: {
          artifact_type: string
          correlation_id: string
          created_at: string
          created_by: string
          id: string
          parent_revision_id: string | null
          project_id: string
          revision: number
          schema_version: string
          value: Json
          workspace_id: string
        }
        Insert: {
          artifact_type: string
          correlation_id: string
          created_at?: string
          created_by: string
          id?: string
          parent_revision_id?: string | null
          project_id: string
          revision: number
          schema_version: string
          value: Json
          workspace_id: string
        }
        Update: {
          artifact_type?: string
          correlation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          parent_revision_id?: string | null
          project_id?: string
          revision?: number
          schema_version?: string
          value?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_artifacts_parent_revision_id_fkey"
            columns: ["parent_revision_id"]
            isOneToOne: false
            referencedRelation: "project_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_artifacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      storyboard_scenes: {
        Row: {
          duration_seconds: number
          id: string
          project_id: string
          projection_version: string
          purpose: string
          scene_id: string
          scene_order: number
          status: string
          storyboard_artifact_id: string
          storyboard_revision: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          duration_seconds: number
          id?: string
          project_id: string
          projection_version?: string
          purpose: string
          scene_id: string
          scene_order: number
          status?: string
          storyboard_artifact_id: string
          storyboard_revision: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          duration_seconds?: number
          id?: string
          project_id?: string
          projection_version?: string
          purpose?: string
          scene_id?: string
          scene_order?: number
          status?: string
          storyboard_artifact_id?: string
          storyboard_revision?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storyboard_scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storyboard_scenes_storyboard_artifact_id_fkey"
            columns: ["storyboard_artifact_id"]
            isOneToOne: false
            referencedRelation: "project_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storyboard_scenes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      video_projects: {
        Row: {
          active_revision: number
          archived_at: string | null
          correlation_id: string
          created_at: string
          id: string
          name: string
          schema_version: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active_revision?: number
          archived_at?: string | null
          correlation_id: string
          created_at?: string
          id?: string
          name: string
          schema_version: string
          status: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active_revision?: number
          archived_at?: string | null
          correlation_id?: string
          created_at?: string
          id?: string
          name?: string
          schema_version?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_budget_policies: {
        Row: {
          currency: string
          hard_limit_minor: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          currency?: string
          hard_limit_minor: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          currency?: string
          hard_limit_minor?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_budget_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          mode: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_director_project_with_brief: {
        Args: {
          p_workspace_id: string
          p_project_id: string
          p_artifact_id: string
          p_project_name: string
          p_brief: Json
          p_schema_version: string
          p_correlation_id: string
          p_actor_type: string
          p_actor_id: string
          p_created_by: string
        }
        Returns: Json
      }
      claim_production_jobs: {
        Args: { p_lease_seconds: number; p_limit: number; p_worker_id: string }
        Returns: {
          action: string
          attempt_count: number
          attempt_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          error: Json | null
          external_job_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          model_id: string
          payload: Json
          priority: number
          project_id: string
          provider_id: string
          result: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "production_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      commit_budget_reservation: {
        Args: {
          p_amount_minor: number
          p_cost_status: string
          p_expected_revision: number
          p_ledger_idempotency_key: string
          p_reservation_id: string
        }
        Returns: {
          amount_minor: number
          attempt_id: string
          committed_at: string | null
          correlation_id: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          project_id: string
          released_at: string | null
          revision: number
          run_id: string
          status: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "budget_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_production_job: {
        Args: {
          p_job_id: string
          p_lease_token: string
          p_result: Json
          p_worker_id: string
        }
        Returns: {
          action: string
          attempt_count: number
          attempt_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          error: Json | null
          external_job_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          model_id: string
          payload: Json
          priority: number
          project_id: string
          provider_id: string
          result: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_production_job: {
        Args: {
          p_error: Json
          p_job_id: string
          p_lease_token: string
          p_worker_id: string
        }
        Returns: {
          action: string
          attempt_count: number
          attempt_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          error: Json | null
          external_job_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          model_id: string
          payload: Json
          priority: number
          project_id: string
          provider_id: string
          result: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      heartbeat_production_job: {
        Args: {
          p_job_id: string
          p_lease_seconds?: number
          p_lease_token: string
          p_worker_id: string
        }
        Returns: {
          action: string
          attempt_count: number
          attempt_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          error: Json | null
          external_job_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          model_id: string
          payload: Json
          priority: number
          project_id: string
          provider_id: string
          result: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      idempotency_begin: {
        Args: {
          p_fingerprint: string
          p_key: string
          p_project_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      release_budget_reservation: {
        Args: {
          p_expected_revision: number
          p_ledger_idempotency_key: string
          p_reservation_id: string
        }
        Returns: {
          amount_minor: number
          attempt_id: string
          committed_at: string | null
          correlation_id: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          project_id: string
          released_at: string | null
          revision: number
          run_id: string
          status: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "budget_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_production_job: {
        Args: {
          p_available_at?: string
          p_job_id: string
          p_lease_token: string
          p_worker_id: string
        }
        Returns: {
          action: string
          attempt_count: number
          attempt_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          error: Json | null
          external_job_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          model_id: string
          payload: Json
          priority: number
          project_id: string
          provider_id: string
          result: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reschedule_production_job: {
        Args: {
          p_available_at: string
          p_job_id: string
          p_lease_token: string
          p_payload: Json
          p_worker_id: string
        }
        Returns: {
          action: string
          attempt_count: number
          attempt_id: string
          available_at: string
          completed_at: string | null
          created_at: string
          error: Json | null
          external_job_id: string | null
          heartbeat_at: string | null
          id: string
          lease_expires_at: string | null
          lease_token: string | null
          leased_at: string | null
          leased_by: string | null
          max_attempts: number
          model_id: string
          payload: Json
          priority: number
          project_id: string
          provider_id: string
          result: Json | null
          run_id: string
          scene_id: string
          status: string
          step_id: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "production_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_budget: {
        Args: {
          p_amount_minor: number
          p_attempt_id: string
          p_correlation_id: string
          p_currency: string
          p_id: string
          p_ledger_idempotency_key: string
          p_project_id: string
          p_run_id: string
          p_workspace_id: string
        }
        Returns: {
          amount_minor: number
          attempt_id: string
          committed_at: string | null
          correlation_id: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          project_id: string
          released_at: string | null
          revision: number
          run_id: string
          status: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "budget_reservations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_active_artifact_revision: {
        Args: {
          p_artifact_id: string
          p_artifact_type: string
          p_expected_revision: number
          p_project_id: string
          p_updated_by: string
          p_workspace_id: string
        }
        Returns: {
          artifact_id: string
          artifact_type: string
          project_id: string
          revision: number
          updated_at: string
          updated_by: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "active_artifact_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

