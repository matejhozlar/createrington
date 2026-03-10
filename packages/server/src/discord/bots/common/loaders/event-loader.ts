import config from "@/config";
import fs from "node:fs";
import path from "node:path";
import type { Client, ClientEvents } from "discord.js";
import { pathToFileURL } from "node:url";

const isDev = config.envMode.isDev;

/**
 * Discord event module structure
 */
export interface EventModule<
  K extends keyof ClientEvents = keyof ClientEvents,
> {
  /** The Discord event name */
  eventName: K;
  /** Whether the event should fire only once */
  once?: boolean;
  /** Whether this event should only be registered in production */
  prodOnly?: boolean;
  /** The event handler function */
  execute: (client: Client, ...args: ClientEvents[K]) => Promise<void> | void;
}

/**
 * Type guard to check if a module is a valid EventModule
 */
function isEventModule(module: unknown): module is EventModule {
  return (
    typeof module === "object" &&
    module !== null &&
    "eventName" in module &&
    typeof (module as EventModule).eventName === "string" &&
    "execute" in module &&
    typeof (module as EventModule).execute === "function"
  );
}

/**
 * Loads Discord event handlers from a folder
 *
 * Recursively scans the events directory and registers all event handlers
 * Supports both one-time (once) and recurring (on) event listeners
 *
 * @param client - The Discord client instance
 * @returns Promise resolving to the number of loaded events
 */
export async function loadEventHandlers(
  client: Client,
  eventsPath: string,
): Promise<number> {
  if (!fs.existsSync(eventsPath)) {
    logger.warn(`Events directory not found: ${eventsPath}`);
    return 0;
  }

  const eventFiles = getAllEventFiles(eventsPath);
  let loadedCount = 0;

  for (const filePath of eventFiles) {
    try {
      const eventModule = await import(pathToFileURL(filePath).href);

      const event: EventModule | undefined =
        "default" in eventModule && isEventModule(eventModule.default)
          ? eventModule.default
          : isEventModule(eventModule)
            ? eventModule
            : undefined;

      if (!event) {
        logger.warn(
          `Skipped ${filePath}: not a valid EventModule (missing eventName or execute)`,
        );
        continue;
      }

      if (isDev && event.prodOnly) {
        logger.warn(
          `Skipped loading production-only event: ${path.basename(filePath)}`,
        );
        continue;
      }

      if (event.once) {
        client.once(event.eventName, async (...args) => {
          try {
            await event.execute(client, ...args);
          } catch (error) {
            logger.error(`Error in ${event.eventName} (once) event:`, error);
          }
        });
      } else {
        client.on(event.eventName, async (...args) => {
          try {
            await event.execute(client, ...args);
          } catch (error) {
            logger.error(`Error in ${event.eventName} event:`, error);
          }
        });
      }

      loadedCount++;
      logger.debug(
        `Registered ${event.once ? "once" : "on"} event: ${
          event.eventName
        } (${path.basename(filePath)})`,
      );
    } catch (error) {
      logger.error(`Failed to load event ${filePath}:`, error);
    }
  }

  logger.info(`Loaded ${loadedCount} Discord event(s) from ${eventsPath}`);
  return loadedCount;
}

/**
 * Recursively scans a directory and collects all valid event files
 *
 * This function walks through the directory tree starting from the given path,
 * collecting all TypeScript (.ts) or JavaScript (.js) files depending on the
 * environment mode. It ignores non-file items and only returns actual event files.
 *
 * @param dir - The absolute path to the directory to scan
 * @returns An array of absolute file paths to all discovered event files
 */
function getAllEventFiles(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      files.push(...getAllEventFiles(fullPath));
    } else if (item.isFile()) {
      const isValid = isDev
        ? item.name.endsWith(".ts")
        : item.name.endsWith(".js");

      if (isValid) {
        files.push(fullPath);
      }
    }
  }

  return files;
}
