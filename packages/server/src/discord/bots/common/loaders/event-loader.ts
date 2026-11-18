import config from "@/config";
import fs from "node:fs";
import path from "node:path";
import type { Client, ClientEvents } from "discord.js";
import { pathToFileURL } from "node:url";

const isDev = config.envMode.isDev;

export interface EventModule<
  K extends keyof ClientEvents = keyof ClientEvents,
> {
  eventName: K;
  prodOnly?: boolean;
  execute: (client: Client, ...args: ClientEvents[K]) => Promise<void> | void;
}

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
      const event = (await import(pathToFileURL(filePath).href)) as unknown;

      if (!isEventModule(event)) {
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

      const listener = (...args: ClientEvents[keyof ClientEvents]) => {
        Promise.resolve()
          .then(() => event.execute(client, ...args))
          .catch((error: unknown) => {
            logger.error(`Error in ${event.eventName} event:`, error);
          });
      };

      client.on(event.eventName, listener);

      loadedCount++;
      logger.debug(
        `Registered event: ${event.eventName} (${path.basename(filePath)})`,
      );
    } catch (error) {
      logger.error(`Failed to load event ${filePath}:`, error);
    }
  }

  logger.info(`Loaded ${loadedCount} Discord event(s) from ${eventsPath}`);
  return loadedCount;
}

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
