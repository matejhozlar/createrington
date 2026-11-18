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

export const eventName: EventModule<"guildMemberAdd">["eventName"] =
  "guildMemberAdd";

export const prodOnly = true;

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
            const returnedEmbed = EmbedPresets.departed.returned({
              minecraftUsername: activeDeparture.minecraftUsername,
              departedAt: activeDeparture.departedAt,
              returnedAt: new Date(),
            });

            await Discord.Messages.edit({
              channelId: Discord.Channels.administration.NOTIFICATIONS,
              messageId: activeDeparture.notificationMessageId,
              embeds: returnedEmbed.build(),
              components: null,
            });
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
          Discord.Roles.VERIFIED,
          "Returning player - auto-verified on rejoin",
        );
      } catch (error) {
        logger.error(
          `Error assigning verified role to returning player ${member.user.tag}:`,
          error,
        );
      }

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
