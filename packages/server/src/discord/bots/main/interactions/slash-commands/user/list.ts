import { EmbedPresets } from "@/discord/embeds";
import { getService, Services } from "@/services";
import { SERVERS } from "@/services/mc-server/servers";
import {
  type ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandModule } from "@/discord/bots/common/loaders/command-loader";

const data = new SlashCommandBuilder()
  .setName("list")
  .setDescription("List players on a server")
  .addStringOption((opt) =>
    opt
      .setName("server")
      .setDescription("Server to fetch players from")
      .setRequired(true)
      .addChoices(
        ...SERVERS.map((server) => ({
          name: server.name,
          value: String(server.id),
        })),
      ),
  );

async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const serverOpt = interaction.options.getString("server", true);
  const serverId = parseInt(serverOpt, 10);

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
}

export default {
  data,
  execute,
} satisfies CommandModule;
