import config from "@/config";
import fs from "node:fs";
import { type ButtonInteraction, Collection } from "discord.js";
import path from "node:path";
import { pathToFileURL } from "node:url";

const isDev = config.envMode.isDev;

export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

export interface ButtonModule {
  pattern: string;
  execute: ButtonHandler;
  checkPermission?: (Interaction: ButtonInteraction) => Promise<boolean>;
  permissionDeniedMessage?: string;
}

function matchesPattern(customId: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return customId === pattern;
  }

  const regexPattern = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*");

  return new RegExp(`^${regexPattern}$`).test(customId);
}

export async function loadButtonHandlers(
  buttonsPath: string,
): Promise<Collection<string, ButtonModule>> {
  if (!fs.existsSync(buttonsPath)) {
    logger.warn(`Buttons directory not found: ${buttonsPath}`);
    return new Collection();
  }

  const buttonFiles = fs
    .readdirSync(buttonsPath)
    .filter((file) => (isDev ? file.endsWith(".ts") : file.endsWith(".js")));

  const buttonHandlers = new Collection<string, ButtonModule>();

  for (const file of buttonFiles) {
    const filePath = path.join(buttonsPath, file);
    try {
      const buttonModule = (await import(
        pathToFileURL(filePath).href
      )) as ButtonModule;

      if (!buttonModule.pattern) {
        logger.warn(`Skipped ${file}: missing 'pattern' export`);
        continue;
      }

      if (typeof buttonModule.execute !== "function") {
        logger.warn(`Skipped ${file}: 'execute' is not a function`);
        continue;
      }

      const handlerKey = path.parse(file).name;
      buttonHandlers.set(handlerKey, buttonModule);

      logger.debug(
        `Loaded button handler: ${handlerKey} (pattern: ${buttonModule.pattern})`,
      );
    } catch (error) {
      logger.error(`Failed to load button handler ${file}:`, error);
    }
  }

  logger.info(
    `Loaded ${buttonHandlers.size} button handler(s) from ${buttonsPath}`,
  );
  return buttonHandlers;
}

export function findButtonHandler(
  customId: string,
  handlers: Collection<string, ButtonModule>,
): ButtonModule | null {
  for (const handler of handlers.values()) {
    if (matchesPattern(customId, handler.pattern)) {
      return handler;
    }
  }
  return null;
}
