import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { getSkinApiClient } from "@/services/skin-api";
import { KNOWN_POSES, type KnownPose } from "createrington-skin-api";
import {
  AttachmentBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

const KNOWN_POSE_SET = new Set<string>(KNOWN_POSES);

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
  const pose = poseInput as KnownPose | undefined;

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
    const skinApi = getSkinApiClient();
    const png = await skinApi.render({
      pose,
      source: { uuid: player.minecraftUuid },
    });

    const fileName = `${player.minecraftUsername}_${pose}.png`;
    const attachment = new AttachmentBuilder(Buffer.from(png), {
      name: fileName,
    });

    const embed = EmbedPresets.info(
      `${player.minecraftUsername} — ${titleCasePose(pose)}`,
    )
      .image(`attachment://${fileName}`)
      .build();

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  } catch (err) {
    logger.warn(`Skin-api render failed for pose "${pose}":`, err);
    await replyError(
      interaction,
      "Render Error",
      `Could not render the **${titleCasePose(pose)}** pose for ${player.minecraftUsername}. Please try again later.`,
    );
  }
}
