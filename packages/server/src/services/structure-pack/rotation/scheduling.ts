import { dateInTimezone, periodIntervalMs } from "./timezone";
import type { RotationConfig } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type OccurrenceDirection = "next" | "previous";

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

/**
 * Returns the configured rotation time nearest to `now` in the given
 * direction: the next one strictly after `now`, or the previous one at or
 * before it (the start of the current cycle, which scopes boost purchases).
 *
 * Wall-clock dates are taken in the configured IANA timezone so that DST
 * transitions do not shift the scheduled time.
 */
export function occurrence(
  cfg: RotationConfig,
  now: Date,
  direction: OccurrenceDirection,
): Date {
  const [hours, minutes] = cfg.time.split(":").map(Number);
  const today = wallClockDate(cfg.timezone, now);
  const step = direction === "next" ? 1 : -1;
  const weekOffset =
    direction === "next"
      ? wrapWeek(cfg.dayOfWeek - today.weekday)
      : -wrapWeek(today.weekday - cfg.dayOfWeek);

  const at = (periods: number): Date => {
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

  const candidate = at(0);
  const onWrongSide =
    direction === "next"
      ? candidate.getTime() <= now.getTime()
      : candidate.getTime() > now.getTime();
  return onWrongSide ? at(step) : candidate;
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
 * A rotation is considered missed when the elapsed time since `lastRotatedAt`
 * exceeds one full period plus the configured grace period.
 */
export function checkMissedRotation(
  cfg: RotationConfig,
  lastRotatedAt: Date,
): boolean {
  const expectedInterval = periodIntervalMs(cfg.period);
  const gracePeriod = cfg.gracePeriodMinutes * 60 * 1000;
  return Date.now() - lastRotatedAt.getTime() > expectedInterval + gracePeriod;
}
