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

// NOTE: these are getters, so spreading this object resolves every value at the
// point of the spread. `DiscordRolesNamespace` is built with `...DiscordRoles`,
// but copying that pattern here would freeze whatever was resolved at module
// init - which is before login, i.e. the Unicode fallbacks, permanently.
for (const key of Object.keys(emojiManifest) as EmojiKey[]) {
  Object.defineProperty(DiscordEmojis, toScreamingSnakeCase(key), {
    get: () => resolveEmoji(key),
    enumerable: true,
  });
}

export const DiscordEmojisNamespace = DiscordEmojis;
