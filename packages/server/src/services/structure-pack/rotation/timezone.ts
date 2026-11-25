import type { RotationPeriod } from "./types";

export const FALLBACK_TIMEZONE = "UTC";

/** Whether `zone` is an IANA timezone this runtime can format dates in. */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** How many milliseconds one period lasts (approximate, for missed-rotation detection). */
export function periodIntervalMs(period: RotationPeriod): number {
  switch (period) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Converts a wall-clock time in a given IANA timezone to a UTC Date.
 *
 * Example: dateInTimezone(2026, 0, 5, 12, 0, "Europe/Prague")
 * returns the UTC instant that corresponds to 2026-01-05 12:00 in Prague.
 */
export function dateInTimezone(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timezone: string,
): Date {
  const guess = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(guess);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const wallDate = new Date(
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") === 24 ? 0 : get("hour"),
      get("minute"),
    ),
  );

  const offsetMs = guess.getTime() - wallDate.getTime();
  return new Date(guess.getTime() + offsetMs);
}
