import { createEmbed, EmbedColors, EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { replyError } from "@/discord/utils/interaction-reply";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  type Role,
  SlashCommandBuilder,
} from "discord.js";
import {
  getUnassignableReason,
  ROLE_PANEL_BUTTON_PREFIX,
  ROLE_PANEL_MAX_ROLES,
} from "../../../config/role-panel";

const BUTTONS_PER_ROW = 5;
const BUTTON_LABEL_MAX_LENGTH = 80;
const DEFAULT_TITLE = "Role Picker";

const builder = new SlashCommandBuilder()
  .setName("role-panel")
  .setDescription(
    "Post a panel where members toggle the chosen roles with buttons",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

for (let i = 1; i <= ROLE_PANEL_MAX_ROLES; i++) {
  builder.addRoleOption((opt) =>
    opt
      .setName(`role${i}`)
      .setDescription(
        i === 1 ? "Role members can pick" : "Another role members can pick",
      )
      .setRequired(i === 1),
  );
}

builder
  .addStringOption((opt) =>
    opt
      .setName("title")
      .setDescription(`Panel title (default: ${DEFAULT_TITLE})`)
      .setMaxLength(100),
  )
  .addStringOption((opt) =>
    opt
      .setName("message_id")
      .setDescription(
        "Message ID of an existing panel to update (sends new if omitted)",
      ),
  );

export const data = builder;

export const permissions = {
  requireOwner: true,
};

function collectRoles(
  interaction: ChatInputCommandInteraction<"cached">,
): Role[] {
  const roles = new Map<string, Role>();

  for (let i = 1; i <= ROLE_PANEL_MAX_ROLES; i++) {
    const role = interaction.options.getRole(`role${i}`);
    if (role) roles.set(role.id, role);
  }

  return [...roles.values()];
}

function buildRows(roles: Role[]): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = roles.map((role) =>
    new ButtonBuilder()
      .setCustomId(`${ROLE_PANEL_BUTTON_PREFIX}:${role.id}`)
      .setLabel(role.name.slice(0, BUTTON_LABEL_MAX_LENGTH))
      .setStyle(ButtonStyle.Secondary),
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttons.slice(i, i + BUTTONS_PER_ROW),
      ),
    );
  }

  return rows;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    if (!interaction.inCachedGuild()) {
      await replyError(
        interaction,
        "Server Only",
        "This command can only be used in a server.",
      );
      return;
    }

    if (!isSendableChannel(interaction.channel)) {
      await replyError(
        interaction,
        "Invalid Channel",
        "This command can only be used in text channels.",
      );
      return;
    }

    const roles = collectRoles(interaction);
    const me = await interaction.guild.members.fetchMe();

    const rejected = roles.flatMap((role) => {
      const reason = getUnassignableReason(role, me);
      return reason ? [`${role} ${reason}`] : [];
    });

    if (rejected.length > 0) {
      await replyError(
        interaction,
        "Roles Not Allowed",
        `These roles cannot be self-assigned:\n${rejected.join("\n")}`,
      );
      return;
    }

    const title = interaction.options.getString("title") ?? DEFAULT_TITLE;

    const embed = createEmbed()
      .title(title)
      .description(
        "Click a button to get a role, click it again to remove it. You can pick as many as you like.\n\n" +
          roles.map((role) => `- ${role}`).join("\n"),
      )
      .color(EmbedColors.Info);

    const payload = { embeds: [embed.build()], components: buildRows(roles) };
    const messageId = interaction.options.getString("message_id");

    if (messageId) {
      const existing = await interaction.channel.messages
        .fetch(messageId)
        .catch(() => null);

      if (!existing) {
        await replyError(
          interaction,
          "Message Not Found",
          `Could not find message with ID \`${messageId}\` in this channel.`,
        );
        return;
      }

      await existing.edit(payload);

      const successEmbed = EmbedPresets.success(
        "Panel Updated",
        `Role panel has been updated with ${roles.length} role(s)`,
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${interaction.user.tag} updated role panel (${messageId}) with ${roles.length} role(s)`,
      );
    } else {
      await interaction.channel.send(payload);

      const successEmbed = EmbedPresets.success(
        "Panel Created",
        `Role panel has been created with ${roles.length} role(s)`,
      );
      await interaction.reply({
        embeds: [successEmbed.build()],
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        `${interaction.user.tag} created role panel with ${roles.length} role(s)`,
      );
    }
  } catch (error) {
    logger.error("/role-panel failed:", error);

    await replyError(
      interaction,
      "Panel Creation Failed",
      "Failed to create the role panel. Please try again.",
    );
  }
}
