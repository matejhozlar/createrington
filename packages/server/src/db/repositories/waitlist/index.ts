import { db, Q } from "@/db";
import type { WaitlistFunnelStats } from "@/db/queries/waitlist/entry";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { ActionRowBuilder, type ButtonBuilder } from "discord.js";
import type {
  WaitlistEntry,
  WaitlistEntryFilters,
} from "@createrington/shared/db";
import { settings } from "@/services/settings";
import { DatabaseTable } from "@/generated/db";
import { AdminEdit } from "@/types";

const CAPACITY_MEMO_TTL_MS = 5_000;

/**
 * Waitlist persistence and reporting. Entries are Discord-born (created by
 * the Join Waitlist button in a member's verification channel), so every
 * row carries a discordId. This repository owns capacity checks, admin
 * stats, the admin-channel progress embed, and audited deletion; queue
 * orchestration (promotion, pings, channel lifecycle) lives in the waitlist
 * service. Capacity reads fall closed when the player-count probe fails.
 */
export class WaitlistRepository {
  private capacityMemo: { value: boolean; expiresAt: number } | null = null;

  /** hasCapacity() memoized for a few seconds, for unauthenticated high-frequency reads. */
  async hasCapacityMemoized(): Promise<boolean> {
    if (this.capacityMemo && Date.now() < this.capacityMemo.expiresAt) {
      return this.capacityMemo.value;
    }
    const value = await this.hasCapacity();
    this.capacityMemo = {
      value,
      expiresAt: Date.now() + CAPACITY_MEMO_TTL_MS,
    };
    return value;
  }

  /**
   * True when intake is open: mode is "auto" and the live player count is
   * below the configured player limit. A "closed" intake mode forces
   * waitlist regardless of capacity. Returns false on any DB error so we
   * fail closed and queue the user.
   */
  async hasCapacity(): Promise<boolean> {
    try {
      return (await this.getFreeSlots()) > 0;
    } catch (error) {
      logger.error("Failed to check capacity:", error);
      return false;
    }
  }

  /**
   * Unreserved free slots: player limit minus current players minus
   * outstanding promotions. Zero while intake is closed. This is an
   * advisory snapshot for display and gating; slot-taking writes re-read it
   * inside WaitlistService's slot lock, which serializes them per process.
   */
  async getFreeSlots(): Promise<number> {
    const intakeMode = await settings.getIntakeMode();
    if (intakeMode === "closed") {
      logger.debug("Capacity check: intake mode is closed");
      return 0;
    }

    const [currentPlayers, playerLimit, reserved] = await Promise.all([
      Q.player.count(),
      settings.getPlayerLimit(),
      Q.waitlist.entry.count({ status: "promoted" }),
    ]);

    const free = Math.max(0, playerLimit - currentPlayers - reserved);

    logger.debug(
      `Capacity check: players=${currentPlayers}, reserved=${reserved}, limit=${playerLimit}, free=${free}`,
    );

    return free;
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
        logger.debug(`No admin message ID for waitlist entry ${entryId}`);
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

      const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ButtonPresets.links.adminPanel(),
      );

      const result = await Discord.Messages.edit({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        messageId: entry.adminMessageId,
        embeds: progressEmbed.build(),
        components: [linkRow],
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

  /**
   * Dashboard stats: status breakdowns, milestone progress counts, and
   * first-time signups per window. One aggregate query, so the counts are a
   * consistent snapshot.
   */
  async getStats(): Promise<WaitlistFunnelStats> {
    return await Q.waitlist.entry.getFunnelStats();
  }
}
