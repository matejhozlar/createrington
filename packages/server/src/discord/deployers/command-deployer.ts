import "@/logger.global";
import config from "@/config";
import {
  REST,
  type RESTPostAPIApplicationCommandsJSONBody,
  Routes,
} from "discord.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CommandModule } from "../bots/common/loaders/command-loader";
import {
  commandRegistry,
  type CommandEnv,
} from "../bots/main/command-registry";

const BOT_TOKEN = config.discord.bots.main.token;
const BOT_ID = config.discord.bots.main.id;
const GUILD_ID = config.discord.guild.id;
const isDev = config.envMode.isDev;

/**
 * Discord REST API client configured with bot token
 */
const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);

/**
 * Checks if a command should be deployed in the current environment
 *
 * @param commandName - The name of the command to check
 * @returns True if the command should be deployed
 * @private
 */
function shouldDeployCommand(commandName: string): boolean {
  const env: CommandEnv | undefined = commandRegistry[commandName];

  if (!env) {
    logger.warn(
      `Command "${commandName}" not found in registry, deploying anyway`,
    );
    return true;
  }

  // In development, deploy everything (including WIP commands)
  // In production, skip dev-only commands
  if (isDev) return true;
  return env !== "dev";
}

/**
 * Recursively collects all command files from a directory tree
 *
 * @param dir - The directory path to scan
 * @returns Array of absolute file paths to command files
 * @private
 */
function collectCommandFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  // Always scan .ts files — this script runs via tsx even in CI
  const ext = ".ts";
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCommandFiles(fullPath));
    } else if (entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Dynamically loads command data from slash command files
 *
 * Scans the slash-commands directory and its subdirectories, extracts the
 * `data` export from each command module for deployment
 *
 * @returns Promise resolving to an array of command JSON data
 */
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

  if (!fs.existsSync(commandsPath)) {
    logger.warn("Commands directory not found");
    return [];
  }

  const commandFiles = collectCommandFiles(commandsPath);
  const commands: RESTPostAPIApplicationCommandsJSONBody[] = [];

  for (const filePath of commandFiles) {
    const file = path.basename(filePath);
    try {
      const commandModule = (await import(
        pathToFileURL(filePath).href
      )) as CommandModule;

      if (!commandModule.data) {
        logger.warn(`Skipped ${file}: missing 'data' export`);
        continue;
      }

      if (typeof commandModule.data.toJSON !== "function") {
        logger.warn(`Skipped ${file}: 'data' does not have toJSON method`);
        continue;
      }

      const commandName = commandModule.data.name;

      if (!shouldDeployCommand(commandName)) {
        logger.warn(
          `Skipped deploying "${commandName}": not enabled in ${isDev ? "dev" : "prod"}`,
        );
        continue;
      }

      commands.push(commandModule.data.toJSON());
      logger.debug(`Loaded command data from ${file}`);
    } catch (error) {
      logger.error(`Failed to load command data from ${file}:`, error);
    }
  }

  return commands;
}

/**
 * Registers all defined slash commands to the configured guild
 *
 * This function submits the commands array to Discord's API, replacing
 * any existing guild commands. Registration is guild-specific
 *
 * @returns Promise resolving when registration is completed
 */
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

registerCommands();
