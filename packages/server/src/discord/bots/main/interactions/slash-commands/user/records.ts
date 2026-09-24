import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { ButtonPresets } from "@/discord/embeds/presets/buttons";
import { replyError } from "@/discord/utils/interaction-reply";
import { CooldownType } from "@/discord/utils/cooldown";
import { renderScreenshot } from "@/discord/utils/render-screenshot";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

const TITLE = "Record Holders";
const ATTACHMENT_NAME = "records.png";
const MEDALS = ["🥇", "🥈", "🥉"];

export const data = new SlashCommandBuilder()
  .setName("records")
  .setDescription("Show who places #1 across the most Minecraft stats");

export const cooldown = {
  duration: 10,
  type: CooldownType.USER,
  message: "Please wait before checking the records again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply();
  const links = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ButtonPresets.links.leaderboard(),
  );

  try {
    const screenshotBuffer = await renderScreenshot("records", {});

    if (screenshotBuffer) {
      const attachment = new AttachmentBuilder(screenshotBuffer, {
        name: ATTACHMENT_NAME,
      });

      const embed = EmbedPresets.info(TITLE).image(
        `attachment://${ATTACHMENT_NAME}`,
      );

      await interaction.editReply({
        embeds: [embed.build()],
        files: [attachment],
        components: [links],
      });
      return;
    }

    const { rows, contestedKeys } =
      await Q.player.minecraft.stat.total.getRecordLeaderboard(3);

    if (rows.length === 0) {
      await replyError(
        interaction,
        "No Data",
        "No stat is contested by two or more players yet.",
      );
      return;
    }

    const leaderboard = rows
      .map(
        (row, index) =>
          `${MEDALS[index]} **${row.minecraftUsername}** - ${row.records.toLocaleString("en-US")}`,
      )
      .join("\n");

    const embed = EmbedPresets.info(TITLE).field(
      `#1 placements across ${contestedKeys.toLocaleString("en-US")} contested stats`,
      leaderboard,
      false,
    );

    await interaction.editReply({
      embeds: [embed.build()],
      components: [links],
    });
  } catch (error) {
    logger.error("/records failed:", error);

    await replyError(
      interaction,
      "Records Error",
      "Could not fetch the record leaderboard.",
    );
  }
}
