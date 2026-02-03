-- Auto-generated schema initialization file
-- This file sources all individual type, table and function files
-- Generated at: 2026-02-03T10:16:40.455Z

-- ============================================================================
-- CUSTOM TYPES (ENUMS)
-- ============================================================================

\i types/00_strike_classification.sql
\i types/01_ticket_status.sql
\i types/02_ticket_type.sql
\i types/03_waitlist_status.sql

-- ============================================================================
-- TABLES
-- ============================================================================

\i tables/00_admin.sql
\i tables/01_admin_log_action.sql
\i tables/02_discord_guild_member_join.sql
\i tables/03_discord_guild_member_leave.sql
\i tables/04_leaderboard_message.sql
\i tables/05_player.sql
\i tables/06_player_balance.sql
\i tables/07_player_balance_transaction.sql
\i tables/08_player_playtime_daily.sql
\i tables/09_player_playtime_hourly.sql
\i tables/10_player_playtime_summary.sql
\i tables/11_player_session.sql
\i tables/12_player_strike.sql
\i tables/13_reward_claim.sql
\i tables/14_server.sql
\i tables/15_ticket.sql
\i tables/16_ticket_action.sql
\i tables/17_waitlist_entry.sql

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

\i functions/00_cleanup_old_waitlist_entries.sql
\i functions/01_sync_player_online_status.sql
\i functions/02_update_playtime_aggregates.sql
\i functions/03_update_updated_at_column.sql
