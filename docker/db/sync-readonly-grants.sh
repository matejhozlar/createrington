#!/usr/bin/env bash
set -euo pipefail

# Applies claude-readonly-role.sql to one database in a single transaction,
# so a failing statement rolls back everything before it and the grants are
# left exactly as they were. Run it as the role that owns the tables (the
# same role that runs migrations): GRANT/REVOKE need ownership, and ALTER
# DEFAULT PRIVILEGES only covers tables created by the role that executes
# it. Postgres does not error on a non-owned table during GRANT ... ON ALL
# TABLES, it skips it with a WARNING, so keep the owner and the migrator the
# same role. Exits 0 without changes when the claude_readonly role does not
# exist on the cluster, so a fresh environment deploys cleanly.
#
# Required env: DB_HOST, DB_PORT, DB_USER, DB_DATABASE
# Auth: PGPASSWORD, or anything else libpq accepts (.pgpass, peer auth)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRANTS_SQL="$SCRIPT_DIR/claude-readonly-role.sql"
ROLE="claude_readonly"

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_DATABASE:?DB_DATABASE is required}"

export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-10}"

trap 'echo "FAILED: readonly grant sync did not complete on $DB_DATABASE (grants left unchanged)" >&2' ERR

psql_cmd=(
  psql
  -h "$DB_HOST"
  -p "$DB_PORT"
  -U "$DB_USER"
  -d "$DB_DATABASE"
  -X
  -v ON_ERROR_STOP=1
)

role_exists=$("${psql_cmd[@]}" -tA -c "SELECT 1 FROM pg_roles WHERE rolname = '$ROLE'")

if [[ "$role_exists" != "1" ]]; then
  echo "Role $ROLE does not exist, skipping grant sync on $DB_DATABASE"
  exit 0
fi

echo "Syncing $ROLE grants on $DB_DATABASE as $DB_USER"
"${psql_cmd[@]}" -q --single-transaction -f "$GRANTS_SQL"
echo "Readonly grants synced on $DB_DATABASE"
