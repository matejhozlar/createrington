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
 * Case-insensitive "contains" filter for a text column; LIKE wildcards in
 * the needle are escaped so they match literally
 */
export function ilikeContains(needle: string): { $ilike: string } {
  return { $ilike: `%${escapeLike(needle)}%` };
}

/**
 * Formats a Date as the local YYYY-MM-DD calendar day, the value shape of
 * date columns on both the read and the filter side
 */
export function calendarDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
