/**
 * Runtime resolution of custom emoji names to their deployed ids
 *
 * Emoji ids differ between the dev and prod bot applications, so they are never
 * committed. The bot fetches its own application's emoji list once after login
 * and matches them back to the manifest by name.
 */

import type { Client } from "discord.js";
import { emojiManifest, type EmojiKey } from "./manifest";

/** Manifest key -> the `<:name:id>` render string, populated on hydrate */
const resolved = new Map<string, string>();

/**
 * Loads the bot application's custom emojis and matches them to the manifest
 *
 * Safe to call before the emojis have been deployed: anything missing simply
 * keeps its Unicode fallback and is reported as a warning.
 *
 * @param client - A logged-in Discord client
 */
export async function hydrateEmojiRegistry(client: Client): Promise<void> {
  const application = client.application;
  if (!application) {
    logger.warn("Emoji registry: client has no application, skipping hydrate");
    return;
  }

  try {
    const emojis = await application.emojis.fetch();
    const byName = new Map(
      emojis.map((emoji) => [emoji.name, emoji.toString()]),
    );

    const missing: string[] = [];
    for (const name of Object.keys(emojiManifest)) {
      const rendered = byName.get(name);
      if (rendered) {
        resolved.set(name, rendered);
      } else {
        missing.push(name);
      }
    }

    logger.info(
      `Emoji registry: resolved ${resolved.size}/${Object.keys(emojiManifest).length} custom emoji(s)`,
    );

    if (missing.length > 0) {
      logger.warn(
        `Emoji registry: not deployed yet, using fallbacks: ${missing.join(", ")}. Run 'pnpm deploy-emojis'.`,
      );
    }
  } catch (error) {
    // Non-fatal: every lookup falls back to its Unicode equivalent
    logger.error("Emoji registry: failed to fetch application emojis", error);
  }
}

/**
 * Resolves an emoji to a string that is always safe to render
 *
 * Returns the deployed custom emoji when available, otherwise the manifest's
 * Unicode fallback. Never returns undefined, so callers cannot accidentally emit
 * a malformed emoji into a message or button.
 *
 * @param key - A manifest key
 * @returns The custom emoji render string, or its Unicode fallback
 */
export function resolveEmoji(key: EmojiKey): string {
  return resolved.get(key) ?? emojiManifest[key].fallback;
}

/**
 * Reports whether an emoji resolved to its deployed custom form
 *
 * Intended for diagnostics; normal call sites should just use the resolved
 * string and let the fallback do its job.
 *
 * @param key - A manifest key
 * @returns True when the custom emoji was found on the application
 */
export function isEmojiDeployed(key: EmojiKey): boolean {
  return resolved.has(key);
}
