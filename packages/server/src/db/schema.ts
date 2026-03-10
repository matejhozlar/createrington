/**
 * Drizzle ORM schema definitions for the entire database
 *
 * This is the single source of truth for all tables, enums, indexes,
 * and check constraints. After editing this file, run:
 *   1. `pnpm db:generate` -- create a migration SQL file
 *   2. `pnpm db:migrate`  -- apply the migration to the running database
 *   3. `pnpm generate`    -- regenerate TypeScript types and query classes
 *
 * NOTE: Do not add PL/pgSQL functions or triggers here -- all business
 * logic lives in application code (see CLAUDE.md for details).
 */

import {
	pgTable,
	pgEnum,
	serial,
	integer,
	bigint,
	text,
	boolean,
	varchar,
	timestamp,
	jsonb,
	uuid,
	date,
	inet,
	index,
	uniqueIndex,
	check,
	primaryKey,
	numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// Enums
// ============================================================================

export const banTypeEnum = pgEnum("ban_type", ["temporary", "permanent"]);

export const strikeClassificationEnum = pgEnum("strike_classification", [
	"pvp",
	"theft",
	"griefing",
	"laggy_machines",
	"inappropriate_chat",
	"harassment",
	"exploiting",
	"rule_violation",
	"other",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
	"open",
	"closed",
	"deleted",
]);

export const ticketTypeEnum = pgEnum("ticket_type", ["general", "report"]);

export const waitlistStatusEnum = pgEnum("waitlist_status", [
	"pending",
	"auto_accepted",
	"accepted",
	"declined",
	"completed",
]);

// ============================================================================
// Tables
// ============================================================================

// --- server (referenced by many tables) ---

export const server = pgTable("server", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
	identifier: text("identifier").notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// --- player (core entity, referenced by many tables) ---

export const player = pgTable(
	"player",
	{
		id: serial("id").primaryKey(),
		minecraftUuid: uuid("minecraft_uuid").notNull().unique(),
		minecraftUsername: text("minecraft_username").notNull().unique(),
		discordId: text("discord_id").notNull().unique(),
		online: boolean("online").notNull().default(false),
		lastSeen: timestamp("last_seen", { withTimezone: true })
			.notNull()
			.defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		currentServerId: integer("current_server_id").references(
			() => server.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("idx_player_discord_id").on(table.discordId),
		index("idx_player_minecraft_uuid").on(table.minecraftUuid),
		index("idx_player_minecraft_username").on(table.minecraftUsername),
		index("idx_player_last_seen").on(table.lastSeen),
	],
);

// --- admin ---

export const admin = pgTable("admin", {
	discordId: text("discord_id")
		.primaryKey()
		.references(() => player.discordId, {
			onUpdate: "cascade",
			onDelete: "cascade",
		}),
	createdAt: timestamp("created_at", { withTimezone: false }).defaultNow(),
	vanished: boolean("vanished").default(false),
});

// --- admin_log_action ---

export const adminLogAction = pgTable(
	"admin_log_action",
	{
		id: serial("id").primaryKey(),
		adminDiscordId: text("admin_discord_id").notNull(),
		adminUsername: text("admin_username").notNull(),
		actionType: text("action_type").notNull(),
		targetPlayerUuid: uuid("target_player_uuid").notNull(),
		targetPlayerName: text("target_player_name").notNull(),
		tableName: text("table_name").notNull(),
		fieldName: text("field_name").notNull(),
		oldValue: text("old_value"),
		newValue: text("new_value"),
		reason: text("reason"),
		serverId: integer("server_id"),
		performedAt: timestamp("performed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		metadata: jsonb("metadata"),
	},
	(table) => [
		index("idx_log_actions_admin").on(table.adminDiscordId),
		index("idx_log_actions_action_type").on(table.actionType),
		index("idx_log_actions_table_name").on(table.tableName),
		index("idx_log_actions_target").on(table.targetPlayerUuid),
		index("idx_log_actions_performed_at").on(table.performedAt.desc()),
	],
);

// --- auth_session ---

export const authSession = pgTable(
	"auth_session",
	{
		id: serial("id").primaryKey(),
		discordId: text("discord_id")
			.notNull()
			.references(() => player.discordId, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		discordUsername: text("discord_username"),
		discordAvatar: text("discord_avatar"),
		tokenHash: text("token_hash").notNull().unique(),
		familyId: uuid("family_id")
			.notNull()
			.default(sql`gen_random_uuid()`),
		ipAddress: inet("ip_address"),
		userAgent: text("user_agent"),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_auth_session_discord_id").on(table.discordId),
		index("idx_auth_session_token_hash")
			.on(table.tokenHash)
			.where(sql`revoked_at IS NULL`),
		index("idx_auth_session_expires_at")
			.on(table.expiresAt)
			.where(sql`revoked_at IS NULL`),
		index("idx_auth_session_family_id").on(table.familyId),
	],
);

// --- discord_embed_preset ---

export const discordEmbedPreset = pgTable("discord_embed_preset", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull().unique(),
	data: jsonb("data").notNull(),
	createdBy: varchar("created_by", { length: 100 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// --- discord_guild_member_join ---

export const discordGuildMemberJoin = pgTable(
	"discord_guild_member_join",
	{
		joinNumber: serial("join_number").primaryKey(),
		userId: varchar("user_id", { length: 32 }).notNull().unique(),
		username: varchar("username", { length: 32 }).notNull(),
		joinedAt: timestamp("joined_at", { withTimezone: true })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("idx_discord_guild_member_join_joined_at").on(
			table.joinedAt.desc(),
		),
	],
);

// --- discord_guild_member_leave ---

export const discordGuildMemberLeave = pgTable(
	"discord_guild_member_leave",
	{
		id: serial("id").primaryKey(),
		discordId: text("discord_id").notNull().unique(),
		minecraftUuid: uuid("minecraft_uuid").notNull(),
		minecraftUsername: text("minecraft_username").notNull(),
		departedAt: timestamp("departed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		notificationMessageId: text("notification_message_id"),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_discord_guild_member_leave_discord_id").on(table.discordId),
		index("idx_discord_guild_member_leave_minecraft_uuid").on(
			table.minecraftUuid,
		),
		index("idx_discord_guild_member_leave_departed_at").on(
			table.departedAt,
		),
		index("idx_discord_guild_member_leave_deleted_at")
			.on(table.deletedAt)
			.where(sql`deleted_at IS NULL`),
	],
);

// --- faq_entry ---

export const faqEntry = pgTable(
	"faq_entry",
	{
		id: serial("id").primaryKey(),
		matchMode: varchar("match_mode", { length: 20 })
			.notNull()
			.default("keywords"),
		pattern: text("pattern").notNull(),
		title: varchar("title", { length: 100 }).notNull(),
		response: text("response").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		priority: integer("priority").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_faq_entry_enabled").on(table.enabled),
		index("idx_faq_entry_priority").on(table.priority.desc()),
	],
);

// --- faq_welcome_message ---

export const faqWelcomeMessage = pgTable("faq_welcome_message", {
	id: serial("id").primaryKey(),
	channelId: text("channel_id").notNull().unique(),
	messageId: text("message_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// --- leaderboard_message ---

export const leaderboardMessage = pgTable(
	"leaderboard_message",
	{
		id: serial("id").primaryKey(),
		leaderboardType: varchar("leaderboard_type", { length: 50 })
			.notNull()
			.unique(),
		channelId: text("channel_id").notNull(),
		messageId: text("message_id").notNull(),
		lastRefreshed: timestamp("last_refreshed", {
			withTimezone: true,
		}).defaultNow(),
		lastManualRefresh: timestamp("last_manual_refresh", {
			withTimezone: true,
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_leaderboard_type").on(table.leaderboardType),
	],
);

// --- lottery_participant ---

export const lotteryParticipant = pgTable("lottery_participant", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	minecraftUuid: uuid("minecraft_uuid")
		.notNull()
		.references(() => player.minecraftUuid, {
			onUpdate: "cascade",
			onDelete: "cascade",
		}),
	minecraftUsername: text("minecraft_username").notNull(),
	amount: bigint("amount", { mode: "bigint" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// --- player_achievement ---

export const playerAchievement = pgTable(
	"player_achievement",
	{
		minecraftUuid: uuid("minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		serverId: integer("server_id")
			.notNull()
			.references(() => server.id, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		achievementGroupId: text("achievement_group_id").notNull(),
		tier: integer("tier").notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		claimedAt: timestamp("claimed_at", { withTimezone: true }),
		rewardAmount: integer("reward_amount").notNull(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.minecraftUuid,
				table.serverId,
				table.achievementGroupId,
				table.tier,
			],
		}),
		check("chk_tier_positive", sql`${table.tier} > 0`),
		check(
			"chk_reward_non_negative",
			sql`${table.rewardAmount} >= 0`,
		),
		index("idx_player_achievement_player_server").on(
			table.minecraftUuid,
			table.serverId,
		),
		index("idx_player_achievement_unclaimed")
			.on(table.minecraftUuid, table.serverId)
			.where(sql`claimed_at IS NULL`),
	],
);

// --- player_balance ---

export const playerBalance = pgTable(
	"player_balance",
	{
		minecraftUuid: uuid("minecraft_uuid")
			.primaryKey()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		balance: bigint("balance", { mode: "bigint" }).notNull().default(sql`0`),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"chk_balance_non_negative",
			sql`${table.balance} >= 0`,
		),
		index("idx_player_balance_uuid").on(table.minecraftUuid),
		index("idx_player_balance_amount").on(table.balance.desc()),
	],
);

// --- player_balance_transaction ---

export const playerBalanceTransaction = pgTable(
	"player_balance_transaction",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		amount: bigint("amount", { mode: "bigint" }).notNull(),
		balanceBefore: bigint("balance_before", { mode: "bigint" }).notNull(),
		balanceAfter: bigint("balance_after", { mode: "bigint" }).notNull(),
		transactionType: text("transaction_type").notNull(),
		description: text("description"),
		relatedPlayerUuid: uuid("related_player_uuid").references(
			() => player.minecraftUuid,
			{ onUpdate: "cascade", onDelete: "set null" },
		),
		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_balance_transaction_player").on(table.playerMinecraftUuid),
		index("idx_balance_transaction_type").on(table.transactionType),
		index("idx_balance_transaction_created").on(table.createdAt.desc()),
		index("idx_balance_transaction_related")
			.on(table.relatedPlayerUuid)
			.where(sql`related_player_uuid IS NOT NULL`),
	],
);

// --- player_ban ---

export const playerBan = pgTable(
	"player_ban",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		playerMinecraftUuid: uuid("player_minecraft_uuid").notNull(),
		banType: banTypeEnum("ban_type").notNull(),
		reason: text("reason").notNull(),
		bannedByDiscordId: text("banned_by_discord_id").notNull(),
		bannedByUsername: text("banned_by_username").notNull(),
		bannedAt: timestamp("banned_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		unbanned: boolean("unbanned").notNull().default(false),
		unbannedByDiscordId: text("unbanned_by_discord_id"),
		unbannedByUsername: text("unbanned_by_username"),
		unbannedAt: timestamp("unbanned_at", { withTimezone: true }),
		unbanReason: text("unban_reason"),
		serverId: integer("server_id").references(() => server.id, {
			onUpdate: "cascade",
			onDelete: "set null",
		}),
		metadata: jsonb("metadata").default({}),
	},
	(table) => [
		check(
			"chk_ban_expiry",
			sql`(${table.banType} = 'permanent' AND ${table.expiresAt} IS NULL) OR (${table.banType} = 'temporary' AND ${table.expiresAt} IS NOT NULL AND ${table.expiresAt} > ${table.bannedAt})`,
		),
		check(
			"chk_unban_fields",
			sql`(${table.unbanned} = false AND ${table.unbannedByDiscordId} IS NULL AND ${table.unbannedByUsername} IS NULL AND ${table.unbannedAt} IS NULL AND ${table.unbanReason} IS NULL) OR (${table.unbanned} = true AND ${table.unbannedByDiscordId} IS NOT NULL AND ${table.unbannedByUsername} IS NOT NULL AND ${table.unbannedAt} IS NOT NULL)`,
		),
		index("idx_player_ban_player").on(table.playerMinecraftUuid),
		index("idx_player_ban_type").on(table.banType),
		index("idx_player_ban_banned_at").on(table.bannedAt.desc()),
		index("idx_player_ban_banned_by").on(table.bannedByDiscordId),
		index("idx_player_ban_expires")
			.on(table.expiresAt)
			.where(sql`expires_at IS NOT NULL AND unbanned = false`),
		index("idx_player_ban_active")
			.on(table.unbanned)
			.where(sql`unbanned = false`),
	],
);

// --- player_minecraft_stats ---

export const playerMinecraftStats = pgTable(
	"player_minecraft_stats",
	{
		minecraftUuid: uuid("minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		serverId: integer("server_id")
			.notNull()
			.references(() => server.id, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		stats: jsonb("stats").notNull(),
		dataVersion: integer("data_version"),
		importedAt: timestamp("imported_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.minecraftUuid, table.serverId] }),
		index("idx_player_minecraft_stats_server").on(table.serverId),
	],
);

// --- player_playtime_daily ---

export const playerPlaytimeDaily = pgTable(
	"player_playtime_daily",
	{
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		serverId: integer("server_id")
			.notNull()
			.references(() => server.id, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		playDate: date("play_date").notNull(),
		secondsPlayed: bigint("seconds_played", { mode: "bigint" })
			.notNull()
			.default(sql`0`),
	},
	(table) => [
		primaryKey({
			columns: [table.playerMinecraftUuid, table.serverId, table.playDate],
		}),
		index("idx_player_playtime_daily_date").on(table.playDate),
	],
);

// --- player_playtime_hourly ---

export const playerPlaytimeHourly = pgTable(
	"player_playtime_hourly",
	{
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		serverId: integer("server_id")
			.notNull()
			.references(() => server.id, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		playHour: timestamp("play_hour", { withTimezone: true }).notNull(),
		secondsPlayed: bigint("seconds_played", { mode: "bigint" })
			.notNull()
			.default(sql`0`),
	},
	(table) => [
		primaryKey({
			columns: [
				table.playerMinecraftUuid,
				table.serverId,
				table.playHour,
			],
		}),
		index("idx_player_playtime_hourly_date").on(table.playHour),
		index("idx_player_playtime_hourly_player_date").on(
			table.playerMinecraftUuid,
			table.playHour,
		),
	],
);

// --- player_playtime_summary ---

export const playerPlaytimeSummary = pgTable(
	"player_playtime_summary",
	{
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		serverId: integer("server_id")
			.notNull()
			.references(() => server.id, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		totalSeconds: bigint("total_seconds", { mode: "bigint" })
			.notNull()
			.default(sql`0`),
		totalSessions: integer("total_sessions").notNull().default(0),
		firstSeen: timestamp("first_seen", { withTimezone: true }),
		lastSeen: timestamp("last_seen", { withTimezone: true }),
		avgSessionSeconds: bigint("avg_session_seconds", {
			mode: "bigint",
		}).generatedAlwaysAs(
			sql`CASE WHEN total_sessions > 0 THEN total_seconds / total_sessions ELSE 0 END`,
		),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [table.playerMinecraftUuid, table.serverId],
		}),
		index("idx_player_playtime_summary_total").on(
			table.totalSeconds.desc(),
		),
	],
);

// --- player_session ---

export const playerSession = pgTable(
	"player_session",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		serverId: integer("server_id")
			.notNull()
			.references(() => server.id, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		sessionStart: timestamp("session_start", {
			withTimezone: true,
		}).notNull(),
		sessionEnd: timestamp("session_end", { withTimezone: true }),
		secondsPlayed: bigint("seconds_played", {
			mode: "bigint",
		}).generatedAlwaysAs(
			sql`CASE WHEN session_end IS NOT NULL THEN EXTRACT(epoch FROM (session_end - session_start))::bigint ELSE NULL END`,
		),
	},
	(table) => [
		check(
			"chk_session_end_after_start",
			sql`${table.sessionEnd} IS NULL OR ${table.sessionEnd} >= ${table.sessionStart}`,
		),
		index("idx_player_session_player").on(table.playerMinecraftUuid),
		index("idx_player_session_server").on(table.serverId),
		index("idx_player_session_start").on(table.sessionStart),
		index("idx_player_session_active")
			.on(table.playerMinecraftUuid, table.serverId)
			.where(sql`session_end IS NULL`),
		index("idx_player_session_date_range").on(
			table.playerMinecraftUuid,
			table.sessionStart,
			table.sessionEnd,
		),
	],
);

// --- player_strike ---

export const playerStrike = pgTable(
	"player_strike",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, {
				onUpdate: "cascade",
				onDelete: "cascade",
			}),
		classification: strikeClassificationEnum("classification").notNull(),
		description: text("description").notNull(),
		severity: integer("severity").notNull().default(1),
		issuedByDiscordId: text("issued_by_discord_id").notNull(),
		issuedByUsername: text("issued_by_username").notNull(),
		issuedAt: timestamp("issued_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		removed: boolean("removed").notNull().default(false),
		removedByDiscordId: text("removed_by_discord_id"),
		removedByUsername: text("removed_by_username"),
		removedAt: timestamp("removed_at", { withTimezone: true }),
		removalReason: text("removal_reason"),
		serverId: integer("server_id").references(() => server.id, {
			onUpdate: "cascade",
			onDelete: "set null",
		}),
		metadata: jsonb("metadata").default({}),
	},
	(table) => [
		check(
			"chk_removed_fields",
			sql`(${table.removed} = false AND ${table.removedByDiscordId} IS NULL AND ${table.removedByUsername} IS NULL AND ${table.removedAt} IS NULL AND ${table.removalReason} IS NULL) OR (${table.removed} = true AND ${table.removedByDiscordId} IS NOT NULL AND ${table.removedByUsername} IS NOT NULL AND ${table.removedAt} IS NOT NULL)`,
		),
		check(
			"player_strike_severity_check",
			sql`${table.severity} >= 1 AND ${table.severity} <= 5`,
		),
		index("idx_player_strike_player").on(table.playerMinecraftUuid),
		index("idx_player_strike_classification").on(table.classification),
		index("idx_player_strike_issued_at").on(table.issuedAt.desc()),
		index("idx_player_strike_severity").on(table.severity.desc()),
		index("idx_player_strike_removed")
			.on(table.removed)
			.where(sql`removed = false`),
		index("idx_player_strike_server")
			.on(table.serverId)
			.where(sql`server_id IS NOT NULL`),
	],
);

// --- reward_claim ---

export const rewardClaim = pgTable(
	"reward_claim",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid, { onDelete: "cascade" }),
		rewardType: varchar("reward_type", { length: 50 }).notNull(),
		claimedAt: timestamp("claimed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		amount: bigint("amount", { mode: "bigint" }).notNull(),
		metadata: jsonb("metadata").default({}),
	},
	(table) => [
		uniqueIndex("reward_claim_player_type_claimed").on(
			table.playerMinecraftUuid,
			table.rewardType,
			table.claimedAt,
		),
		index("idx_reward_claim_player").on(table.playerMinecraftUuid),
		index("idx_reward_claim_type").on(table.rewardType),
		index("idx_reward_claim_claimed_at").on(table.claimedAt),
		index("idx_reward_claim_player_type").on(
			table.playerMinecraftUuid,
			table.rewardType,
		),
	],
);

// --- ticket ---

export const ticket = pgTable(
	"ticket",
	{
		id: serial("id").primaryKey(),
		ticketNumber: integer("ticket_number").notNull(),
		type: ticketTypeEnum("type").notNull(),
		creatorDiscordId: text("creator_discord_id").notNull(),
		channelId: text("channel_id").notNull().unique(),
		status: ticketStatusEnum("status").notNull().default("open"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		closedByDiscordId: text("closed_by_discord_id"),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		metadata: jsonb("metadata").default({}),
	},
	(table) => [
		index("idx_ticket_channel").on(table.channelId),
		index("idx_ticket_creator").on(table.creatorDiscordId),
		index("idx_ticket_status").on(table.status),
		index("idx_ticket_type").on(table.type),
	],
);

// --- ticket_action ---

export const ticketAction = pgTable(
	"ticket_action",
	{
		id: serial("id").primaryKey(),
		ticketId: integer("ticket_id")
			.notNull()
			.references(() => ticket.id, { onDelete: "cascade" }),
		actionType: text("action_type").notNull(),
		performedByDiscordId: text("performed_by_discord_id").notNull(),
		performedAt: timestamp("performed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		metadata: jsonb("metadata").default({}),
	},
	(table) => [
		index("idx_ticket_action_ticket").on(table.ticketId),
		index("idx_ticket_action_type").on(table.actionType),
	],
);

// --- waitlist_entry ---

export const waitlistEntry = pgTable(
	"waitlist_entry",
	{
		id: serial("id").primaryKey(),
		email: text("email"),
		discordName: text("discord_name").notNull().unique(),
		discordId: text("discord_id").unique(),
		token: text("token").unique(),
		submittedAt: timestamp("submitted_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		discordMessageId: text("discord_message_id"),
		status: waitlistStatusEnum("status").notNull().default("pending"),
		joinedDiscord: boolean("joined_discord").notNull().default(false),
		verified: boolean("verified").notNull().default(false),
		registered: boolean("registered").notNull().default(false),
		joinedMinecraft: boolean("joined_minecraft").notNull().default(false),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
		acceptedBy: text("accepted_by"),
		metadata: jsonb("metadata"),
	},
	(table) => [
		index("idx_waitlist_discord_message_id").on(table.discordMessageId),
		index("idx_waitlist_status").on(table.status),
		index("idx_waitlist_submitted_at").on(table.submittedAt),
		index("idx_waitlist_token").on(table.token),
	],
);

// ============================================================================
// Crypto Market Enums
// ============================================================================

// Token categories drive price engine behaviour (volatility, floor, demand curve)
export const cryptoTokenCategoryEnum = pgEnum("crypto_token_category", [
	"stable",
	"blue_chip",
	"memecoin",
	"seasonal",
]);

// Direction of an executed trade
export const cryptoTradeTypeEnum = pgEnum("crypto_trade_type", [
	"buy",
	"sell",
]);

// What caused a trade to execute — market order, a pending order type, or automatic delisting
export const cryptoTradeTriggerEnum = pgEnum("crypto_trade_trigger", [
	"market",
	"limit",
	"stop_loss",
	"take_profit",
	"auto_delist",
]);

// Types of pending (non-market) orders a player can place
export const cryptoOrderTypeEnum = pgEnum("crypto_order_type", [
	"limit_buy",
	"limit_sell",
	"stop_loss",
	"take_profit",
]);

// Lifecycle states for a pending order
export const cryptoOrderStatusEnum = pgEnum("crypto_order_status", [
	"pending",
	"filled",
	"cancelled",
	"expired",
]);

// Time-frame granularity for OHLCV price snapshots
export const cryptoPriceIntervalEnum = pgEnum("crypto_price_interval", [
	"tick",
	"minute",
	"hourly",
	"daily",
	"weekly",
]);

// Whether a price alert fires when the token crosses above or below the target price
export const cryptoAlertDirectionEnum = pgEnum("crypto_alert_direction", [
	"above",
	"below",
]);

// Importance level attached to market events shown in the news feed
export const cryptoEventSeverityEnum = pgEnum("crypto_event_severity", [
	"info",
	"warning",
	"critical",
]);

// ============================================================================
// Crypto Market Tables
// ============================================================================

// --- crypto_token ---
// Master record for each tradable token: symbol, supply, current price, and crash/delist state.

export const cryptoToken = pgTable("crypto_token", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	symbol: text("symbol").notNull().unique(),
	description: text("description"),
	category: cryptoTokenCategoryEnum("category").notNull(),
	totalSupply: bigint("total_supply", { mode: "bigint" }).notNull(),
	availableSupply: bigint("available_supply", { mode: "bigint" }).notNull(),
	price: numeric("price", { precision: 20, scale: 8 }).notNull(),
	floorPrice: numeric("floor_price", { precision: 20, scale: 8 }),
	isCrashed: boolean("is_crashed").notNull().default(false),
	crashedAt: timestamp("crashed_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	delistedAt: timestamp("delisted_at", { withTimezone: true }),
	ipoEndsAt: timestamp("ipo_ends_at", { withTimezone: true }), // null after IPO closes; orders and limit trades are blocked while this is in the future
	ipoPrice: numeric("ipo_price", { precision: 20, scale: 8 }), // fixed price at which the token is sold during its IPO window
	metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

// --- crypto_holding ---
// Current token balance and aggregate cost basis per player, updated on every buy/sell.

export const cryptoHolding = pgTable(
	"crypto_holding",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid),
		tokenId: integer("token_id")
			.notNull()
			.references(() => cryptoToken.id),
		amount: bigint("amount", { mode: "bigint" }).notNull(),
		totalCostBasis: numeric("total_cost_basis", { precision: 20, scale: 8 })
			.notNull()
			.default(sql`0`),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_crypto_holding_player_token").on(
			table.playerMinecraftUuid,
			table.tokenId,
		),
		index("idx_crypto_holding_player").on(table.playerMinecraftUuid),
		index("idx_crypto_holding_token").on(table.tokenId),
		check("chk_crypto_holding_amount", sql`${table.amount} >= 0`),
	],
);

// --- crypto_transaction ---
// Immutable record of every executed trade, including fees, execution price, and realized P&L.

export const cryptoTransaction = pgTable(
	"crypto_transaction",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid),
		tokenId: integer("token_id")
			.notNull()
			.references(() => cryptoToken.id),
		type: cryptoTradeTypeEnum("type").notNull(),
		trigger: cryptoTradeTriggerEnum("trigger").notNull().default("market"),
		amount: bigint("amount", { mode: "bigint" }).notNull(),
		priceAtExecution: numeric("price_at_execution", {
			precision: 20,
			scale: 8,
		}).notNull(),
		feeAmount: numeric("fee_amount", { precision: 20, scale: 8 })
			.notNull()
			.default(sql`0`),
		totalCost: numeric("total_cost", { precision: 20, scale: 8 }).notNull(),
		realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 }),
		orderId: integer("order_id").references(() => cryptoOrder.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_crypto_transaction_player").on(table.playerMinecraftUuid),
		index("idx_crypto_transaction_token_time").on(
			table.tokenId,
			table.createdAt.desc(),
		),
	],
);

// --- crypto_price_snapshot ---
// OHLCV candlestick data at multiple intervals; interval column acts as the discriminator.

export const cryptoPriceSnapshot = pgTable(
	"crypto_price_snapshot",
	{
		id: serial("id").primaryKey(),
		tokenId: integer("token_id")
			.notNull()
			.references(() => cryptoToken.id),
		interval: cryptoPriceIntervalEnum("interval").notNull(),
		openPrice: numeric("open_price", { precision: 20, scale: 8 }).notNull(),
		highPrice: numeric("high_price", { precision: 20, scale: 8 }).notNull(),
		lowPrice: numeric("low_price", { precision: 20, scale: 8 }).notNull(),
		closePrice: numeric("close_price", { precision: 20, scale: 8 }).notNull(),
		volume: bigint("volume", { mode: "bigint" }).notNull().default(sql`0`),
		recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		uniqueIndex("idx_crypto_price_snapshot_unique").on(
			table.tokenId,
			table.interval,
			table.recordedAt,
		),
		index("idx_crypto_price_snapshot_lookup").on(
			table.tokenId,
			table.interval,
			table.recordedAt.desc(),
		),
	],
);

// --- crypto_order ---
// Pending limit, stop-loss, and take-profit orders; executed by the price engine when the target is hit.

export const cryptoOrder = pgTable(
	"crypto_order",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid),
		tokenId: integer("token_id")
			.notNull()
			.references(() => cryptoToken.id),
		type: cryptoOrderTypeEnum("type").notNull(),
		amount: bigint("amount", { mode: "bigint" }).notNull(),
		targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
		reservedBalance: numeric("reserved_balance", { precision: 20, scale: 8 })
			.notNull()
			.default(sql`0`),
		reservedTokens: bigint("reserved_tokens", { mode: "bigint" })
			.notNull()
			.default(sql`0`),
		status: cryptoOrderStatusEnum("status").notNull().default("pending"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		filledAt: timestamp("filled_at", { withTimezone: true }),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_crypto_order_player_status").on(
			table.playerMinecraftUuid,
			table.status,
		),
		index("idx_crypto_order_token_pending")
			.on(table.tokenId, table.status)
			.where(sql`${table.status} = 'pending'`),
	],
);

// --- crypto_cost_basis ---
// Individual buy lots consumed in FIFO order when calculating realized P&L on sells.

export const cryptoCostBasis = pgTable(
	"crypto_cost_basis",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid),
		tokenId: integer("token_id")
			.notNull()
			.references(() => cryptoToken.id),
		amountRemaining: bigint("amount_remaining", { mode: "bigint" }).notNull(),
		pricePerUnit: numeric("price_per_unit", { precision: 20, scale: 8 }).notNull(),
		acquiredAt: timestamp("acquired_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_crypto_cost_basis_player_token").on(
			table.playerMinecraftUuid,
			table.tokenId,
			table.acquiredAt,
		),
	],
);

// --- crypto_treasury ---
// Singleton row tracking cumulative trading fees collected and burned by the market.

export const cryptoTreasury = pgTable("crypto_treasury", {
	id: serial("id").primaryKey(),
	totalCollected: numeric("total_collected", { precision: 20, scale: 8 })
		.notNull()
		.default(sql`0`),
	totalBurned: numeric("total_burned", { precision: 20, scale: 8 })
		.notNull()
		.default(sql`0`),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// --- crypto_price_alert ---
// Player-defined price alerts that fire once when a token crosses the target threshold.

export const cryptoPriceAlert = pgTable(
	"crypto_price_alert",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid),
		tokenId: integer("token_id")
			.notNull()
			.references(() => cryptoToken.id),
		targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
		direction: cryptoAlertDirectionEnum("direction").notNull(),
		triggered: boolean("triggered").notNull().default(false),
		triggeredAt: timestamp("triggered_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_crypto_alert_pending")
			.on(table.tokenId, table.triggered)
			.where(sql`${table.triggered} = false`),
	],
);

// --- crypto_watchlist ---
// Tokens a player has bookmarked for quick access; unique per player-token pair.

export const cryptoWatchlist = pgTable(
	"crypto_watchlist",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid),
		tokenId: integer("token_id")
			.notNull()
			.references(() => cryptoToken.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_crypto_watchlist_unique").on(
			table.playerMinecraftUuid,
			table.tokenId,
		),
	],
);

// --- crypto_portfolio_snapshot ---
// Daily snapshots of a player's total portfolio value and P&L, used for the history chart.

export const cryptoPortfolioSnapshot = pgTable(
	"crypto_portfolio_snapshot",
	{
		id: serial("id").primaryKey(),
		playerMinecraftUuid: uuid("player_minecraft_uuid")
			.notNull()
			.references(() => player.minecraftUuid),
		totalValue: numeric("total_value", { precision: 20, scale: 8 }).notNull(),
		totalInvested: numeric("total_invested", {
			precision: 20,
			scale: 8,
		}).notNull(),
		realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 })
			.notNull()
			.default(sql`0`),
		tokenCount: integer("token_count").notNull().default(0),
		recordedAt: timestamp("recorded_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_crypto_portfolio_snapshot_player").on(
			table.playerMinecraftUuid,
			table.recordedAt.desc(),
		),
	],
);

// --- crypto_market_event ---
// Market-wide or token-specific events surfaced in the news feed (e.g. crashes, listings, milestones).

export const cryptoMarketEvent = pgTable(
	"crypto_market_event",
	{
		id: serial("id").primaryKey(),
		type: text("type").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		tokenId: integer("token_id").references(() => cryptoToken.id),
		severity: cryptoEventSeverityEnum("severity").notNull().default("info"),
		metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
		activeUntil: timestamp("active_until", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_crypto_market_event_recent").on(table.createdAt.desc()),
	],
);
