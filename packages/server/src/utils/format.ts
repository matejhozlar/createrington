/**
 * Formatting utilities for Discord messages and embeds
 *
 * Provides consistent formatting for common data types like playtime,
 * currency, numbers, and dates across the application
 */

/**
 * Formats playtime in seconds to a human-readable string
 *
 * Converts total seconds into hours and minutes format.
 * Always displays as hours and minutes, no matter how large.
 *
 * @param seconds - Total playtime in seconds
 * @returns Formatted string
 *
 * @example
 * formatPlaytime(0)        // "0h 0m"
 * formatPlaytime(120)      // "0h 2m"
 * formatPlaytime(3661)     // "1h 1m"
 * formatPlaytime(36000)    // "10h 0m"
 * formatPlaytime(90000)    // "25h 0m"
 * formatPlaytime(360000)   // "100h 0m"
 */
export function formatPlaytime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${totalHours}h ${minutes}m`;
}

/**
 * Formats a balance/currency value in American format
 *
 * Always floors the value (no decimals) and formats with commas
 * for thousands separators. Adds dollar sign prefix.
 *
 * @param balance - The balance amount (can be number or string)
 * @returns Formatted currency string
 *
 * @example
 * formatBalance(0)           // "$0"
 * formatBalance(100)         // "$100"
 * formatBalance(1000)        // "$1,000"
 * formatBalance(1234567)     // "$1,234,567"
 * formatBalance(1234.56)     // "$1,234"
 * formatBalance("9999.99")   // "$9,999"
 */
export function formatBalance(balance: number | string): string {
  const numericValue =
    typeof balance === "string" ? parseFloat(balance) : balance;

  if (isNaN(numericValue)) {
    return "$0";
  }

  const floored = Math.floor(numericValue);
  const formatted = floored.toLocaleString("en-US");

  return `$${formatted}`;
}

/**
 * Formats a number of days with proper pluralization
 *
 * @param days - Number of days
 * @returns Formatted string with day count
 *
 * @example
 * formatDaysCount(0)     // "0 days"
 * formatDaysCount(1)     // "1 day"
 * formatDaysCount(5)     // "5 days"
 */
export function formatDaysCount(days: number): string {
  return `${days} ${pluralize(days, "day")}`;
}

/**
 * Formats a duration between two dates
 *
 * @param start - Start date
 * @param end - End date (defaults to now)
 * @returns Human-readable duration string
 *
 * @example
 * formatDuration(pastDate, now) // "2 hours and 30 minutes"
 * formatDuration(pastDate)      // "5 days and 3 hours"
 */
export function formatDuration(start: Date, end: Date = new Date()): string {
  const diffMs = end.getTime() - start.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds !== 1 ? "s" : ""}`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;

  if (diffHours < 24) {
    if (remainingMinutes === 0) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
    }
    return `${diffHours} hour${
      diffHours !== 1 ? "s" : ""
    } and ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  if (remainingHours === 0) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  }
  return `${diffDays} day${
    diffDays !== 1 ? "s" : ""
  } and ${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`;
}

/**
 * Formats a bare span of seconds, for durations that aren't anchored to a
 * pair of dates (a cooldown length, a configured interval).
 *
 * @param seconds - The span in seconds
 * @returns Human-readable duration string
 *
 * @example
 * formatSeconds(45)     // "45 seconds"
 * formatSeconds(900)    // "15 minutes"
 * formatSeconds(5400)   // "1 hour and 30 minutes"
 */
export function formatSeconds(seconds: number): string {
  return formatDuration(new Date(0), new Date(seconds * 1000));
}

/**
 * Converts a Date to whole seconds since the Unix epoch, the unit Discord's
 * `<t:...>` timestamp markup expects.
 *
 * @param date - The date to convert
 * @returns Seconds since the Unix epoch (floored)
 */
export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Builds a Discord timestamp markup string (`<t:unix:style>`) that clients
 * render in the viewer's local timezone.
 *
 * @param date - The date to render
 * @param style - Discord timestamp style (default "R" for relative)
 * @returns Discord timestamp markup
 *
 * @example
 * discordTimestamp(date)        // "<t:1717000000:R>"
 * discordTimestamp(date, "F")   // "<t:1717000000:F>"
 */
export function discordTimestamp(
  date: Date,
  style: "t" | "T" | "d" | "D" | "f" | "F" | "R" = "R",
): string {
  return `<t:${toUnixSeconds(date)}:${style}>`;
}

/**
 * Pluralizes a word based on count
 *
 * @param count - The count to check
 * @param singular - Singular form of the word
 * @param plural - Plural form (defaults to singular + "s")
 * @returns Pluralized word
 *
 * @example
 * pluralize(1, "item")           // "item"
 * pluralize(5, "item")           // "items"
 * pluralize(1, "box", "boxes")   // "box"
 * pluralize(3, "box", "boxes")   // "boxes"
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  if (count === 1) {
    return singular;
  }
  return plural || `${singular}s`;
}
