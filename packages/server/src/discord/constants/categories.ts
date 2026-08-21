import config from "@/config";
import { toScreamingSnakeCase, type ToScreamingSnakeCase } from "./case";

const categories = config.discord.guild.categories;

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

/**
 * Type representing any valid Discord category ID from the configuration
 *
 * Ensures type safety when working with category IDs throughout the application.
 * Only category IDs defined in the configuration are considered valid.
 */
export type DiscordCategoryId =
  (typeof DiscordCategories)[keyof typeof DiscordCategories];

export const DiscordCategoriesNamespace = {
  ...DiscordCategories,

  /**
   * Validates whether a given string is a configured Discord category ID
   *
   * Type guard function that checks if the provided ID exists in the category
   * configuration. Useful for runtime validation of category IDs from external sources.
   *
   * @param id - The category ID string to validate
   * @returns True if the ID exists in the category configuration, false otherwise
   *
   * @example
   * if (isValidCategory(someId)) {
   *   // TypeScript now knows someId is a DiscordCategoryId
   *   console.log(getCategoryName(someId));
   * }
   */
  isValidCategory(id: string): id is DiscordCategoryId {
    return Object.values(DiscordCategories).includes(id as DiscordCategoryId);
  },

  /**
   * Retrieves the human-readable SCREAMING_SNAKE_CASE name for a given Discord category ID
   *
   * Performs a reverse lookup to find the configuration key name associated with
   * the provided category ID. Useful for logging, debugging, and error messages.
   *
   * @param id - The Discord category ID to look up
   * @returns The SCREAMING_SNAKE_CASE key name of the category, or "Unknown category" if not found
   *
   * @example
   * getCategoryName(DiscordCategories.ADMIN_CATEGORY) // Returns "ADMIN_CATEGORY"
   */
  getCategoryName(id: DiscordCategoryId): string {
    const entry = Object.entries(DiscordCategories).find(
      ([_, categoryId]) => categoryId === id,
    );
    return entry ? entry[0] : "Unknown category";
  },
} as const;
