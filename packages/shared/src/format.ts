const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats a date as "Sep 9, 2026". Date-only strings ("2026-09-09") are
 * pinned to midday local time so the rendered day never shifts across
 * timezones. Returns the fallback for null, undefined, or invalid input.
 */
export function formatDate(
  value: string | Date | null | undefined,
  fallback = "Unknown",
): string {
  if (!value) return fallback;
  const date =
    typeof value === "string" && DATE_ONLY_PATTERN.test(value)
      ? new Date(`${value}T12:00:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats aggregate playtime as "Xh Ym" ("0h 5m", "120h 0m"), never rolling
 * hours over into days.
 */
export function formatPlaytime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${totalHours}h ${minutes}m`;
}

/**
 * Formats an elapsed span compactly, keeping only the leading unit pair:
 * "2h 30m", "45m", "12s".
 */
export function formatDuration(seconds: number): string {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${whole}s`;
}
