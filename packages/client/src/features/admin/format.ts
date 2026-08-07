import { formatRelativeDate } from "@/lib/format";

export { formatRelativeDate };

export function formatConfigKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
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

// Mod-synced timestamps occasionally arrive as 0/epoch when the upstream
// value is unset. Treat anything before 2001 as "no real timestamp" so the
// UI doesn't render "1 Jan 1970".
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
