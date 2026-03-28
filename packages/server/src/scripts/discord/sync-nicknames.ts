/**
 * Retroactive Discord Nickname Sync
 *
 * Sets all registered players' Discord server nicknames to their Minecraft
 * usernames. Uses the DiscordApiQueue to avoid hitting rate limits.
 *
 * Usage: pnpm tsx src/scripts/discord/sync-nicknames.ts
 */
import "@/logger.global";
import { Q } from "@/db";
import { Client, GatewayIntentBits } from "discord.js";
import { env } from "@/config/env/env.config";
import { DiscordApiQueue } from "./api-queue";

async function syncNicknames(): Promise<void> {
  console.log("=== Discord Nickname Sync ===\n");

  // Boot Discord client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  try {
    await client.login(env.DISCORD_MAIN_BOT_TOKEN);
    console.log(`✓ Logged in as ${client.user?.tag}`);

    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    console.log(`✓ Connected to guild: ${guild.name}\n`);

    // Fetch all registered players from DB
    const players = await Q.player.findAll({});
    console.log(`Found ${players.length} registered players\n`);

    if (players.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    // Pre-fetch all guild members so we can check membership
    console.log("Fetching guild members...");
    await guild.members.fetch();
    console.log(`✓ Fetched ${guild.members.cache.size} members\n`);

    const queue = new DiscordApiQueue({ delayMs: 1200 });
    let skipped = 0;
    let alreadyCorrect = 0;

    for (const player of players) {
      const member = guild.members.cache.get(player.discordId);

      if (!member) {
        skipped++;
        continue;
      }

      // Skip if nickname already matches
      if (member.nickname === player.minecraftUsername) {
        alreadyCorrect++;
        continue;
      }

      queue.add(
        `${member.user.tag} → ${player.minecraftUsername}`,
        () =>
          member.setNickname(
            player.minecraftUsername,
            "Bulk sync: set to MC username",
          ),
      );
    }

    console.log(`Skipped ${skipped} players (not in guild)`);
    console.log(`Already correct: ${alreadyCorrect}`);
    console.log(`Queued: ${queue.size} nickname changes\n`);

    if (queue.size === 0) {
      console.log("All nicknames are already up to date.");
      return;
    }

    console.log("Processing queue...");
    const results = await queue.process();

    // Summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`\n=== Done ===`);
    console.log(`  Succeeded: ${succeeded}`);
    console.log(`  Failed: ${failed}`);

    if (failed > 0) {
      console.log("\nFailed items:");
      for (const r of results.filter((r) => !r.success)) {
        console.log(`  - ${r.label}: ${r.error}`);
      }
    }
  } finally {
    client.destroy();
    process.exit(0);
  }
}

syncNicknames().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
