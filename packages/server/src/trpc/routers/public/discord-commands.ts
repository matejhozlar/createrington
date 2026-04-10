import { router, publicProcedure } from "@/trpc/trpc";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "config",
  "discord-commands.json",
);

interface CommandData {
  generatedAt: string | null;
  commands: Array<{
    name: string;
    description: string;
    category: string;
    options: unknown[];
    cooldown?: { duration: number; type: string; message?: string };
    [key: string]: unknown;
  }>;
}

/** Public Discord commands router — serves player-facing command docs. */
export const discordCommandsRouter = router({
  list: publicProcedure
    .meta({
      description:
        "Get player-facing Discord slash commands (user + public categories only).",
    })
    .query(() => {
      if (!fs.existsSync(JSON_PATH)) {
        return { generatedAt: null, commands: [] };
      }

      const data = JSON.parse(
        fs.readFileSync(JSON_PATH, "utf-8"),
      ) as CommandData;

      return {
        generatedAt: data.generatedAt,
        commands: data.commands.filter(
          (cmd) => cmd.category === "user" || cmd.category === "public",
        ),
      };
    }),
});
