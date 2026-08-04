-- =============================================================================
-- HISTORICAL NO-OP MARKER — Production history alignment (Porte 3 correctif)
-- =============================================================================
-- Incident        : VHS-125 remote MCP payload truncated during Porte 3 apply
-- Remote version  : 20260804140143
-- Remote name     : vhs_125_remainder_part2
-- Applied (UTC)   : 2026-08-04T14:01:43Z (version timestamp from MCP apply)
-- Payload SHA-256 : 14291668c6adfdb98039eebbb575d7ab7eff0fd8f4958bce89407a5cdf1d2dbe
-- Objects covered : persist_human_review_decision, begin_or_get_merge_director_run,
--                   persist_merge_outcome
-- Canonical SQL   : already included in 20260804135742_vhs_125_postproduction_delivery.sql
-- Documentation   : docs/Developer-Handover/21_VHS_125_REMOTE_MIGRATION_INCIDENT.md
--
-- This file must NOT re-execute mutative SQL. Local `db reset` applies the full
-- canonical VHS-125 migration first; this marker only preserves the remote
-- schema_migrations version entry for dry-run / list alignment.
-- =============================================================================

DO $vhs_125_remainder_part2_marker$
BEGIN
  NULL;
END
$vhs_125_remainder_part2_marker$;
