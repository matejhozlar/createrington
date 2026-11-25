import { dateInTimezone } from "./timezone";
import type { RotationConfig } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function wallClockDate(timezone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  const weekday = WEEKDAYS.indexOf(
    part("weekday") as (typeof WEEKDAYS)[number],
  );
  return {
    year: Number(part("year") ?? 0),
    month: Number(part("month") ?? 0) - 1,
    day: Number(part("day") ?? 0),
    weekday: weekday === -1 ? now.getDay() : weekday,
  };
}

function wrapWeek(days: number): number {
  return ((days % 7) + 7) % 7;
}

function occurrenceAround(
  cfg: RotationConfig,
  now: Date,
): (periods: number) => Date {
  const [hours, minutes] = cfg.time.split(":").map(Number);
  const today = wallClockDate(cfg.timezone, now);
  const weekOffset = wrapWeek(cfg.dayOfWeek - today.weekday);

  return (periods) => {
    switch (cfg.period) {
      case "daily":
        return dateInTimezone(
          today.year,
          today.month,
          today.day + periods,
          hours,
          minutes,
          cfg.timezone,
        );
      case "monthly":
        return dateInTimezone(
          today.year,
          today.month + periods,
          cfg.dayOfMonth,
          hours,
          minutes,
          cfg.timezone,
        );
      case "weekly":
        return dateInTimezone(
          today.year,
          today.month,
          today.day + weekOffset + 7 * periods,
          hours,
          minutes,
          cfg.timezone,
        );
    }
  };
}

/**
 * Returns the first configured rotation time strictly after `now`.
 *
 * Wall-clock dates are taken in the configured IANA timezone so that DST
 * transitions do not shift the scheduled time.
 */
export function nextOccurrence(cfg: RotationConfig, now: Date): Date {
  const at = occurrenceAround(cfg, now);
  const candidate = at(0);
  return candidate.getTime() <= now.getTime() ? at(1) : candidate;
}

/** Returns the last configured rotation time at or before `now`, in the configured timezone. */
export function previousOccurrence(cfg: RotationConfig, now: Date): Date {
  const at = occurrenceAround(cfg, now);
  const candidate = at(0);
  return candidate.getTime() <= now.getTime() ? candidate : at(-1);
}

export function describeSchedule(cfg: RotationConfig): string {
  switch (cfg.period) {
    case "daily":
      return `daily at ${cfg.time}`;
    case "monthly":
      return `monthly on day ${cfg.dayOfMonth} at ${cfg.time}`;
    case "weekly":
      return `weekly on ${WEEKDAYS[cfg.dayOfWeek]} at ${cfg.time}`;
  }
}

/**
 * Returns true if a rotation was missed since the last recorded rotation.
 *
 * A rotation is missed when a scheduled time lies between `lastRotatedAt` and
 * now. A rotation recorded up to the grace period before a scheduled time
 * still counts for it, which absorbs clock differences between the database
 * that stamps the rotation and this process.
 */
export function checkMissedRotation(
  cfg: RotationConfig,
  lastRotatedAt: Date,
): boolean {
  const gracePeriod = cfg.gracePeriodMinutes * 60 * 1000;
  const scheduled = previousOccurrence(cfg, new Date());
  return scheduled.getTime() - lastRotatedAt.getTime() > gracePeriod;
}
