import { createEmbed, EmbedColors, EmbedPresets } from "@/discord/embeds";
import { isSendableChannel } from "@/discord/utils/channel-guard";
import { replyError } from "@/discord/utils/interaction-reply";
import { getUnassignableReason } from "@/discord/utils/roles/self-assignable";
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
  getRolePanelPreset,
  ROLE_PANEL_BUTTON_PREFIX,
  ROLE_PANEL_MAX_ROLES,
  ROLE_PANEL_PRESETS,
  type RolePanelPreset,
} from "../../../config/role-panel";

const BUTTONS_PER_ROW = 5;
const BUTTON_LABEL_MAX_LENGTH = 80;
const DEFAULT_TITLE = "Role Picker";

interface PanelButton {
  roleId: string;
  label: string;
  emoji?: string;
}

interface Panel {
  embed: ReturnType<typeof createEmbed>;
  buttons: PanelButton[];
  style: ButtonStyle;
  summary: string;
}

const builder = new SlashCommandBuilder()
  .setName("role-panel")
  .setDescription(
    "Post a panel where members toggle the chosen roles with buttons",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("preset")
      .setDescription("Post a predefined panel instead of picking roles")
      .addChoices(
        ...ROLE_PANEL_PRESETS.map(({ id, label }) => ({
          name: label,
          value: id,
        })),
      ),
  );

for (let i = 1; i <= ROLE_PANEL_MAX_ROLES; i++) {
  builder.addRoleOption((opt) =>
    opt
      .setName(`role${i}`)
      .setDescription(
        i === 1 ? "Role members can pick" : "Another role members can pick",
      ),
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

function collectRoles(interaction: ChatInputCommandInteraction<"cached">): {
  roles: Role[];
  duplicates: number;
} {
  const roles = new Map<string, Role>();
  let selected = 0;

  for (let i = 1; i <= ROLE_PANEL_MAX_ROLES; i++) {
    const role = interaction.options.getRole(`role${i}`);
    if (!role) continue;
    selected++;
    roles.set(role.id, role);
  }

  return { roles: [...roles.values()], duplicates: selected - roles.size };
}

function describeSelection(roles: Role[], duplicates: number): string {
  const base = `${roles.length} role(s)`;
  return duplicates > 0
    ? `${base} (${duplicates} duplicate selection(s) ignored)`
    : base;
}

function buildRows(
  buttons: PanelButton[],
  style: ButtonStyle,
): ActionRowBuilder<ButtonBuilder>[] {
  const built = buttons.map(({ roleId, label, emoji }) => {
    const button = new ButtonBuilder()
      .setCustomId(`${ROLE_PANEL_BUTTON_PREFIX}:${roleId}`)
      .setLabel(label.slice(0, BUTTON_LABEL_MAX_LENGTH))
      .setStyle(style);
    return emoji ? button.setEmoji(emoji) : button;
  });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < built.length; i += BUTTONS_PER_ROW) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        built.slice(i, i + BUTTONS_PER_ROW),
      ),
    );
  }

  return rows;
}

function buildPresetPanel(
  preset: RolePanelPreset,
  title: string | null,
): Panel {
  const embed = createEmbed()
    .title(title ?? preset.title)
    .description(preset.description)
    .color(EmbedColors.Info);

  for (const role of preset.roles) {
    embed.field(`${role.emoji} ${role.label}`, role.description, false);
  }

  return {
    embed,
    buttons: preset.roles,
    style: ButtonStyle.Primary,
    summary: `the ${preset.label} preset (${preset.roles.length} role(s))`,
  };
}

function buildRolePanel(
  roles: Role[],
  duplicates: number,
  title: string | null,
): Panel {
  const embed = createEmbed()
    .title(title ?? DEFAULT_TITLE)
    .description(
      "Click a button to get a role, click it again to remove it. You can pick as many as you like.\n\n" +
        roles.map((role) => `- ${role}`).join("\n"),
    )
    .color(EmbedColors.Info);

  return {
    embed,
    buttons: roles.map((role) => ({ roleId: role.id, label: role.name })),
    style: ButtonStyle.Secondary,
    summary: describeSelection(roles, duplicates),
  };
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
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

  const me = await interaction.guild.members.fetchMe();

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await replyError(
      interaction,
      "Missing Permission",
      "I need the Manage Roles permission to hand out roles from a panel.",
    );
    return;
  }

  const presetId = interaction.options.getString("preset");
  const preset = presetId ? getRolePanelPreset(presetId) : undefined;
  const { roles, duplicates } = collectRoles(interaction);

  if (presetId && !preset) {
    await replyError(
      interaction,
      "Unknown Preset",
      `There is no role panel preset called \`${presetId}\`.`,
    );
    return;
  }

  if (preset && roles.length > 0) {
    await replyError(
      interaction,
      "Preset Or Roles",
      "Pick either a preset or roles, not both.",
    );
    return;
  }

  if (!preset && roles.length === 0) {
    await replyError(
      interaction,
      "No Roles",
      "Pick a preset or at least one role for the panel.",
    );
    return;
  }

  const title = interaction.options.getString("title");
  let panel: Panel;

  if (preset) {
    panel = buildPresetPanel(preset, title);
  } else {
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

    panel = buildRolePanel(roles, duplicates, title);
  }

  const payload = {
    embeds: [panel.embed.build()],
    components: buildRows(panel.buttons, panel.style),
  };
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
      `Role panel has been updated with ${panel.summary}`,
    );
    await interaction.reply({
      embeds: [successEmbed.build()],
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `${interaction.user.tag} updated role panel (${messageId}) with ${panel.summary}`,
    );
  } else {
    await interaction.channel.send(payload);

    const successEmbed = EmbedPresets.success(
      "Panel Created",
      `Role panel has been created with ${panel.summary}`,
    );
    await interaction.reply({
      embeds: [successEmbed.build()],
      flags: MessageFlags.Ephemeral,
    });

    logger.info(
      `${interaction.user.tag} created role panel with ${panel.summary}`,
    );
  }
}
