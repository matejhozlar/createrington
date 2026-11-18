import config from "@/config";

const categories = config.discord.guild.categories;

/**
 * Converts a camelCase string to SCREAMING_SNAKE_CASE at runtime
 *
 * Inserts underscores before capital letters and converts the entire string to uppercase
 *
 * @param str - The camelCase string to convert
 * @returns The converted SCREAMING_SNAKE_CASE string
 *
 * @example
 * toScreamingSnakeCase("adminCategory") // Returns "ADMIN_CATEGORY"
 * toScreamingSnakeCase("playerTeams") // Returns "PLAYER_TEAMS"
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
 * type Result = ToScreamingSnakeCase<"adminCategory">; // "ADMIN_CATEGORY"
 * type Result2 = ToScreamingSnakeCase<"myCategoryName">; // "MY_CATEGORY_NAME"
 */
type ToScreamingSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
    : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
  : S;

/**
 * Discord category IDs mapped with SCREAMING_SNAKE_CASE keys for consistent access
 *
 * Transforms the original category configuration keys from camelCase to SCREAMING_SNAKE_CASE
 * while preserving type safety and autocomplete functionality. All category IDs from the
 * configuration are accessible through their converted key names.
 *
 * @example
 * // If config has { adminCategory: "123456" }
 * DiscordCategories.ADMIN_CATEGORY // "123456"
 */
export const DiscordCategories = Object.fromEntries(
  Object.entries(categories).map(([key, value]) => [
    toScreamingSnakeCase(key),
    value,
  ]),
) as {
  [
    K in keyof typeof categories as ToScreamingSnakeCase<K & string>
  ]: (typeof categories)[K];
};

export const DiscordCategoriesNamespace = {
  ...DiscordCategories,
} as const;
