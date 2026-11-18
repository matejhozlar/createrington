import config from "@/config";
import fs from "node:fs";
import { type ButtonInteraction, Collection } from "discord.js";
import path from "node:path";
import { pathToFileURL } from "node:url";

const isDev = config.envMode.isDev;

/**
 * Button handler function type
 *
 * Defines the signature for functions that handle Discord button interactions
 *
 * @param interaction - The button interaction from Discord
 * @returns Promise resolving when the interaction is handled
 */
export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

/**
 * Button module structure with pattern matching support
 *
 * Defines the structure of button handler modules. Supports exact matches
 * and wildcard patterns for customId matching
 */
export interface ButtonModule {
  /**
   * Pattern to match button customIds
   * Can be:
   * - Exact string: "help-button"
   * - Prefix pattern: "waitlist:*"
   */
  pattern: string;
  /**
   * Handler function for this button
   *
   * Called when a button interaction's customId matches the pattern
   */
  execute: ButtonHandler;
  /**
   * Permission check
   *
   * Optional function to verify if the user has permission to use this button
   * Return true to allow, false to deny
   *
   * @param interaction - The button interaction to check permissions for
   * @returns Promise resolving to true if allowed, false if denied
   */
  checkPermission?: (Interaction: ButtonInteraction) => Promise<boolean>;
  /**
   * Message to display when permission check fails
   *
   * Shown to users who attempt to use the button without proper permissions
   *
   * @default "You don't have permission to use this button"
   */
  permissionDeniedMessage?: string;
}

/**
 * Checks if a customId matches a pattern
 *
 * Supports exact string matching and wildcard patterns (using *)
 *
 * @param customId - The button's customId to check
 * @param pattern - Pattern to match against (string with optional wildcards)
 * @returns True if the customId matches the pattern, false otherwise
 * @private
 */
function matchesPattern(customId: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return customId === pattern;
  }

  const regexPattern = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*");

  return new RegExp(`^${regexPattern}$`).test(customId);
}

/**
 * Loads button handlers
 *
 * Scans the buttons directory, imports all button handler modules, validates them,
 * and returns a collection of loaded handlers
 *
 * @returns Promise resolving to a Collection of button handlers, keyed by filename
 *
 * @remarks
 * - In development mode, loads `.ts` files
 * - In production mode, loads `.js` files
 * - Skips files missing required exports (`pattern` or `execute`)
 * - Logs warnings for invalid or skipped button files
 */
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

/**
 * Finds a matching button handler for a given customId
 *
 * Interates through all registered button handlers and returns the first one
 * whose pattern matches the provided customId. Returns null if no match is found
 *
 * @param customId - The button's customId from the interaction
 * @param handlers - Collection of registered button handlers
 * @returns The matching ButtomModule, or null if no handler matches
 */
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
