import config from "@/config";
import { toScreamingSnakeCase, type ToScreamingSnakeCase } from "./case";

const roles = config.discord.guild.roles;

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

  /**
   * Validates whether a given string is a configured Discord role ID
   *
   * Type guard function that checks if the provided ID exists in the role
   * configuration. Useful for runtime validation of role IDs from external sources.
   *
   * @param roleId - The role ID string to validate
   * @returns True if the ID exists in the role configuration, false otherwise
   *
   * @example
   * if (isValidRole(someId)) {
   *   // TypeScript now knows someId is a DiscordRoleId
   *   console.log(getRoleName(someId));
   * }
   */
  isValid(roleId: string): roleId is DiscordRoleId {
    return Object.values(DiscordRoles).includes(roleId as DiscordRoleId);
  },

  /**
   * Retrieves the human-readable SCREAMING_SNAKE_CASE name for a given Discord role ID
   *
   * Performs a reverse lookup to find the configuration key name associated with
   * the provided role ID. Useful for logging, debugging, and error messages.
   *
   * @param id - The Discord role ID to look up
   * @returns The SCREAMING_SNAKE_CASE key name of the role, or "Unknown role" if not found
   *
   * @example
   * getRoleName(DiscordRoles.ADMIN_ROLE) // Returns "ADMIN_ROLE"
   */
  getRoleName(id: DiscordRoleId): string {
    const entry = Object.entries(DiscordRoles).find(
      ([_, roleId]) => roleId === id,
    );
    return entry ? entry[0] : "Unknown role";
  },
} as const;
