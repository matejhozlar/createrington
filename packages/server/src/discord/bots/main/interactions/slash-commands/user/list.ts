import { EmbedPresets } from "@/discord/embeds";
import { replyError } from "@/discord/utils/interaction-reply";
import { getService, Services } from "@/services";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

/**
 * Slash command definition for the list command
 *
 * Displays a list of users currently online on the server
 */
export const data = new SlashCommandBuilder()
  .setName("list")
  .setDescription("List players on a server")
  .addStringOption((opt) =>
    opt
      .setName("server")
      .setDescription("Server to fetch players from")
      .setRequired(true)
      .addChoices({ name: "Cogs & Steam", value: "1" }),
  );

/**
 * Executes the list command
 *
 * Process:
 * - Extracts the server option
 * - Maps the option to a server
 * - Fetches the player list from the PlaytimeService
 * - Displays an embed with the player list
 *
 * @param interaction - The chat input command interaction
 * @returns Promise resolving when the command execution is completed
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const serverOpt = interaction.options.getString("server", true);
  const serverId = parseInt(serverOpt, 10);

  try {
    const playtimeManager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

    const playtimeService = playtimeManager.getService(serverId);

    if (!playtimeService) {
      throw new Error(`Playtime service is not configured for this server`);
    }

    const activeSessions = playtimeService.getActiveSessions();

    const embed = EmbedPresets.commands.list(activeSessions, playtimeService);

    await interaction.reply({
      embeds: [embed.build()],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error("/list failed:", error);

    await replyError(
      interaction,
      "List Error",
      "Failed to fetch player list. Please try again.",
    );
  }
}
