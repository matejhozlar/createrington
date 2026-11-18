import config from "@/config";

const roles = config.discord.guild.roles;

/**
 * Converts a camelCase string to SCREAMING_SNAKE_CASE at runtime
 *
 * Inserts underscores before capital letters and converts the entire string to uppercase
 *
 * @param str - The camelCase string to convert
 * @returns The converted SCREAMING_SNAKE_CASE string
 *
 * @example
 * toScreamingSnakeCase("adminRole") // Returns "ADMIN_ROLE"
 * toScreamingSnakeCase("serverModerator") // Returns "SERVER_MODERATOR"
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
 * type Result = ToScreamingSnakeCase<"adminRole">; // "ADMIN_ROLE"
 * type Result2 = ToScreamingSnakeCase<"myRoleName">; // "MY_ROLE_NAME"
 */
type ToScreamingSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
    : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
  : S;

/**
 * Discord role IDs mapped with SCREAMING_SNAKE_CASE keys for consistent access
 *
 * Transforms the original role configuration keys from camelCase to SCREAMING_SNAKE_CASE
 * while preserving type safety and autocomplete functionality. All role IDs from the
 * configuration are accessible through their converted key names.
 *
 * @example
 * // If config has { adminRole: "123456" }
 * DiscordRoles.ADMIN_ROLE // "123456"
 */
const DiscordRoles = Object.fromEntries(
  Object.entries(roles).map(([key, value]) => [
    toScreamingSnakeCase(key),
    value,
  ]),
) as {
  [
    K in keyof typeof roles as ToScreamingSnakeCase<K & string>
  ]: (typeof roles)[K];
};

/**
 * Type representing any valid Discord role ID from the configuration
 *
 * Ensures type safety when working with role IDs throughout the application.
 * Only role IDs defined in the configuration are considered valid.
 */
export type DiscordRoleId = (typeof DiscordRoles)[keyof typeof DiscordRoles];

export const DiscordRolesNamespace = {
  ...DiscordRoles,

  /**
   * Formats a Discord role mention string
   *
   * Creates a Discord mention string that will ping all members with the role
   * when sent in a message. Does not validate whether the role exists in the guild.
   *
   * @param roleId - The Discord role ID to mention
   * @returns The formatted role mention string
   *
   * @example
   * const mention = DiscordRolesNamespace.mention(DiscordRoles.ADMIN_ROLE);
   * await channel.send(`Attention ${mention}!`); // "Attention @Admin!"
   */
  mention(roleId: DiscordRoleId): string {
    return `<@&${roleId}>`;
  },
} as const;
