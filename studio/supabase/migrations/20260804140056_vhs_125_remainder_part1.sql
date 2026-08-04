-- =============================================================================
-- HISTORICAL NO-OP MARKER — Production history alignment (Porte 3 correctif)
-- =============================================================================
-- Incident        : VHS-125 remote MCP payload truncated during Porte 3 apply
-- Remote version  : 20260804140056
-- Remote name     : vhs_125_remainder_part1
-- Applied (UTC)   : 2026-08-04T14:00:56Z (version timestamp from MCP apply)
-- Payload SHA-256 : dbb453bb427c79a80c58515719bd87783bfdedca6cd24d01f33afdf568778826
-- Objects covered : begin_or_get_quality_director_run, persist_quality_report
-- Canonical SQL   : already included in 20260804135742_vhs_125_postproduction_delivery.sql
-- Documentation   : docs/Developer-Handover/21_VHS_125_REMOTE_MIGRATION_INCIDENT.md
--
-- This file must NOT re-execute mutative SQL. Local `db reset` applies the full
-- canonical VHS-125 migration first; this marker only preserves the remote
-- schema_migrations version entry for dry-run / list alignment.
-- =============================================================================

DO $vhs_125_remainder_part1_marker$
BEGIN
  NULL;
END
$vhs_125_remainder_part1_marker$;
