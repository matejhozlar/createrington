import "@/logger.global";
import { Client } from "discord.js";
import { env } from "@/config/env/env.config";
import { AppEmojiService } from "@/services/discord/emojis";

const replace = process.argv.includes("--replace");
const prune = process.argv.includes("--prune");

function report(label: string, names: string[]): void {
  if (names.length > 0) console.log(`${label}: ${names.join(", ")}`);
}

async function syncEmojis(): Promise<void> {
  const client = new Client({ intents: [] });
  let exitCode = 0;

  try {
    console.log("Logging in main Discord bot...");
    await client.login(env.DISCORD_MAIN_BOT_TOKEN);
    if (!client.isReady()) {
      await new Promise<void>((resolve) => {
        client.once("clientReady", () => resolve());
      });
    }
    const flags = [replace && "replace", prune && "prune"].filter(Boolean);
    console.log(
      `✓ Logged in as ${client.user?.tag}${flags.length ? ` (${flags.join(", ")})` : ""}\n`,
    );

    const service = new AppEmojiService(client);
    const result = await service.sync({ replace, prune });

    report("Kept", result.kept);
    report("Uploaded", result.created);
    report("Replaced", result.replaced);
    report("Pruned", result.pruned);
    report("Failed", result.failed);
    report("Prune failed", result.pruneFailed);
    console.log(`\nApplication emojis available: ${service.list().length}`);
    if (result.replaced.length > 0) {
      console.log(
        "\nReplaced emojis have new IDs. Restart the server so its token map picks them up, and re-insert them in presets that still hold the old tokens.",
      );
    }

    exitCode =
      result.failed.length > 0 || result.pruneFailed.length > 0 ? 1 : 0;
  } catch (error) {
    console.error("\nFailed to sync application emojis:");
    console.error(error);
    exitCode = 1;
  } finally {
    await client.destroy();
    process.exit(exitCode);
  }
}

syncEmojis();
