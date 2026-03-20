import { router, adminProcedure } from "@/trpc/trpc";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_PATH = path.join(__dirname, "..", "..", "..", "config", "discord-commands.json");

/** Admin Discord commands router — serves auto-generated slash command documentation. */
export const discordCommandsRouter = router({
	list: adminProcedure
		.meta({ description: "Get all Discord slash commands with their metadata." })
		.query(() => {
			if (!fs.existsSync(JSON_PATH)) {
				return { generatedAt: null, commands: [] };
			}
			return JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
		}),
});
