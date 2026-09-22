import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { getSkinApiClient, MAX_QUALITY_RENDER } from "@/services/skin-api";
import {
  KNOWN_POSES,
  type KnownPose,
  type RenderStyle,
} from "createrington-skin-api";
import {
  AttachmentBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

const RENDER_STYLES = [
  "default",
  "cel",
] as const satisfies readonly RenderStyle[];

const KNOWN_POSE_SET = new Set<string>(KNOWN_POSES);
const RENDER_STYLE_SET = new Set<string>(RENDER_STYLES);
const STYLED_FALLBACK_POSE: KnownPose = "idle";

const STYLE_LABELS: Record<RenderStyle, string> = {
  default: "Default",
  cel: "Cel",
};

const STYLE_CHOICES = RENDER_STYLES.map((value) => ({
  name: STYLE_LABELS[value],
  value,
}));

function titleCasePose(pose: string): string {
  return pose.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const data = new SlashCommandBuilder()
  .setName("skin")
  .setDescription("Display a player's Minecraft skin")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to check").setRequired(false),
  )
  .addStringOption((opt) =>
    opt
      .setName("pose")
      .setDescription("Render the skin in a specific pose")
      .setRequired(false)
      .setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("style")
      .setDescription(
        "Render style (renders the idle pose when no pose is picked)",
      )
      .setRequired(false)
      .addChoices(...STYLE_CHOICES),
  );

export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking skins again!",
};

export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused().trim().toLowerCase();
  const matches = focused
    ? KNOWN_POSES.filter((pose) => pose.includes(focused))
    : KNOWN_POSES;

  await interaction.respond(
    matches.slice(0, 25).map((pose) => ({
      name: titleCasePose(pose),
      value: pose,
    })),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const userOption = interaction.options.getUser("user", false);
  const targetUser = userOption || interaction.user;
  const poseInput = interaction.options
    .getString("pose", false)
    ?.trim()
    .toLowerCase();

  if (poseInput && !KNOWN_POSE_SET.has(poseInput)) {
    await replyError(
      interaction,
      "Unknown Pose",
      `\`${poseInput}\` is not a recognized pose. Use the autocomplete suggestions to pick a valid one.`,
      { ephemeral: false },
    );
    return;
  }
  const styleInput = interaction.options.getString("style", false);
  const style: RenderStyle =
    styleInput && RENDER_STYLE_SET.has(styleInput)
      ? (styleInput as RenderStyle)
      : "default";
  const pose =
    (poseInput as KnownPose | undefined) ??
    (style === "default" ? undefined : STYLED_FALLBACK_POSE);

  let player: Awaited<ReturnType<typeof Q.player.get>>;
  try {
    player = await Q.player.get({ discordId: targetUser.id });
  } catch {
    await replyError(
      interaction,
      "Lookup Error",
      `Could not find player data for ${targetUser.displayName}. They may not be registered.`,
      { ephemeral: false },
    );
    return;
  }

  if (!pose) {
    const embed = EmbedPresets.info(`${player.minecraftUsername}'s Skin`)
      .image(`https://mc-heads.net/body/${player.minecraftUuid}`)
      .build();
    await interaction.reply({ embeds: [embed] });
    return;
  }

  await interaction.deferReply();

  try {
    const png = await getSkinApiClient().render({
      pose,
      source: { uuid: player.minecraftUuid },
      options: { ...MAX_QUALITY_RENDER, style },
    });

    const styleSuffix = style === "default" ? "" : `_${style}`;
    const fileName = `${player.minecraftUsername}_${pose}${styleSuffix}.png`;
    const attachment = new AttachmentBuilder(Buffer.from(png), {
      name: fileName,
    });

    const styleLabel = style === "default" ? "" : ` (${STYLE_LABELS[style]})`;
    const embed = EmbedPresets.info(
      `${player.minecraftUsername} — ${titleCasePose(pose)}${styleLabel}`,
    )
      .image(`attachment://${fileName}`)
      .build();

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } catch (error) {
    logger.warn(
      `Skin-api render failed for pose "${pose}" (style "${style}"):`,
      error,
    );
    await replyError(
      interaction,
      "Render Error",
      `Could not render the **${titleCasePose(pose)}** pose for ${player.minecraftUsername}. Please try again later.`,
    );
  }
}
