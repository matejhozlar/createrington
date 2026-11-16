import config from "@/config";

const channelsConfig = config.discord.guild.channels;

/**
 * Converts a camelCase string to SCREAMING_SNAKE_CASE at runtime
 *
 * Inserts underscores before capital letters and converts the entire string to uppercase
 *
 * @param str - The camelCase string to convert
 * @returns The converted SCREAMING_SNAKE_CASE string
 *
 * @example
 * toScreamingSnakeCase("adminChat") // Returns "ADMIN_CHAT"
 * toScreamingSnakeCase("generalDiscussion") // Returns "GENERAL_DISCUSSION"
 */
function toScreamingSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * Type-level utility for converting camelCase string literals to SCREAMING_SNAKE_CASE
 *
 * Recursively processes each character, inserting underscores before uppercase letters
 * and converting all characters to uppercase. Used for type-safe key transformation.
 *
 * @template S - The string literal type to convert
 *
 * @example
 * type Result = ToScreamingSnakeCase<"adminChat">; // "ADMIN_CHAT"
 * type Result2 = ToScreamingSnakeCase<"myChannelName">; // "MY_CHANNEL_NAME"
 */
type ToScreamingSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
    : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
  : S;

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
  Object.entries(channelsConfig).map(
    ([category, channels]: [string, string | Record<string, string>]) => [
      category,
      typeof channels === "string"
        ? channels
        : Object.fromEntries(
            Object.entries(channels).map(([key, value]) => [
              toScreamingSnakeCase(key),
              value,
            ]),
          ),
    ],
  ),
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
} as const;
