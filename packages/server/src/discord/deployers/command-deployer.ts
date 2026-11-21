import "@/logger.global";
import config from "@/config";
import {
  REST,
  type RESTPostAPIApplicationCommandsJSONBody,
  Routes,
} from "discord.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCommandModule } from "../bots/common/loaders/command-loader";
import {
  collectModuleFiles,
  importDefaultExport,
} from "../bots/common/loaders/module-files";

const BOT_TOKEN = config.discord.bots.main.token;
const BOT_ID = config.discord.bots.main.id;
const GUILD_ID = config.discord.guild.id;

const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

async function loadCommandData(): Promise<
  RESTPostAPIApplicationCommandsJSONBody[]
> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const commandsPath = path.join(
    __dirname,
    "..",
    "bots",
    "main",
    "interactions",
    "slash-commands",
  );

  const commandFiles = collectModuleFiles(commandsPath, ".ts");
  const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];

  if (commandFiles.length === 0) {
    logger.warn(`No command modules found in ${commandsPath}`);
  }

  for (const filePath of commandFiles) {
    const file = path.basename(filePath);
    try {
      const command = await importDefaultExport(filePath);

      if (!isCommandModule(command)) {
        logger.warn(
          `Skipped ${file}: default export is not a command (needs data and execute)`,
        );
        continue;
      }

      commands.push(command.data.toJSON());
      logger.debug(`Loaded command data from ${file}`);
    } catch (error) {
      logger.error(`Failed to load command data from ${file}:`, error);
    }
  }

  return commands;
}

export async function registerCommands(): Promise<void> {
  try {
    logger.info("Loading command definitions...");
    const commands = await loadCommandData();

    logger.info(
      `Registering ${commands.length} slash command(s) in GUILD: ${GUILD_ID}`,
    );

    const data = (await rest.put(
      Routes.applicationGuildCommands(BOT_ID, GUILD_ID),
      {
        body: commands,
      },
    )) as Array<{ name: string }>;

    logger.info("Commands registered successfully:");
    data.forEach((cmd) => logger.info(` - /${cmd.name}`));
    process.exit(0);
  } catch (error) {
    logger.error("Failed to register commands:", error);
    process.exit(1);
  }
}

void registerCommands();
