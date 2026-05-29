-- Readonly role permissions for Claude admin chat database access.
-- This script is IDEMPOTENT — run it on every deploy to keep permissions in sync.
--
-- How it works:
--   1. Grants SELECT on ALL current tables (picks up new tables since last run)
--   2. Revokes access to every table on the BLOCKED list
--   3. Re-applies column-level grants for partially-visible tables
--
-- When modifying the schema:
--   - New tables are automatically visible (step 1 covers them)
--   - To BLOCK a new sensitive table: add a REVOKE line to the "Blocked tables" section
--   - To PARTIALLY expose a table: add REVOKE + column-level GRANT
--
-- The role itself (claude_readonly) is created separately (one-time setup).
-- This script only manages table-level permissions.

-- ============================================================
-- 1. Blanket read access
-- ============================================================
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO claude_readonly;

-- ============================================================
-- 2. Blocked tables — fully revoked, no access at all
--    ADD NEW SENSITIVE TABLES HERE as the schema evolves.
-- ============================================================
REVOKE SELECT ON auth_session FROM claude_readonly;

-- ============================================================
-- 3. Partially visible tables — revoke full access, then grant
--    only specific safe columns.
-- ============================================================

-- waitlist_entry: hide email and verification token
REVOKE SELECT ON waitlist_entry FROM claude_readonly;
GRANT SELECT (
  id, discord_name, discord_id, submitted_at, discord_message_id,
  status, joined_discord, verified, registered, joined_minecraft,
  accepted_at, accepted_by
) ON waitlist_entry TO claude_readonly;
