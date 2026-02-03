import config from "@/config";
import { Q } from "@/db";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { WaitlistEntry, WaitlistEntryCreate } from "@/generated/db";
import { email, EmailTemplate } from "@/services/email";
import { WaitlistStatus } from "@/generated/db";
import crypto from "node:crypto";

interface RegistrationResult {
  entry: WaitlistEntry;
  autoInvited: boolean;
  token?: string;
}

export enum ProgressStep {
  JOINED_DISCORD = "joinedDiscord",
  VERIFIED = "verified",
  REGISTERED = "registered",
  JOINED_MINECRAFT = "joinedMinecraft",
}

export class WaitlistRepository {
  /**
   * Registers a new user to the waitlist with full notification flow
   *
   * Handles:
   * - Entry creation
   * - Auto-invite check
   * - Token generation
   * - Email notifications
   * - Discord notifications
   *
   * @param data - User registration data
   * @returns Registration result with auto-invite status
   */
  async register(data: WaitlistEntryCreate): Promise<RegistrationResult> {
    const entry = await Q.waitlist.entry.createAndReturn({
      email: data.email,
      discordName: data.discordName,
    });

    logger.info(
      `New waitlist entry: ${data.email} (${data.discordName}) - ID: ${entry.id}`,
    );

    const shouldAutoInvite = await this.checkAutoInviteEligibility();

    if (shouldAutoInvite) {
      try {
        const token = await this.autoInvite(entry.id);

        const messageId = await this.notifyAdmins(entry, true);
        if (messageId) {
          await Q.waitlist.entry.update(
            { id: entry.id },
            { discordMessageId: messageId },
          );
        }
        logger.info(`Auto-invited waitlist entry #${entry.id}`);

        return {
          entry: { ...entry, token },
          autoInvited: true,
          token,
        };
      } catch (error) {
        logger.error(`Auto-invite failed for entry ${entry.id}:`, error);

        const messageId = await this.notifyAdmins(entry, false);
        if (messageId) {
          await Q.waitlist.entry.update(
            { id: entry.id },
            { discordMessageId: messageId },
          );
        }

        return {
          entry,
          autoInvited: false,
        };
      }
    } else {
      const messageId = await this.notifyAdmins(entry, false);
      if (messageId) {
        await Q.waitlist.entry.update(
          { id: entry.id },
          { discordMessageId: messageId },
        );
      }

      await email.sendTemplate(
        data.email,
        EmailTemplate.WAITLIST_CONFIRMATION,
        {
          discordName: data.discordName,
        },
      );

      return {
        entry,
        autoInvited: false,
      };
    }
  }

  /**
   * Auto-invites a user
   * Generates token, updates entry, sends emails and Discord notifications
   *
   * @param entryId - Waitlist entry ID
   * @returns Generated token
   * @private
   */
  private async autoInvite(entryId: number): Promise<string> {
    const entry = await Q.waitlist.entry.get({ id: entryId });

    const token = crypto.randomBytes(32).toString("hex");

    await Q.waitlist.entry.update(
      { id: entryId },
      {
        token,
        status: WaitlistStatus.ACCEPTED,
        acceptedAt: new Date(),
        acceptedBy: config.discord.bots.main.id,
      },
    );

    await email.sendTemplate(entry.email, EmailTemplate.WAITLIST_INVITATION, {
      discordName: entry.discordName,
      token,
    });

    return token;
  }

  /**
   * Checks if auto-invite should be triggered
   * Based on current player count vs limit
   *
   * @returns True if should auto-invite
   * @private
   */
  private async checkAutoInviteEligibility(): Promise<boolean> {
    try {
      const currentPlayers = await Q.player.count();

      const playerLimit = config.servers.playerLimit;

      const hasCapacity =
        Number.isFinite(playerLimit) && playerLimit > currentPlayers;

      logger.debug(
        `Auto-invite check: players=${currentPlayers}, limit=${playerLimit}, hasCapacity=${hasCapacity}`,
      );

      return hasCapacity;
    } catch (error) {
      logger.error("Failed to check auto-invite eligibility:", error);
      return false;
    }
  }

  /**
   * Notifies admins in Discord about new waitlist entry
   *
   * @param entry - Waitlist entry
   * @param autoInvited - Whether the user was autoInvited
   * @private
   */
  private async notifyAdmins(
    entry: WaitlistEntry,
    autoInvited: boolean,
  ): Promise<string | null> {
    try {
      if (autoInvited) {
        const { embed, components, content } =
          EmbedPresets.waitlist.autoInviteNotification({
            id: entry.id,
            email: entry.email,
            discordName: entry.discordName,
            success: true,
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
          `Admin notification sent for entry #${entry.id} (autoInvited: ${autoInvited})`,
        );

        return result.messageId || null;
      }
    } catch (error) {
      logger.error("Failed to notify admins:", error);
      return null;
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
        status: WaitlistStatus.ACCEPTED,
        acceptedAt: new Date(),
        acceptedBy: adminId,
      },
    );

    await email.sendTemplate(entry.email, EmailTemplate.WAITLIST_INVITATION, {
      discordName: entry.discordName,
      token,
    });

    await this.updateProgressEmbed(entryId);

    logger.info(
      `Manually invited waitlist entry #${entryId} by admin ${adminId}`,
    );

    return Q.waitlist.entry.get({ id: entryId });
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
}
