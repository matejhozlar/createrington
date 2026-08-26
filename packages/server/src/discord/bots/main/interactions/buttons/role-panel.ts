import { type ButtonInteraction, MessageFlags } from "discord.js";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { getUnassignableReason } from "@/discord/utils/roles/self-assignable";
import { ROLE_PANEL_BUTTON_PREFIX } from "../../config/role-panel";

export const pattern = `${ROLE_PANEL_BUTTON_PREFIX}:*`;

export const prodOnly = false;

export async function execute(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [, roleId] = interaction.customId.split(":");

  if (!roleId) {
    await replyError(
      interaction,
      "Invalid Button",
      "This button is missing its role. Ask an admin to recreate the panel.",
    );
    return;
  }

  if (!interaction.inCachedGuild()) {
    await replyError(
      interaction,
      "Server Only",
      "This button can only be used in a server.",
    );
    return;
  }

  const role =
    interaction.guild.roles.cache.get(roleId) ??
    (await interaction.guild.roles.fetch(roleId).catch(() => null));

  if (!role) {
    await replyError(
      interaction,
      "Role Not Found",
      "This role no longer exists. Ask an admin to update the panel.",
    );
    return;
  }

  const me =
    interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
  const reason = getUnassignableReason(role, me);

  if (reason) {
    await replyError(
      interaction,
      "Role Unavailable",
      `${role} ${reason}, so it cannot be self-assigned.`,
    );
    return;
  }

  const member = interaction.member;
  const hasRole = RoleManager.has(member, role.id);

  try {
    if (hasRole) {
      const removed = await RoleManager.remove(
        member,
        role.id,
        "Role panel: removed by member",
      );

      if (!removed) {
        throw new Error("Failed to remove role");
      }

      const embed = EmbedPresets.success(
        "Role Removed",
        `You no longer have ${role}. Click the button again to get it back.`,
      );

      await interaction.editReply({ embeds: [embed.build()] });
    } else {
      const added = await RoleManager.assign(
        member,
        role.id,
        "Role panel: chosen by member",
      );

      if (!added) {
        throw new Error("Failed to assign role");
      }

      const embed = EmbedPresets.success(
        "Role Added",
        `You now have ${role}. Click the button again to remove it.`,
      );

      await interaction.editReply({ embeds: [embed.build()] });
    }
  } catch (error) {
    logger.error(
      `Failed to toggle role ${role.name} for ${member.user.tag}:`,
      error,
    );

    await replyError(
      interaction,
      "Action Failed",
      "Something went wrong while updating your roles. Please try again or contact an administrator.",
    );
  }
}
