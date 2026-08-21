/**
 * Shared camelCase -> SCREAMING_SNAKE_CASE helpers for Discord constant namespaces
 *
 * Both the runtime function and the type-level utility must stay in step so the
 * generated namespace keys line up with their declared types.
 */

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
export function toScreamingSnakeCase(str: string): string {
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
export type ToScreamingSnakeCase<S extends string> =
  S extends `${infer T}${infer U}`
    ? U extends Uncapitalize<U>
      ? `${Uppercase<T>}${ToScreamingSnakeCase<U>}`
      : `${Uppercase<T>}_${ToScreamingSnakeCase<U>}`
    : S;
