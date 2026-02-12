import config from "@/config";
import { db, Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type {
  WaitlistEntry,
  WaitlistEntryCreate,
  WaitlistEntryFilters,
} from "@createrington/shared/db";
import { email, EmailTemplate } from "@/services/email";
import { DatabaseTable } from "@/generated/db";
import { AdminEdit } from "@/types";
import crypto from "node:crypto";

interface RegistrationResult {
  entry: WaitlistEntry;
  autoAccepted: boolean;
  token?: string;
}

export enum ProgressStep {
  JOINED_DISCORD = "joinedDiscord",
  VERIFIED = "verified",
  REGISTERED = "registered",
  JOINED_MINECRAFT = "joinedMinecraft",
}

export class WaitlistRepository {
  // ============================================================================
  // CAPACITY CHECK
  // ============================================================================

  /**
   * Checks if the server has capacity for new players
   * Based on current player count vs limit
   *
   * @returns True if under player limit
   */
  async hasCapacity(): Promise<boolean> {
    try {
      const currentPlayers = await Q.player.count();

      const playerLimit = config.servers.playerLimit;

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

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Notifies admins in Discord about new waitlist entry
   *
   * @param entry - Waitlist entry
   * @param autoAccepted - Whether the user was auto-accepted
   * @private
   */
  private async notifyAdmins(
    entry: WaitlistEntry,
    autoAccepted: boolean,
  ): Promise<string | null> {
    try {
      if (autoAccepted) {
        const { embed, components, content } =
          EmbedPresets.waitlist.autoAcceptNotification({
            id: entry.id,
            email: entry.email,
            discordName: entry.discordName,
            botMention: `<@${config.discord.bots.main.id}>` || "bot",
          });

        const result = await Discord.Messages.send({
          channelId: Discord.Channels.administration.NOTIFICATIONS,
          embeds: embed.setTimestamp(),
          components,
          content,
        });

        return result.messageId || null;
      } else {
        const { embed, components } = EmbedPresets.waitlist.adminNotification({
          id: entry.id,
          email: entry.email,
          discordName: entry.discordName,
        });

        const result = await Discord.Messages.send({
          channelId: Discord.Channels.administration.NOTIFICATIONS,
          embeds: embed.setTimestamp(),
          components,
        });

        logger.debug(
          `Admin notification sent for entry #${entry.id} (autoAccepted: ${autoAccepted})`,
        );

        return result.messageId || null;
      }
    } catch (error) {
      logger.error("Failed to notify admins:", error);
      return null;
    }
  }

  /**
   * Generic method to update a progress step
   *
   * @param discordId - Discord user ID to update progress step for
   * @param step - Progress step to update
   * @private
   */
  private async updateProgressStep(
    discordId: string,
    step: ProgressStep,
  ): Promise<void> {
    const entry = await Q.waitlist.entry.get({ discordId });

    await Q.waitlist.entry.update({ id: entry.id }, { [step]: true });

    await this.updateProgressEmbed(entry.id);
  }

  // ============================================================================
  // REGISTRATION & INVITATION
  // ============================================================================

  /**
   * Registers a new user to the waitlist with full notification flow
   *
   * Two modes based on capacity:
   * - Under capacity (open mode): Auto-accepted, token generated, no email sent
   * - At/over capacity (waitlist mode): Pending status, confirmation email sent
   *
   * @param data - User registration data
   * @returns Registration result with auto-accept status
   */
  async register(data: WaitlistEntryCreate): Promise<RegistrationResult> {
    const shouldAutoAccept = await this.hasCapacity();

    if (shouldAutoAccept) {
      const token = crypto.randomBytes(32).toString("hex");

      const entry = await Q.waitlist.entry.createAndReturn({
        email: data.email,
        discordName: data.discordName,
        metadata: data.metadata,
        token,
        status: "auto_accepted",
        acceptedAt: new Date(),
        acceptedBy: config.discord.bots.main.id,
      });

      logger.info(
        `New waitlist entry (auto-accepted): ${data.discordName} - ID: ${entry.id}`,
      );

      const messageId = await this.notifyAdmins(entry, true);
      if (messageId) {
        await Q.waitlist.entry.update(
          { id: entry.id },
          { discordMessageId: messageId },
        );
      }

      return {
        entry,
        autoAccepted: true,
        token,
      };
    } else {
      const entry = await Q.waitlist.entry.createAndReturn({
        email: data.email,
        discordName: data.discordName,
        metadata: data.metadata,
      });

      logger.info(
        `New waitlist entry (pending): ${data.email} (${data.discordName}) - ID: ${entry.id}`,
      );

      const messageId = await this.notifyAdmins(entry, false);
      if (messageId) {
        await Q.waitlist.entry.update(
          { id: entry.id },
          { discordMessageId: messageId },
        );
      }

      if (data.email) {
        await email.sendTemplate(
          data.email,
          EmailTemplate.WAITLIST_CONFIRMATION,
          {
            discordName: data.discordName,
          },
        );
      }

      return {
        entry,
        autoAccepted: false,
      };
    }
  }

  /**
   * Manually invites a user (called by admin action)
   *
   * @param entryId - Waitlist entry ID
   * @param adminId - Discord ID of admin who approved
   */
  async manualInvite(entryId: number, adminId: string): Promise<WaitlistEntry> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    let token = entry.token;
    if (!token) {
      token = crypto.randomBytes(32).toString("hex");
    }

    await Q.waitlist.entry.update(
      { id: entry.id },
      {
        token,
        status: "accepted",
        acceptedAt: new Date(),
        acceptedBy: adminId,
      },
    );

    if (entry.email) {
      await email.sendTemplate(entry.email, EmailTemplate.WAITLIST_INVITATION, {
        discordName: entry.discordName,
        token,
      });
    }

    await this.updateProgressEmbed(entryId);

    logger.info(
      `Manually invited waitlist entry #${entryId} by admin ${adminId}`,
    );

    return Q.waitlist.entry.get({ id: entryId });
  }

  // ============================================================================
  // ADMIN RETRIEVAL
  // ============================================================================

  /**
   * Gets detailed waitlist entry information for admin panel
   *
   * @param entryId - Waitlist entry ID
   * @returns Promise resolving to waitlist entry
   */
  async getDetailed(entryId: number): Promise<WaitlistEntry> {
    return await Q.waitlist.entry.get({ id: entryId });
  }

  /**
   * Gets all waitlist entries with filtering and pagination
   * (For admin list view)
   */
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

  /**
   * Counts waitlist entries matching filters
   */
  async count(filters?: WaitlistEntryFilters): Promise<number> {
    return await Q.waitlist.entry.count(filters);
  }

  // ============================================================================
  // ADMIN DELETION
  // ============================================================================

  /**
   * Deletes a waitlist entry with admin audit logging
   *
   * @param entryId - Waitlist entry ID
   * @param adminDiscordId - Admin performing the deletion
   * @param adminDiscordUsername - Admin username
   * @param reason - Reason for deletion
   */
  async adminDelete(
    entryId: number,
    adminDiscordId: string,
    adminDiscordUsername: string,
    reason: string,
  ): Promise<void> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    await db.inTransaction(async (tx) => {
      await tx.admin.log.action.create({
        adminDiscordId,
        adminDiscordUsername,
        actionType: AdminEdit.DELETE_WAITLIST,
        targetPlayerUuid: "00000000-0000-0000-0000-000000000000",
        targetPlayerName: entry.discordName,
        tableName: DatabaseTable.WAITLIST_ENTRY.TABLE,
        fieldName: "deleted",
        oldValue: "false",
        newValue: "true",
        reason,
        metadata: {
          email: entry.email,
          discordName: entry.discordName,
          status: entry.status,
        },
      });

      await tx.waitlist.entry.delete({ id: entryId });

      logger.info(
        `Admin ${adminDiscordUsername} deleted waitlist entry #${entryId} (${entry.email || entry.discordName})`,
      );
    });
  }

  // ============================================================================
  // PROGRESS TRACKING
  // ============================================================================

  /**
   * Updates the Discord message with current progress
   *
   * @param entryId - Waitlist ID to update the progress for
   * @returns Promise resolving when the progress is updated
   */
  async updateProgressEmbed(entryId: number): Promise<void> {
    try {
      const entry = await Q.waitlist.entry.get({ id: entryId });

      if (!entry.discordMessageId) {
        logger.warn(`No Discord message ID for entry ${entryId}`);
        return;
      }

      let discordUser = null;
      let player = null;

      if (entry.discordId) {
        try {
          discordUser = await Discord.Users.fetch(entry.discordId);
        } catch (error) {
          logger.warn(
            `Failed to fetch Discord user ${entry.discordId}:`,
            error,
          );
        }

        try {
          player = await Q.player.find({ discordId: entry.discordId });
        } catch (error) {
          logger.debug(`No player found for Discord ID ${entry.discordId}`);
        }
      }

      const progressEmbed = EmbedPresets.waitlist
        .createProgressEmbed(entry, discordUser, player)
        .timestamp();

      await Discord.Messages.edit({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        messageId: entry.discordMessageId,
        embeds: progressEmbed.build(),
        components: [],
      });

      logger.debug(`Updated progress embed for entry ${entryId}`);
    } catch (error) {
      logger.error(
        `Failed to update progress embed entry for ${entryId}:`,
        error,
      );
    }
  }

  async markJoinedDiscord(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.JOINED_DISCORD);
  }

  async markVerified(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.VERIFIED);
  }

  async markRegistered(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.REGISTERED);
  }

  async markJoinedMinecraft(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.JOINED_MINECRAFT);
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Gets overall waitlist statistics for admin dashboard
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    autoAccepted: number;
    rejected: number;
    verified: number;
    registered: number;
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
      pending,
      accepted,
      autoAccepted,
      rejected,
      verified,
      registered,
      joinedMinecraft,
      submittedToday,
      submittedThisWeek,
      submittedThisMonth,
    ] = await Promise.all([
      Q.waitlist.entry.count(),
      Q.waitlist.entry.count({ status: "pending" }),
      Q.waitlist.entry.count({ status: "accepted" }),
      Q.waitlist.entry.count({ status: "auto_accepted" }),
      Q.waitlist.entry.count({ status: "declined" }),
      Q.waitlist.entry.count({ verified: true }),
      Q.waitlist.entry.count({ registered: true }),
      Q.waitlist.entry.count({ joinedMinecraft: true }),
      Q.waitlist.entry.count({ submittedAt: { $gte: today } }),
      Q.waitlist.entry.count({ submittedAt: { $gte: weekAgo } }),
      Q.waitlist.entry.count({ submittedAt: { $gte: monthAgo } }),
    ]);

    return {
      total,
      pending,
      accepted,
      autoAccepted,
      rejected,
      verified,
      registered,
      joinedMinecraft,
      submitted: {
        today: submittedToday,
        thisWeek: submittedThisWeek,
        thisMonth: submittedThisMonth,
      },
    };
  }
}
