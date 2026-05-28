/**
 * Converts snake_case string to camelCase
 */
type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
  : S;

/**
 * Converts all object keys from snake_case to camelCase
 */
export type CamelCaseKeys<T> = {
  [K in keyof T as SnakeToCamelCase<K & string>]: T[K];
};

/**
 * Converts all object keys from camelCase to snake_case
 */
type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${CamelToSnakeCase<U>}`
    : `${Lowercase<T>}_${CamelToSnakeCase<Uncapitalize<U>>}`
  : S;

/**
 * Converts all object keys from camelCase to snake_case
 */
export type SnakeCaseKeys<T> = {
  [K in keyof T as CamelToSnakeCase<K & string>]: T[K];
};
