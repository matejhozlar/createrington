import config from "@/config";
import type { Client, GuildMember } from "discord.js";
import type { EventModule } from "@/discord/bots/common/loaders/event-loader";
import { Q, waitlistRepo } from "@/db";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import { RegistrationComponentPresets } from "@/discord/components/presets/registration";
import { WaitlistComponentPresets } from "@/discord/components/presets/waitlist";
import { createVerificationChannel } from "@/discord/bots/main/registration/verification-channel";

const autoRoleConfig = config.discord.events.onGuildMemberAdd.autoRole;

/**
 * Guild member join event handler
 *
 * Handles the onboarding flow for members:
 * 1. Records the member join in the database (gets persistent join number)
 * 2. If the player already exists in the database, assigns the "Verified" role (skips verification)
 * 3. Otherwise, assigns "Unverified" role and creates a private verification channel
 *
 * The welcome card is sent after registration completes (see
 * registration/post-welcome-card.ts), not on guild join.
 */
export const eventName: EventModule<"guildMemberAdd">["eventName"] =
  "guildMemberAdd";

export const prodOnly = true;

/**
 * Executes when a new member joins the guild
 *
 * @param member - The guild member who joined
 */
export async function execute(
  _client: Client,
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
        const verificationChannel = await createVerificationChannel(
          member,
          joinNumber,
        );

        logger.info(
          `Created verification channel ${verificationChannel.name} for ${member.user.tag}`,
        );

        const hasCapacity = await waitlistRepo.hasCapacity();
        const welcome = hasCapacity
          ? RegistrationComponentPresets.idle({ memberMention: `${member}` })
          : WaitlistComponentPresets.queueOffer({
              memberMention: `${member}`,
            });

        await verificationChannel.send({
          components: welcome.components,
          flags: welcome.flags,
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
  } catch (error) {
    logger.error(
      `Failed to process guild member join for ${member.user.tag}:`,
      error,
    );
  }
}
