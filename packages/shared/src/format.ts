const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a date-only string ("2026-09-09") to a Date pinned at midday local
 * time, so the calendar day survives timezone conversion in either direction.
 */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

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
      ? parseDateOnly(value)
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
 * "2h 30m", "45m", "12s". Negative input clamps to "0s" so callers holding a
 * stale clock snapshot never render a negative duration.
 */
export function formatCompactDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${whole}s`;
}

const wholeMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const fractionalMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an in-game currency amount the way players see it everywhere:
 * "$50", "$1,250", "$3.50". Whole amounts render without cents; anything
 * with a fraction renders both digits, so a balance never reads "$3.5".
 * Amounts below a cent round to "$0.00" rather than disappearing.
 */
export function formatMoney(amount: number): string {
  return Number.isInteger(amount)
    ? wholeMoneyFormatter.format(amount)
    : fractionalMoneyFormatter.format(amount);
}
