import config from "@/config";
import type { CooldownType } from "@/discord/utils/cooldown";
import {
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  Collection,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import path from "node:path";
import { collectModuleFiles, importDefaultExport } from "./module-files";

const extension = config.envMode.isDev ? ".ts" : ".js";

export interface CommandData {
  readonly name: string;
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

export interface CommandPermissions {
  requireAdmin?: boolean;
  requireOwner?: boolean;
}

export interface CommandCooldown {
  duration: number;
  type: CooldownType;
  message?: string;
}

export interface CommandModule {
  data: CommandData;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  permissions?: CommandPermissions;
  cooldown?: CommandCooldown;
}

export function isCommandModule(value: unknown): value is CommandModule {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CommandModule>;
  return (
    typeof candidate.data?.name === "string" &&
    typeof candidate.data.toJSON === "function" &&
    typeof candidate.execute === "function"
  );
}

export async function loadCommandHandlers(
  commandsPath: string,
): Promise<Collection<string, CommandModule>> {
  const commandFiles = collectModuleFiles(commandsPath, extension);
  const commandHandlers = new Collection<string, CommandModule>();

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

      commandHandlers.set(command.data.name, command);

      if (command.permissions?.requireAdmin) {
        logger.debug(`Command ${command.data.name} requires admin`);
      }

      if (command.permissions?.requireOwner) {
        logger.debug(`Command ${command.data.name} requires owner`);
      }

      if (command.cooldown) {
        logger.debug(
          `Command ${command.data.name} has ${command.cooldown.type} cooldown: ${command.cooldown.duration}`,
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
