/**
 * Naming convention utilities for case transformations
 *
 * This module provides reliable string transformations between common naming
 * conventions used in database schemas (snake_case) and TypeScript code
 * (camelCase and PascalCase). Essential for generating idiomatic TypeScript
 * code from database schemas.
 */

/**
 * Converts snake_case strings to camelCase
 *
 * Transforms database column names and table names into JavaScript-style
 * camelCase identifiers. The first character remains lowercase, and each
 * underscore followed by a letter is replaced with the uppercase letter.
 *
 * @param str - The snake_case string to convert
 * @returns The string converted to camelCase
 *
 * @example
 * ```typescript
 * snakeToCamel('user_id');        // Returns: 'userId'
 * snakeToCamel('created_at');     // Returns: 'createdAt'
 * snakeToCamel('is_active');      // Returns: 'isActive'
 * snakeToCamel('first_name_alt'); // Returns: 'firstNameAlt'
 * ```
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Converts snake_case strings to PascalCase
 *
 * Transforms database table names into TypeScript class/interface names.
 * Each word (separated by underscores) is capitalized, and underscores
 * are removed. Ideal for generating type names and class names.
 *
 * @param str - The snake_case string to convert
 * @returns The string converted to PascalCase
 *
 * @example
 * ```typescript
 * snakeToPascal('user');              // Returns: 'User'
 * snakeToPascal('user_profile');      // Returns: 'UserProfile'
 * snakeToPascal('oauth_token');       // Returns: 'OauthToken'
 * snakeToPascal('api_rate_limit');    // Returns: 'ApiRateLimit'
 * ```
 */
export function snakeToPascal(str: string): string {
  return str
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Converts camelCase strings to snake_case
 *
 * Transforms JavaScript-style camelCase identifiers back into database-style
 * snake_case. Inserts an underscore before each uppercase letter and converts
 * it to lowercase. Useful for reverse transformations or query generation.
 *
 * @param camelCase - The camelCase string to convert
 * @returns The string converted to snake_case
 *
 * @example
 * ```typescript
 * camelToSnake('userId');        // Returns: 'user_id'
 * camelToSnake('createdAt');     // Returns: 'created_at'
 * camelToSnake('isActive');      // Returns: 'is_active'
 * camelToSnake('firstName');     // Returns: 'first_name'
 * ```
 */
export function camelToSnake(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
