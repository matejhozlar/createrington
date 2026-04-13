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
import {
  createOneUseInvite,
  INVITE_MAX_AGE_SECONDS,
} from "@/discord/bots/main/invites";

/** Result of a waitlist registration attempt */
interface RegistrationResult {
  entry: WaitlistEntry;
  autoAccepted: boolean;
  inviteUrl?: string;
}

/** Onboarding progress steps tracked per waitlist entry */
export enum ProgressStep {
  JOINED_DISCORD = "joinedDiscord",
  VERIFIED = "verified",
  REGISTERED = "registered",
  JOINED_MINECRAFT = "joinedMinecraft",
}

/**
 * Repository for waitlist and onboarding management
 *
 * Handles:
 * - Waitlist registration (auto-accept or pending based on capacity)
 * - Manual invitation by admins
 * - Onboarding progress tracking (Discord join, verification, registration, Minecraft join)
 * - Admin queries, deletion, and statistics
 */
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
            botMention: `<@${config.discord.bots.main.id}>`,
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
   * Updates a single onboarding progress step and refreshes the Discord embed
   *
   * @param discordId - Discord user ID to update progress step for
   * @param step - Progress step to mark as complete
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
      const { code: inviteCode, url: inviteUrl } = await createOneUseInvite(
        INVITE_MAX_AGE_SECONDS.AUTO_ACCEPT,
        "Waitlist auto-accept",
      );

      const entry = await Q.waitlist.entry.createAndReturn({
        email: data.email,
        discordName: data.discordName,
        metadata: data.metadata,
        inviteCode,
        status: "auto_accepted",
        acceptedAt: new Date(),
        acceptedBy: config.discord.bots.main.id,
      });

      logger.info(
        `New waitlist entry (auto-accepted): ${data.discordName ?? data.email ?? `#${entry.id}`} - ID: ${entry.id}`,
      );

      const messageId = await this.notifyAdmins(entry, true);
      if (messageId) {
        await Q.waitlist.entry.update(
          { id: entry.id },
          { discordMessageId: messageId },
        );
      }

      if (data.email) {
        await email.sendTemplate(
          data.email,
          EmailTemplate.WAITLIST_INVITATION,
          {
            discordName: data.discordName ?? null,
            inviteUrl,
          },
        );
      }

      return {
        entry,
        autoAccepted: true,
        inviteUrl,
      };
    } else {
      const entry = await Q.waitlist.entry.createAndReturn({
        email: data.email,
        discordName: data.discordName,
        metadata: data.metadata,
      });

      logger.info(
        `New waitlist entry (pending): ${data.email ?? "(no email)"} (${data.discordName ?? "(no discord name)"}) - ID: ${entry.id}`,
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
            discordName: data.discordName ?? null,
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
   * Creates an auto-accepted waitlist entry for a user who is already a guild
   * member when they run /register — i.e. they joined via the public Discord
   * invite rather than the waitlist flow. Marks the entry as already verified
   * and linked to Discord, and posts the progress embed to the admin channel.
   *
   * Caller must have already confirmed capacity.
   *
   * @param discordId - Discord user ID to link
   * @param discordName - Discord username for display
   * @returns The newly created waitlist entry
   */
  async registerForExistingMember(
    discordId: string,
    discordName: string,
  ): Promise<WaitlistEntry> {
    const entry = await Q.waitlist.entry.createAndReturn({
      email: null,
      discordName,
      discordId,
      status: "auto_accepted",
      joinedDiscord: true,
      verified: true,
      acceptedAt: new Date(),
      acceptedBy: config.discord.bots.main.id,
    });

    logger.info(
      `Auto-registered existing guild member ${discordName} (${discordId}) as waitlist entry #${entry.id}`,
    );

    const messageId = await this.notifyAdmins(entry, true);
    if (messageId) {
      await Q.waitlist.entry.update(
        { id: entry.id },
        { discordMessageId: messageId },
      );
      await this.updateProgressEmbed(entry.id);
    }

    return Q.waitlist.entry.get({ id: entry.id });
  }

  /**
   * Manually invites a user (called by admin action).
   * Generates a one-use Discord invite if none exists, then emails it to the user.
   *
   * @param entryId - Waitlist entry ID
   * @param adminId - Discord ID of admin who approved
   * @returns Updated waitlist entry with accepted status and generated invite code
   */
  async manualInvite(entryId: number, adminId: string): Promise<WaitlistEntry> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    // Always mint a fresh invite so we never email a link that's already
    // expired on Discord's side.
    const { code: inviteCode, url: inviteUrl } = await createOneUseInvite(
      INVITE_MAX_AGE_SECONDS.MANUAL_INVITE,
      `Waitlist manual invite by admin ${adminId}`,
    );

    await Q.waitlist.entry.update(
      { id: entry.id },
      {
        inviteCode,
        status: "accepted",
        acceptedAt: new Date(),
        acceptedBy: adminId,
      },
    );

    if (entry.email) {
      await email.sendTemplate(entry.email, EmailTemplate.WAITLIST_INVITATION, {
        discordName: entry.discordName,
        inviteUrl,
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
   * Gets all waitlist entries with filtering and pagination (for admin list view)
   *
   * @param filters - Optional waitlist entry filter criteria
   * @param options - Pagination and sorting options
   * @returns Array of waitlist entries matching the criteria
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
   *
   * @param filters - Optional waitlist entry filter criteria
   * @returns Total count
   */
  async count(filters?: WaitlistEntryFilters): Promise<number> {
    return await Q.waitlist.entry.count(filters);
  }

  // ============================================================================
  // AUTO CLEANUP
  // ============================================================================

  /**
   * Deletes accepted entries whose single-use Discord invite expired before the
   * applicant ever joined. Targets rows where `discordId` is still NULL and
   * `inviteCode` is set, applying the per-status TTL that matches how the
   * invite was issued:
   *
   * - `auto_accepted` — invite is 1 hour, so delete after submission + 1 hour
   * - `accepted` — invite is 7 days, so delete after acceptance + 7 days
   *
   * @returns The number of entries deleted
   */
  async sweepExpiredUnclaimedEntries(): Promise<number> {
    const now = Date.now();
    const autoAcceptCutoff = new Date(now - 60 * 60 * 1000); // 1 hour
    const manualAcceptCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000); // 7 days

    const [autoAccepted, adminAccepted] = await Promise.all([
      Q.waitlist.entry.findAll(
        {
          status: "auto_accepted",
          discordId: { $exists: false },
          inviteCode: { $exists: true },
          submittedAt: { $lt: autoAcceptCutoff },
        },
        { limit: 1000 },
      ),
      Q.waitlist.entry.findAll(
        {
          status: "accepted",
          discordId: { $exists: false },
          inviteCode: { $exists: true },
          acceptedAt: { $lt: manualAcceptCutoff },
        },
        { limit: 1000 },
      ),
    ]);

    const rows = [...autoAccepted, ...adminAccepted];
    for (const row of rows) {
      await Q.waitlist.entry.delete({ id: row.id });
    }

    if (rows.length > 0) {
      logger.info(
        `Swept ${rows.length} expired unclaimed waitlist entries (${autoAccepted.length} auto-accepted, ${adminAccepted.length} admin-accepted)`,
      );
    }

    return rows.length;
  }

  // ============================================================================
  // ADMIN DELETION
  // ============================================================================

  /**
   * Deletes a waitlist entry with admin audit logging
   *
   * @param entryId - Waitlist entry ID
   * @param adminDiscordId - Admin performing the deletion
   * @param adminUsername - Admin Minecraft username
   * @param reason - Reason for deletion
   */
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
        `Admin ${adminUsername} deleted waitlist entry #${entryId} (${entry.email || entry.discordName})`,
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
          logger.debug(
            `No player found for Discord ID ${entry.discordId}:`,
            error,
          );
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

  /** Mark the "joined Discord" onboarding step as complete */
  async markJoinedDiscord(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.JOINED_DISCORD);
  }

  /** Mark the "verified" onboarding step as complete */
  async markVerified(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.VERIFIED);
  }

  /** Mark the "registered" onboarding step as complete */
  async markRegistered(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.REGISTERED);
  }

  /** Mark the "joined Minecraft" onboarding step as complete */
  async markJoinedMinecraft(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.JOINED_MINECRAFT);
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Gets overall waitlist statistics for admin dashboard
   *
   * @returns Status breakdowns, milestone progress counts, and submission trends
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
