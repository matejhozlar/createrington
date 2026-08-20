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

-- (none currently; waitlist_entry stopped storing emails and is fully
-- visible via the blanket grant)
