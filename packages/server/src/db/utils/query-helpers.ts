import { NotFoundError } from "./errors";

/**
 * Formats criteria object into readable string for error messages
 */
export function formatCriteria(criteria: Record<string, unknown>): string {
  return Object.entries(criteria)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

/**
 * Creates a standardized "not found" error
 */
export function createNotFoundError(
  entityName: string,
  criteria: Record<string, unknown>,
): NotFoundError {
  return new NotFoundError(entityName, criteria);
}

/**
 * Escapes SQL LIKE/ILIKE wildcard characters in user input
 *
 * Prevents users from injecting `%` (match any) or `_` (match one)
 * wildcards into search queries.
 */
export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Extracts the first key-value pair from a criteria object
 * Useful for discriminated union types
 */
export function getFirstCriteria<T extends Record<string, unknown>>(
  criteria: T,
): { key: keyof T; value: T[keyof T] } {
  const key = Object.keys(criteria)[0] as keyof T;
  return { key, value: criteria[key] };
}
