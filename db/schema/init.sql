-- Auto-generated schema initialization file
-- This file sources all individual type, table and function files
-- Generated at: 2026-02-12T16:21:51.621Z

-- ============================================================================
-- CUSTOM TYPES (ENUMS)
-- ============================================================================

\i types/00_ban_type.sql
\i types/01_strike_classification.sql
\i types/02_ticket_status.sql
\i types/03_ticket_type.sql
\i types/04_waitlist_status.sql

-- ============================================================================
-- TABLES
-- ============================================================================

\i tables/00_admin.sql
\i tables/01_admin_log_action.sql
\i tables/02_discord_embed_preset.sql
\i tables/03_discord_guild_member_join.sql
\i tables/04_discord_guild_member_leave.sql
\i tables/05_faq_entry.sql
\i tables/06_faq_welcome_message.sql
\i tables/07_leaderboard_message.sql
\i tables/08_player.sql
\i tables/09_player_achievement.sql
\i tables/10_player_balance.sql
\i tables/11_player_balance_transaction.sql
\i tables/12_player_ban.sql
\i tables/13_player_minecraft_stats.sql
\i tables/14_player_playtime_daily.sql
\i tables/15_player_playtime_hourly.sql
\i tables/16_player_playtime_summary.sql
\i tables/17_player_session.sql
\i tables/18_player_strike.sql
\i tables/19_reward_claim.sql
\i tables/20_server.sql
\i tables/21_ticket.sql
\i tables/22_ticket_action.sql
\i tables/23_waitlist_entry.sql

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

\i functions/00_cleanup_old_waitlist_entries.sql
\i functions/01_sync_player_online_status.sql
\i functions/02_update_playtime_aggregates.sql
\i functions/03_update_updated_at_column.sql
