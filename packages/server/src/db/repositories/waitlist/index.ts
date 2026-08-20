import { db, Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type {
  WaitlistEntry,
  WaitlistEntryFilters,
} from "@createrington/shared/db";
import { settings } from "@/services/settings";
import { DatabaseTable } from "@/generated/db";
import { AdminEdit } from "@/types";

/**
 * Waitlist persistence and reporting. Entries are Discord-born (created by
 * the Join Waitlist button in a member's verification channel), so every
 * row carries a discordId. This repository owns capacity checks, admin
 * stats, the admin-channel progress embed, and audited deletion; queue
 * orchestration (promotion, pings, channel lifecycle) lives in the waitlist
 * service. Capacity reads fall closed when the player-count probe fails.
 */
export class WaitlistRepository {
  /**
   * True when intake is open: mode is "auto" and the live player count is
   * below the configured player limit. A "closed" intake mode forces
   * waitlist regardless of capacity. Returns false on any DB error so we
   * fail closed and queue the user.
   */
  async hasCapacity(): Promise<boolean> {
    try {
      const intakeMode = await settings.getIntakeMode();
      if (intakeMode === "closed") {
        logger.debug("Capacity check: intake mode is closed");
        return false;
      }

      const [currentPlayers, playerLimit] = await Promise.all([
        Q.player.count(),
        settings.getPlayerLimit(),
      ]);

      const hasCapacity =
        Number.isFinite(playerLimit) && playerLimit > currentPlayers;

      logger.debug(
        `Capacity check: players=${currentPlayers}, limit=${playerLimit}, hasCapacity=${hasCapacity}`,
      );

      return hasCapacity;
    } catch (error) {
      logger.error("Failed to check capacity:", error);
      return false;
    }
  }

  /** Fetch a single waitlist entry by ID for the admin panel detail view. */
  async getDetailed(entryId: number): Promise<WaitlistEntry> {
    return await Q.waitlist.entry.get({ id: entryId });
  }

  /** Filtered, paginated waitlist list for the admin list view. */
  async getAll(
    filters?: WaitlistEntryFilters,
    options?: {
      orderBy?: keyof WaitlistEntry;
      orderDirection?: "asc" | "desc";
      limit?: number;
      offset?: number;
    },
  ): Promise<WaitlistEntry[]> {
    return await Q.waitlist.entry.findAll(filters, options);
  }

  /** Count of waitlist entries matching the given filters. */
  async count(filters?: WaitlistEntryFilters): Promise<number> {
    return await Q.waitlist.entry.count(filters);
  }

  /** Hard-delete a waitlist entry and write the matching admin_log_action in one transaction. */
  async adminDelete(
    entryId: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<void> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    await db.inTransaction(async (tx) => {
      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: AdminEdit.DELETE_WAITLIST,
        targetPlayerUuid: "00000000-0000-0000-0000-000000000000",
        targetPlayerName: entry.discordUsername,
        tableName: DatabaseTable.WAITLIST_ENTRY.TABLE,
        fieldName: "deleted",
        oldValue: "false",
        newValue: "true",
        reason,
        metadata: {
          discordId: entry.discordId,
          discordUsername: entry.discordUsername,
          status: entry.status,
        },
      });

      await tx.waitlist.entry.delete({ id: entryId });

      logger.info(
        `Admin ${adminUsername} deleted waitlist entry #${entryId} (${entry.discordUsername})`,
      );
    });
  }

  /**
   * Re-render the admin-channel progress embed for an entry. Silently
   * returns if the entry has no stored admin message ID; errors are
   * logged and swallowed so onboarding flows are not blocked by Discord.
   */
  async updateProgressEmbed(entryId: number): Promise<void> {
    try {
      const entry = await Q.waitlist.entry.get({ id: entryId });

      if (!entry.adminMessageId) {
        logger.warn(`No admin message ID for waitlist entry ${entryId}`);
        return;
      }

      let discordUser = null;
      let player = null;

      try {
        discordUser = await Discord.Users.fetch(entry.discordId);
      } catch (error) {
        logger.warn(`Failed to fetch Discord user ${entry.discordId}:`, error);
      }

      try {
        player = await Q.player.find({ discordId: entry.discordId });
      } catch (error) {
        logger.debug(
          `No player found for Discord ID ${entry.discordId}:`,
          error,
        );
      }

      const progressEmbed = EmbedPresets.waitlist
        .createProgressEmbed(entry, discordUser, player)
        .timestamp();

      const result = await Discord.Messages.edit({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        messageId: entry.adminMessageId,
        embeds: progressEmbed.build(),
        components: [],
      });

      if (!result.success) {
        logger.warn(
          `Could not update progress embed for entry ${entryId}: ${result.error}`,
        );
        return;
      }

      logger.debug(`Updated progress embed for entry ${entryId}`);
    } catch (error) {
      logger.error(
        `Failed to update progress embed entry for ${entryId}:`,
        error,
      );
    }
  }

  /** Mark the "joined Minecraft" onboarding step as complete; no-op when the player has no entry. */
  async markJoinedMinecraft(discordId: string): Promise<void> {
    const entry = await Q.waitlist.entry.find({ discordId });
    if (!entry) return;

    await Q.waitlist.entry.update({ id: entry.id }, { joinedMinecraft: true });

    await this.updateProgressEmbed(entry.id);
  }

  /** Dashboard stats: status breakdowns, milestone progress counts, queue trends. */
  async getStats(): Promise<{
    total: number;
    queued: number;
    promoted: number;
    registered: number;
    expired: number;
    joinedMinecraft: number;
    submitted: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      queued,
      promoted,
      registered,
      expired,
      joinedMinecraft,
      submittedToday,
      submittedThisWeek,
      submittedThisMonth,
    ] = await Promise.all([
      Q.waitlist.entry.count(),
      Q.waitlist.entry.count({ status: "queued" }),
      Q.waitlist.entry.count({ status: "promoted" }),
      Q.waitlist.entry.count({ status: "registered" }),
      Q.waitlist.entry.count({ status: "expired" }),
      Q.waitlist.entry.count({ joinedMinecraft: true }),
      Q.waitlist.entry.count({ queuedAt: { $gte: today } }),
      Q.waitlist.entry.count({ queuedAt: { $gte: weekAgo } }),
      Q.waitlist.entry.count({ queuedAt: { $gte: monthAgo } }),
    ]);

    return {
      total,
      queued,
      promoted,
      registered,
      expired,
      joinedMinecraft,
      submitted: {
        today: submittedToday,
        thisWeek: submittedThisWeek,
        thisMonth: submittedThisMonth,
      },
    };
  }
}
