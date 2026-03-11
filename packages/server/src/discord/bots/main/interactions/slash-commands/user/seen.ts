import { Q } from "@/db";
import { EmbedPresets } from "@/discord/embeds";
import { CooldownType } from "@/discord/utils/cooldown";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

/**
 * Slash command definition for the seen command
 * Displays a player's online status and last seen time
 */
export const data = new SlashCommandBuilder()
  .setName("seen")
  .setDescription("Check when a player was last online")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("User to check").setRequired(false),
  );

/**
 * Cooldown configuration for the seen command
 *
 * - duration: 5 seconds
 * - type: "user" - Each user has their own cooldown
 * - message: Custom message shown when the user is on cooldown
 */
export const cooldown = {
  duration: 5,
  type: CooldownType.USER,
  message: "Please wait before checking again!",
};

/**
 * Executes the seen command to display a player's online status
 *
 * Process:
 * 1. Get the target user (from option or command initiator)
 * 2. Fetch player record from the database
 * 3. If online, show current server; if offline, show last seen time
 * 4. Reply with status embed including avatar thumbnail
 *
 * @param interaction - The chat input command interaction
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const userOption = interaction.options.getUser("user", false);
  const targetUser = userOption || interaction.user;

  try {
    const player = await Q.player.get({ discordId: targetUser.id });

    const embed = EmbedPresets.info(`${player.minecraftUsername}'s Status`)
      .thumbnail(`https://mc-heads.net/avatar/${player.minecraftUuid}`)
      .field("Status", player.online ? "🟢 Online" : "🔴 Offline", true);

    if (player.online && player.currentServerId) {
      const server = await Q.server.find({ id: player.currentServerId });
      if (server) {
        embed.field("Server", server.name, true);
      }
    }

    if (!player.online) {
      const lastSeenUnix = Math.floor(player.lastSeen.getTime() / 1000);
      embed.field("Last Seen", `<t:${lastSeenUnix}:R>`, true);
    }

    const createdAtUnix = Math.floor(player.createdAt.getTime() / 1000);
    embed.field("Member Since", `<t:${createdAtUnix}:D>`);

    await interaction.reply({ embeds: [embed.build()] });
  } catch {
    const embed = EmbedPresets.error(
      "Lookup Error",
      `Could not find player data for ${targetUser.displayName}. They may not be registered.`,
    );

    await interaction.reply({ embeds: [embed.build()] });
  }
}
