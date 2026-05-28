/**
 * Utility type to convert object keys from snake_case to camelCase
 */
export type CamelCaseKeys<T> = {
  [K in keyof T as K extends string ? CamelCase<K> : K]: T[K];
};

/**
 * Convert a single string from snake_case to camelCase
 */
type CamelCase<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
    : Lowercase<S>;
