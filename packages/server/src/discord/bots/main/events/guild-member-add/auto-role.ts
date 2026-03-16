import config from "@/config";
import type {
  Client,
  GuildMember,
  OverwriteResolvable,
  TextChannel,
} from "discord.js";
import { PermissionFlagsBits, ChannelType } from "discord.js";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { Q } from "@/db";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { Discord } from "@/discord/constants";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import {
  generateCustomWelcomeCard,
  generateWelcomeCard,
} from "@/discord/utils/welcome-card";

const autoRoleConfig = config.discord.events.onGuildMemberAdd.autoRole;
const welcomeConfig = config.discord.events.onGuildMemberAdd.welcome;

/**
 * Guild member join event handler
 *
 * Handles the onboarding flow for members:
 * 1. Records the member join in the database (gets persistent join number)
 * 2. If the player already exists in the database, assigns the "Verified" role (skips verification)
 * 3. Otherwise, assigns "Unverified" role and creates a private verification channel
 * 4. Sends a welcome card to the public welcome channel
 */
export const eventName: EventModule<"guildMemberAdd">["eventName"] =
  "guildMemberAdd";

export const prodOnly = false;

/**
 * Executes when a new member joins the guild
 *
 * @param client - The Discord client instance
 * @param member - The guild member who joined
 */
export async function execute(
  client: Client,
  member: GuildMember,
): Promise<void> {
  try {
    const joinNumber = await Q.discord.guild.member.join.recordJoin(
      member.user.id,
      member.user.username,
    );

    logger.info(`Member ${member.user.tag} joined - Join #${joinNumber}`);

    const existingPlayer = await Q.player.exists({
      discordId: member.user.id,
    });

    if (existingPlayer) {
      logger.info(
        `Member ${member.user.tag} already exists in the database, skipping verification`,
      );

      try {
        await RoleManager.assign(
          member,
          Discord.Roles.VERIFIED,
          "Returning player - auto-verified on rejoin",
        );
      } catch (error) {
        logger.error(
          `Error assigning verified role to returning player ${member.user.tag}:`,
          error,
        );
      }
    } else {
      if (autoRoleConfig.enabled && autoRoleConfig.roleId) {
        try {
          await RoleManager.assign(
            member,
            autoRoleConfig.roleId,
            "Auto-assigned on join",
          );
        } catch (error) {
          logger.error(
            `Error assigning auto-role to ${member.user.tag}:`,
            error,
          );
        }
      }

      try {
        // Channel is private: hidden from everyone, visible only to the joining member and admins
        const permissionOverwrites: OverwriteResolvable[] = [
          {
            id: member.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.UseApplicationCommands,
            ],
          },
          {
            id: Discord.Roles.ADMIN,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
            ],
          },
          {
            id: Discord.Roles.OWNER,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ];

        const verificationChannel = await member.guild.channels.create({
          name: `verify-${joinNumber}`,
          type: ChannelType.GuildText,
          parent: Discord.Categories.VERIFICATION,
          permissionOverwrites,
          topic: `Verification channel for ${member.user.tag} (Join #${joinNumber})`,
        });

        logger.info(
          `Created verification channel ${verificationChannel.name} for ${member.user.tag}`,
        );

        await verificationChannel.send({
          content: `Welcome ${member}! 👋\n\nTo get started, please verify your account using the \`/verify <token>\` command with the token from your email.\n\nIf you don't have a token yet, you'll need to join our waitlist first at <https://create-rington.com/apply-to-join>`,
        });

        logger.info(
          `Verification instructions sent to ${verificationChannel.name} for ${member.user.tag}`,
        );
      } catch (error) {
        logger.error(
          `Failed to create verification channel for ${member.user.tag}`,
          error,
        );
      }
    }

    if (welcomeConfig.enabled && welcomeConfig.channelId) {
      try {
        const channel = await client.channels.fetch(welcomeConfig.channelId);

        if (!channel || !isSendableChannel(channel)) {
          logger.warn(
            `Welcome channel ${welcomeConfig.channelId} not found or is not a text channel`,
          );
          return;
        }

        const textChannel = channel as TextChannel;

        // Use a custom background if configured, otherwise fall back to the default card
        const welcomeCard = welcomeConfig.imageConfig.backgroundImageURL
          ? await generateCustomWelcomeCard(member, joinNumber, {
              backgroundImageURL: welcomeConfig.imageConfig.backgroundImageURL,
              config: welcomeConfig.imageConfig,
            })
          : await generateWelcomeCard(
              member,
              joinNumber,
              welcomeConfig.imageConfig,
            );

        logger.debug("Generated welcome card:", {
          hasBuffer: welcomeCard.attachment instanceof Buffer,
          bufferSize:
            welcomeCard.attachment instanceof Buffer
              ? welcomeCard.attachment.length
              : 0,
          name: welcomeCard.name,
        });

        const sentMessage = await textChannel.send({
          files: [welcomeCard],
        });

        logger.info(
          `Welcome image sent for ${member.user.tag} (#${joinNumber}) - Message ID: ${sentMessage.id}`,
        );
      } catch (error) {
        logger.error(
          `Failed to send welcome message for ${member.user.tag}:`,
          error,
        );
      }
    }
  } catch (error) {
    logger.error(
      `Failed to process guild member join for ${member.user.tag}:`,
      error,
    );
  }
}
