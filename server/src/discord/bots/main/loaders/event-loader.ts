import config from "@/config";
import { Client, ClientEvents } from "discord.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const isDev = config.envMode.isDev;

/**
 * Discord event module structure
 */
export interface EventModule<
  K extends keyof ClientEvents = keyof ClientEvents
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
    typeof (module as any).eventName === "string" &&
    "execute" in module &&
    typeof (module as any).execute === "function"
  );
}

/**
 * Loads Discord event handlers from discord/bots/main/events folder
 *
 * Recursively scans the events directory and registers all event handlers
 * Supports both one-time (once) and recurring (on) event listeners
 *
 * @param client - The Discord client instance
 * @returns Promise resolving to the number of loaded events
 */
export async function loadEventHandlers(client: Client): Promise<number> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const eventsPath = path.join(__dirname, "..", "events");

  if (!fs.existsSync(eventsPath)) {
    logger.warn("Events directory not found");
    return 0;
  }

  const eventFiles = getAllEventFiles(eventsPath);
  let loadedCount = 0;

  for (const filePath of eventFiles) {
    try {
      const eventModule = await import(pathToFileURL(filePath).href);

      // Support both default export and named exports
      const event: EventModule | undefined =
        "default" in eventModule && isEventModule(eventModule.default)
          ? eventModule.default
          : isEventModule(eventModule)
          ? eventModule
          : undefined;

      if (!event) {
        logger.warn(
          `Skipped ${filePath}: not a valid EventModule (missing eventName or execute)`
        );
        continue;
      }

      if (isDev && event.prodOnly) {
        logger.warn(
          `Skipped loading production-only event: ${path.basename(filePath)}`
        );
        continue;
      }

      // Type-safe event registration
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
        } (${path.basename(filePath)})`
      );
    } catch (error) {
      logger.error(`Failed to load event ${filePath}:`, error);
    }
  }

  logger.info(`Loaded ${loadedCount} Discord event(s)`);
  return loadedCount;
}

/**
 * Recursively gets all event files from a directory
 *
 * @param dir - Directory path to scan
 * @returns Array of absolute file paths
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
