import config from "@/config";
import type { CustomIdMatcher } from "@/discord/utils/custom-id";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import path from "node:path";
import { collectModuleFiles, importDefaultExport } from "./module-files";

const extension = config.envMode.isDev ? ".ts" : ".js";

export interface ComponentModule<
  I extends ButtonInteraction | ModalSubmitInteraction,
> {
  customId: CustomIdMatcher;
  execute: (interaction: I) => Promise<void>;
  checkPermission?: (interaction: I) => Promise<boolean>;
  permissionDeniedMessage?: string;
}

export type ButtonModule = ComponentModule<ButtonInteraction>;
export type ModalModule = ComponentModule<ModalSubmitInteraction>;

function isComponentModule<
  I extends ButtonInteraction | ModalSubmitInteraction,
>(value: unknown): value is ComponentModule<I> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ComponentModule<I>>;
  return (
    typeof candidate.customId?.matches === "function" &&
    typeof candidate.execute === "function"
  );
}

export async function loadComponentHandlers<
  I extends ButtonInteraction | ModalSubmitInteraction,
>(dir: string): Promise<ComponentModule<I>[]> {
  const handlers: ComponentModule<I>[] = [];

  for (const filePath of collectModuleFiles(dir, extension)) {
    const file = path.basename(filePath);
    try {
      const handler = await importDefaultExport(filePath);

      if (!isComponentModule<I>(handler)) {
        logger.warn(
          `Skipped ${file}: default export is not a handler (needs customId and execute)`,
        );
        continue;
      }

      handlers.push(handler);
      logger.debug(
        `Loaded handler ${file} (custom id: ${handler.customId.prefix})`,
      );
    } catch (error) {
      logger.error(`Failed to load handler ${file}:`, error);
    }
  }

  logger.info(`Loaded ${handlers.length} handler(s) from ${dir}`);
  return handlers;
}

export function findComponentHandler<
  I extends ButtonInteraction | ModalSubmitInteraction,
>(
  customId: string,
  handlers: readonly ComponentModule<I>[],
): ComponentModule<I> | null {
  return handlers.find((handler) => handler.customId.matches(customId)) ?? null;
}
