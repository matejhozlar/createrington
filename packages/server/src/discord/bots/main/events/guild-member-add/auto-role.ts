import config from "@/config";
import type {
  Client,
  GuildMember,
  OverwriteResolvable,
  TextChannel,
} from "discord.js";
import { PermissionFlagsBits, ChannelType } from "discord.js";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { Q, waitlistRepo } from "@/db";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import {
  generateCustomWelcomeCard,
  generateWelcomeCard,
} from "@/discord/utils/welcome-card";
import { diffAndUpdateInvites } from "@/discord/bots/main/invites";

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

export const prodOnly = true;

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

    // Cancel any active departure record so the 30-day deletion doesn't fire
    try {
      const activeDeparture = await Q.discord.guild.member.leave.findActive(
        member.user.id,
      );

      if (activeDeparture) {
        await Q.discord.guild.member.leave.update(
          { id: activeDeparture.id },
          { deletedAt: new Date() },
        );

        logger.info(
          `Cancelled departure record #${activeDeparture.id} for returning member ${member.user.tag}`,
        );

        // Update the admin notification embed
        if (activeDeparture.notificationMessageId) {
          try {
            const result = await Discord.Messages.fetchMessage({
              channelId: Discord.Channels.administration.NOTIFICATIONS,
              messageId: activeDeparture.notificationMessageId,
            });

            if (result.success) {
              const returnedEmbed = EmbedPresets.departed.returned({
                minecraftUsername: activeDeparture.minecraftUsername,
                departedAt: activeDeparture.departedAt,
                returnedAt: new Date(),
              });

              await result.message.edit({
                embeds: [returnedEmbed.build()],
                components: [],
              });
            }
          } catch (error) {
            logger.warn(
              `Could not update departure notification for ${activeDeparture.minecraftUsername}:`,
              error,
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        `Failed to cancel departure record for ${member.user.tag}:`,
        error,
      );
    }

    // Match the join against any single-use waitlist invite so the entry
    // can be auto-linked to this Discord account without requiring /verify.
    try {
      const consumedCode = await diffAndUpdateInvites(member.guild);
      if (consumedCode) {
        const entry = await Q.waitlist.entry.find({ inviteCode: consumedCode });
        if (entry) {
          await Q.waitlist.entry.update(
            { id: entry.id },
            {
              discordId: member.user.id,
              joinedDiscord: true,
              verified: true,
              email: null,
            },
          );
          await waitlistRepo.updateProgressEmbed(entry.id);
          logger.info(
            `Linked waitlist entry #${entry.id} to Discord user ${member.user.tag} via invite ${consumedCode}`,
          );
        }
      }
    } catch (error) {
      logger.error(
        `Failed to match waitlist invite for ${member.user.tag}:`,
        error,
      );
    }

    const existingPlayer = await Q.player.find({
      discordId: member.user.id,
    });

    if (existingPlayer) {
      logger.info(
        `Member ${member.user.tag} already exists in the database, skipping verification`,
      );

      try {
        await RoleManager.assign(
          member,
          [Discord.Roles.VERIFIED, Discord.Roles.COGS_AND_STEAM],
          "Returning player - auto-verified on rejoin",
        );
      } catch (error) {
        logger.error(
          `Error assigning verified role to returning player ${member.user.tag}:`,
          error,
        );
      }

      // Sync Discord nickname to Minecraft username
      try {
        await member.setNickname(
          existingPlayer.minecraftUsername,
          "Returning player: sync to MC name",
        );
      } catch (error) {
        logger.warn(
          `Could not set nickname for returning player ${member.user.tag}:`,
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
          content:
            `## 👋 Welcome ${member}!\n\n` +
            `To finish onboarding, link your Minecraft account with \`/register <your_mc_name>\`.\n\n` +
            `> **Example:** \`/register Steve\`\n\n` +
            `### Haven't applied yet?\n` +
            `Apply first at <https://create-rington.com/apply-to-join>`,
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
