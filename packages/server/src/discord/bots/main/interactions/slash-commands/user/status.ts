import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { getService, Services } from "@/services";
import {
  getAllServerIds,
  getServerById,
} from "@/services/playtime/config";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show game server status and online player counts");

export const cooldown = {
  duration: 10,
  type: CooldownType.USER,
  message: "Please wait before checking status again!",
};

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    const playtimeManager = await getService(
      Services.PLAYTIME_MANAGER_SERVICE,
    );

    const serverIds = getAllServerIds();
    let totalOnline = 0;
    const serverLines: string[] = [];

    for (const serverId of serverIds) {
      const serverConfig = getServerById(serverId);
      const playtimeService = playtimeManager.getService(serverId);

      if (!serverConfig || !playtimeService) continue;

      const state = playtimeService.getServerState();
      const onlineCount = playtimeService.getOnlineCount();
      totalOnline += onlineCount;

      const statusIcon = state === "online" ? "🟢" : "🔴";
      const playerText =
        state === "online"
          ? `${onlineCount}/${serverConfig.maxPlayers} players`
          : "Offline";

      serverLines.push(`${statusIcon} **${serverConfig.name}** — ${playerText}`);
    }

    const description =
      serverLines.length > 0
        ? serverLines.join("\n")
        : "No servers configured.";

    const embed = EmbedPresets.info("Server Status", description)
      .field("Total Online", `${totalOnline} player${totalOnline !== 1 ? "s" : ""}`)
      .timestamp();

    await interaction.reply({ embeds: [embed.build()] });
  } catch (error) {
    logger.error("/status failed:", error);

    const embed = EmbedPresets.error(
      "Status Error",
      "Failed to fetch server status. Please try again.",
    );
    await interaction.reply({ embeds: [embed.build()] });
  }
}
