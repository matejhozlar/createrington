import { emojiManifest, type EmojiKey } from "../emojis/manifest";
import { resolveEmoji } from "../emojis/registry";
import { toScreamingSnakeCase, type ToScreamingSnakeCase } from "./case";

/**
 * Custom emojis exposed with SCREAMING_SNAKE_CASE keys, matching the role and
 * channel namespaces
 *
 * Unlike roles and channels these resolve lazily rather than being frozen at
 * import time, because the ids are only known once the bot has logged in and
 * fetched its application's emoji list. Reading a key before that returns the
 * manifest's Unicode fallback, so a value is always safe to render.
 *
 * @example
 * Discord.Emojis.RELOAD // "<:reload:1234567890>" once deployed, "🔄" before
 */
const DiscordEmojis = {} as {
  [K in EmojiKey as ToScreamingSnakeCase<K>]: string;
};

for (const key of Object.keys(emojiManifest) as EmojiKey[]) {
  Object.defineProperty(DiscordEmojis, toScreamingSnakeCase(key), {
    get: () => resolveEmoji(key),
    enumerable: true,
  });
}

export const DiscordEmojisNamespace = DiscordEmojis;
