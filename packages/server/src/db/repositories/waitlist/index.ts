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

interface RegistrationResult {
  entry: WaitlistEntry;
  autoAccepted: boolean;
  inviteUrl?: string;
}

export enum ProgressStep {
  JOINED_DISCORD = "joinedDiscord",
  VERIFIED = "verified",
  REGISTERED = "registered",
  JOINED_MINECRAFT = "joinedMinecraft",
}

/**
 * Waitlist registration and onboarding tracking. Branches on current player
 * count to auto-accept (mint a Discord invite and email it) or queue
 * pending; drives the admin Discord embed that reflects each entry's
 * progress through join / verify / register / Minecraft milestones; and
 * sweeps unclaimed entries whose Discord invite expired. Capacity reads
 * fall closed when the player-count probe fails.
 */
export class WaitlistRepository {
  /**
   * True when the live player count is below configured player limit.
   * Returns false on any DB error so we fail closed and queue the user.
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

  private async updateProgressStep(
    discordId: string,
    step: ProgressStep,
  ): Promise<void> {
    const entry = await Q.waitlist.entry.get({ discordId });

    await Q.waitlist.entry.update({ id: entry.id }, { [step]: true });

    await this.updateProgressEmbed(entry.id);
  }

  /**
   * Register a new applicant. Under capacity: mint a one-use Discord invite,
   * persist as auto_accepted, notify admins, email the invitation. At/over
   * capacity: persist as pending and email the confirmation. Result flags
   * which path ran.
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
   * Create an auto_accepted entry for a Discord member who is registering
   * after already joining the guild. Pre-marks joinedDiscord and verified.
   * Caller must have already confirmed capacity.
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
   * Admin-driven acceptance of a pending entry. Always mints a fresh
   * one-use invite (never reuses an old one), promotes the entry to
   * accepted, and emails the invitation if an address is on file.
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

  /**
   * Delete accepted entries whose one-use Discord invite expired before the
   * applicant ever joined (discordId still NULL, inviteCode set). TTL is per
   * status: 1h after submission for auto_accepted, 7d after acceptance for
   * admin-accepted. Returns the number deleted.
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

  /**
   * Re-render the admin-channel progress embed for an entry. Silently
   * returns if the entry has no stored Discord message ID; errors are
   * logged and swallowed so onboarding flows are not blocked by Discord.
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

  /** Mark the "joined Minecraft" onboarding step as complete */
  async markJoinedMinecraft(discordId: string): Promise<void> {
    await this.updateProgressStep(discordId, ProgressStep.JOINED_MINECRAFT);
  }

  /** Dashboard stats: status breakdowns, milestone progress counts, submission trends. */
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
