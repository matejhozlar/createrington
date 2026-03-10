import config from "@/config";
import fs from "node:fs";
import type { CooldownType } from "@/discord/utils/cooldown";
import {
  type ChatInputCommandInteraction,
  Collection,
  type SlashCommandBuilder,
} from "discord.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  commandRegistry,
  type CommandEnv,
} from "@/discord/bots/main/command-registry";

const isDev = config.envMode.isDev;

/**
 * Discord command module structure
 */
export interface CommandModule {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;

  // Permission configurations
  permissions?: {
    /** Requires admin role to execute */
    requireAdmin?: boolean;
    /** Requires owner role to execute */
    requireOwner?: boolean;
    /** Custom permission check function */
    customCheck?: (
      interaction: ChatInputCommandInteraction,
    ) => Promise<boolean>;
  };

  // Cooldown configuration
  cooldown?: {
    duration: number; // in seconds
    type: CooldownType;
    message?: string; // Custom cooldown message
    bypassRoles?: string[]; // Role IDs that bypass cooldown
    bypassUsers?: string[]; // User IDs that bypass cooldown
  };
}

/**
 * Checks if a command should be loaded in the current environment
 *
 * @param commandName - The name of the command to check
 * @returns True if the command should be loaded
 * @private
 */
function shouldLoadCommand(commandName: string): boolean {
  const env: CommandEnv | undefined = commandRegistry[commandName];

  if (!env) {
    logger.warn(
      `Command "${commandName}" not found in registry, loading anyway`,
    );
    return true;
  }

  if (env === "both") return true;
  if (env === "dev" && isDev) return true;
  if (env === "prod" && !isDev) return true;

  return false;
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

  const ext = isDev ? ".ts" : ".js";
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
 * Loads Discord command handlers from a directory tree
 *
 * Scans all subdirectories for command files, validates each module,
 * and returns a collection filtered by the command registry environment.
 *
 * @param commandsPath - Absolute path to the slash-commands directory
 * @returns Promise resolving to a Collection of command handlers keyed by command name
 */
export async function loadCommandHandlers(
  commandsPath: string,
): Promise<Collection<string, CommandModule>> {
  if (!fs.existsSync(commandsPath)) {
    logger.warn(`Commands directory not found: ${commandsPath}`);
    return new Collection();
  }

  const commandFiles = collectCommandFiles(commandsPath);
  const commandHandlers = new Collection<string, CommandModule>();

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

      if (typeof commandModule.execute !== "function") {
        logger.warn(`Skipped ${file}: 'execute' is not a function`);
        continue;
      }

      if (!commandModule.data.name) {
        logger.warn(`Skipped ${file}: command has no name`);
        continue;
      }

      if (!shouldLoadCommand(commandModule.data.name)) {
        logger.warn(
          `Skipped command "${commandModule.data.name}": not enabled in ${isDev ? "dev" : "prod"}`,
        );
        continue;
      }

      commandHandlers.set(commandModule.data.name, commandModule);

      if (commandModule.permissions?.requireAdmin) {
        logger.debug(`Command ${commandModule.data.name} requires admin`);
      }

      if (commandModule.permissions?.requireOwner) {
        logger.debug(`Command ${commandModule.data.name} requires owner`);
      }

      if (commandModule.cooldown) {
        logger.debug(
          `Command ${commandModule.data.name} has ${commandModule.cooldown.type} cooldown: ${commandModule.cooldown.duration}`,
        );
      }
    } catch (error) {
      logger.error(`Failed to load command ${file}:`, error);
    }
  }

  logger.info(
    `Loaded ${commandHandlers.size} Discord command(s) from ${commandsPath}`,
  );
  return commandHandlers;
}
