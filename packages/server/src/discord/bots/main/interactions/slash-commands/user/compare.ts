import { playerRepo } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { formatPlaytime } from "@/utils/format";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the compare command
 * Displays a side-by-side comparison of two players' stats
 */
export const data = new SlashCommandBuilder()
  .setName("compare")
  .setDescription("Compare stats between two players")
  .addUserOption((opt) =>
    opt
      .setName("player1")
      .setDescription("First player")
      .setRequired(true),
  )
  .addUserOption((opt) =>
    opt
      .setName("player2")
      .setDescription("Second player (defaults to you)")
      .setRequired(false),
  );

/**
 * Cooldown configuration for the compare command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before comparing again!",
};

/**
 * Executes the compare command to show a side-by-side player comparison
 *
 * Process:
 * 1. Get both target users (player2 defaults to command initiator)
 * 2. Validate they are not the same user
 * 3. Fetch detailed stats for both players
 * 4. Reply with an embed comparing balance, playtime, sessions, and join date
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const user1 = interaction.options.getUser("player1", true);
  const user2 = interaction.options.getUser("player2", false) || interaction.user;

  if (user1.id === user2.id) {
    const embed = EmbedPresets.error(
      "Invalid Comparison",
      "You can't compare a player with themselves!",
    );
    await interaction.reply({ embeds: [embed.build()] });
    return;
  }

  try {
    const [details1, details2] = await Promise.all([
      playerRepo.getDetailed({ discordId: user1.id }),
      playerRepo.getDetailed({ discordId: user2.id }),
    ]);

    const name1 = details1.player.minecraftUsername;
    const name2 = details2.player.minecraftUsername;

    const bal1 = details1.balance
      ? BalanceUtils.formatTrimmed(details1.balance.balance)
      : "0";
    const bal2 = details2.balance
      ? BalanceUtils.formatTrimmed(details2.balance.balance)
      : "0";

    const pt1 = formatPlaytime(details1.playtime.totalSeconds);
    const pt2 = formatPlaytime(details2.playtime.totalSeconds);

    const sessions1 = details1.playtime.totalSessions.toLocaleString();
    const sessions2 = details2.playtime.totalSessions.toLocaleString();

    const joined1 = Math.floor(details1.player.createdAt.getTime() / 1000);
    const joined2 = Math.floor(details2.player.createdAt.getTime() / 1000);

    const embed = EmbedPresets.info(`${name1} vs ${name2}`)
      .field("Balance", `${name1}: $${bal1}\n${name2}: $${bal2}`, true)
      .field("Playtime", `${name1}: ${pt1}\n${name2}: ${pt2}`, true)
      .field("\u200b", "\u200b") // line break
      .field(
        "Sessions",
        `${name1}: ${sessions1}\n${name2}: ${sessions2}`,
        true,
      )
      .field(
        "Member Since",
        `${name1}: <t:${joined1}:D>\n${name2}: <t:${joined2}:D>`,
        true,
      );

    await interaction.reply({ embeds: [embed.build()] });
  } catch {
    const embed = EmbedPresets.error(
      "Comparison Error",
      "Could not fetch data for one or both players. They may not be registered.",
    );
    await interaction.reply({ embeds: [embed.build()] });
  }
}
