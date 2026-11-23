import { NotFoundError } from "./errors";

export type Granularity = "day" | "week" | "month";

export function formatCriteria(criteria: Record<string, unknown>): string {
  return Object.entries(criteria)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export function createNotFoundError(
  entityName: string,
  criteria: Record<string, unknown>,
): NotFoundError {
  return new NotFoundError(entityName, criteria);
}

export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

export function ilikeContains(needle: string): { $ilike: string } {
  return { $ilike: `%${escapeLike(needle)}%` };
}

export function calendarDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
