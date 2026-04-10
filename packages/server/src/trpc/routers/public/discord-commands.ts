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

export interface RawCommand {
  name: string;
  description: string;
  category: string;
  options: unknown[];
  cooldown?: { duration: number; type: string; message?: string };
  [key: string]: unknown;
}

interface CommandData {
  generatedAt: string | null;
  commands: RawCommand[];
}

/** Maps command names to logical display groups. */
const COMMAND_GROUPS: Record<string, string> = {
  verify: "Getting Started",
  register: "Getting Started",
  money: "Economy",
  daily: "Economy",
  pay: "Economy",
  lottery: "Economy",
  history: "Economy",
  playtime: "Player Info",
  compare: "Player Info",
  profile: "Player Info",
  activity: "Player Info",
  seen: "Player Info",
  skin: "Player Info",
  top: "Player Info",
  crypto: "Crypto",
  ping: "Server",
  status: "Server",
  list: "Server",
};

const GROUP_ORDER = [
  "Getting Started",
  "Economy",
  "Player Info",
  "Crypto",
  "Server",
];

/** Public Discord commands router — serves player-facing command docs. */
export const discordCommandsRouter = router({
  list: publicProcedure
    .meta({
      description:
        "Get player-facing Discord slash commands grouped by category.",
    })
    .query(() => {
      if (!fs.existsSync(JSON_PATH)) {
        return { generatedAt: null, groups: [] };
      }

      const data = JSON.parse(
        fs.readFileSync(JSON_PATH, "utf-8"),
      ) as CommandData;

      const playerCommands = data.commands.filter(
        (cmd) => cmd.category === "user" || cmd.category === "public",
      );

      // Group commands
      const grouped = new Map<string, RawCommand[]>();
      for (const cmd of playerCommands) {
        const group = COMMAND_GROUPS[cmd.name] ?? "Other";
        const list = grouped.get(group) ?? [];
        list.push(cmd);
        grouped.set(group, list);
      }

      // Return in defined order
      const groups = GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => ({
        name: g,
        commands: grouped.get(g)!,
      }));

      // Append any ungrouped commands
      const ungrouped = grouped.get("Other");
      if (ungrouped) {
        groups.push({ name: "Other", commands: ungrouped });
      }

      return { generatedAt: data.generatedAt, groups };
    }),
});
