import config from "@/config";
import { toScreamingSnakeCase, type ToScreamingSnakeCase } from "./case";

const channelsConfig = config.discord.guild.channels;

/**
 * Type-level utility for transforming nested channel configuration structure
 *
 * Recursively transforms the channel configuration object, converting camelCase keys
 * to SCREAMING_SNAKE_CASE while preserving the nested category structure. String values
 * (channel IDs) are preserved as-is, while nested objects are recursively transformed.
 *
 * @template T - The channel configuration type to transform
 *
 * @example
 * type Config = { administration: { adminChat: string } };
 * type Result = TransformChannels<Config>;
 * // Result: { administration: { ADMIN_CHAT: string } }
 */
type TransformChannels<T> = {
  [K in keyof T]: T[K] extends string
    ? T[K]
    : {
        [P in keyof T[K] as ToScreamingSnakeCase<P & string>]: T[K][P];
      };
};

/**
 * Discord channel IDs organized by category with SCREAMING_SNAKE_CASE keys
 *
 * Transforms the original channel configuration from nested camelCase structure to
 * SCREAMING_SNAKE_CASE while maintaining the category groupings. All channel IDs
 * from the configuration are accessible through their category and converted key names,
 * providing type safety and autocomplete functionality.
 *
 * @example
 * // If config has { administration: { adminChat: "123456" } }
 * DiscordChannels.administration.ADMIN_CHAT // "123456"
 */
const DiscordChannels = Object.fromEntries(
  Object.entries(channelsConfig).map(([category, channels]) => [
    category,
    typeof channels === "string"
      ? channels
      : Object.fromEntries(
          Object.entries(channels).map(([key, value]) => [
            toScreamingSnakeCase(key),
            value,
          ]),
        ),
  ]),
) as TransformChannels<typeof channelsConfig>;

/**
 * Type representing any valid Discord channel ID from the configuration
 *
 * Ensures type safety when working with channel IDs throughout the application.
 * Only channel IDs defined in the configuration are considered valid. This type
 * encompasses all channel IDs across all categories.
 */
export type DiscordChannelId = string;

export const DiscordChannelsNamespace = {
  ...DiscordChannels,

  /**
   * Retrieves all Discord channel IDs from all categories as a flat array
   *
   * Traverses the nested category structure and collects all channel IDs into
   * a single array. Useful for bulk operations, validation, and when category
   * context is not needed.
   *
   * @returns Array containing all configured Discord channel IDs
   *
   * @example
   * const allIds = DiscordChannelsNamespace.getAllIds();
   * console.log(`Total channels: ${allIds.length}`);
   */
  getAllIds(): string[] {
    const ids: string[] = [];
    for (const category of Object.values(DiscordChannels)) {
      if (typeof category === "object") {
        ids.push(...Object.values(category));
      }
    }

    return ids;
  },

  /**
   * Validates whether a given string is a configured Discord channel ID
   *
   * Type guard function that checks if the provided ID exists anywhere in the channel
   * configuration across all categories. Useful for runtime validation of channel IDs
   * from external sources or user input.
   *
   * @param id - The channel ID string to validate
   * @returns True if the ID exists in the channel configuration, false otherwise
   *
   * @example
   * if (DiscordChannelsNamespace.isValid(someId)) {
   *   // TypeScript now knows someId is a DiscordChannelId
   *   console.log(DiscordChannelsNamespace.getChannelName(someId));
   * }
   */
  isValid(id: string): id is DiscordChannelId {
    return this.getAllIds().includes(id);
  },

  /**
   * Formats a Discord channel mention string
   *
   * Creates a Discord mention string that will render as a clickable channel reference
   * when sent in a message. Does not validate whether the channel exists in the guild.
   *
   * @param channelId - The Discord channel ID to mention
   * @returns The formatted channel mention string
   *
   * @example
   * const mention = DiscordChannelsNamespace.mention(
   *   DiscordChannels.administration.ADMIN_CHAT
   * );
   * await channel.send(`Please check ${mention}`); // "Please check #admin-chat"
   */
  mention(channelId: DiscordChannelId): string {
    return `<#${channelId}>`;
  },

  /**
   * Retrieves the fully qualified name for a given Discord channel ID
   *
   * Performs a reverse lookup to find both the category and channel key name
   * associated with the provided channel ID. Returns a dot-notation string
   * in the format "category.CHANNEL_NAME". Useful for logging, debugging,
   * error messages, and displaying channel context to users.
   *
   * @param id - The Discord channel ID to look up
   * @returns The qualified channel name in "category.CHANNEL_NAME" format, or "Unknown channel" if not found
   *
   * @example
   * const name = DiscordChannelsNamespace.getChannelName("123456");
   * // Returns "administration.ADMIN_CHAT"
   * console.log(`Channel location: ${name}`);
   */
  getChannelName(id: string): string {
    for (const [categoryKey, channels] of Object.entries(DiscordChannels)) {
      if (typeof channels === "object") {
        for (const [channelKey, channelId] of Object.entries(channels)) {
          if (channelId === id) {
            return `${categoryKey}.${channelKey}`;
          }
        }
      }
    }
    return "Unknown channel";
  },
} as const;
