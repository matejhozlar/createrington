import { formatRelativeDate } from "@/lib/format";

export function toIso(value: string | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isMeaningfulDate(date: Date): boolean {
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 2001;
}

export function formatRelativeDateSafe(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (value == null) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (!isMeaningfulDate(date)) return fallback;
  return formatRelativeDate(date);
}

export function formatFullDateSafe(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (value == null) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (!isMeaningfulDate(date)) return fallback;
  return formatFullDate(date.toISOString());
}
