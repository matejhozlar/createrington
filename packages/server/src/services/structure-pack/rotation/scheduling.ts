import type { StructurePackRotationConfig } from "@createrington/shared/db";
import { dateInTimezone, periodIntervalMs } from "./timezone";
import type { RotationPeriod } from "./types";

/**
 * Returns the next UTC instant at which a rotation should fire for the given config.
 *
 * All wall-clock comparisons are performed in the configured IANA timezone so that
 * DST transitions do not shift the scheduled time.
 */
export function computeNextRotationTime(
  cfg: StructurePackRotationConfig,
): Date {
  const [hours, minutes] = cfg.time.split(":").map(Number);
  const now = new Date();
  const period = cfg.period as RotationPeriod;

  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: cfg.timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) =>
    Number(todayParts.find((p) => p.type === type)?.value ?? 0);

  const todayYear = get("year");
  const todayMonth = get("month") - 1;
  const todayDay = get("day");

  if (period === "daily") {
    const target = dateInTimezone(
      todayYear,
      todayMonth,
      todayDay,
      hours,
      minutes,
      cfg.timezone,
    );
    if (target.getTime() <= now.getTime()) {
      return dateInTimezone(
        todayYear,
        todayMonth,
        todayDay + 1,
        hours,
        minutes,
        cfg.timezone,
      );
    }
    return target;
  }

  if (period === "monthly") {
    const target = dateInTimezone(
      todayYear,
      todayMonth,
      cfg.dayOfMonth,
      hours,
      minutes,
      cfg.timezone,
    );
    if (target.getTime() <= now.getTime()) {
      return dateInTimezone(
        todayYear,
        todayMonth + 1,
        cfg.dayOfMonth,
        hours,
        minutes,
        cfg.timezone,
      );
    }
    return target;
  }

  const weekdayStr = todayParts.find((p) => p.type === "weekday")?.value ?? "";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentDay = dayMap[weekdayStr] ?? now.getDay();

  let daysUntil = cfg.dayOfWeek - currentDay;
  if (daysUntil < 0) daysUntil += 7;

  const targetDate = new Date(
    Date.UTC(todayYear, todayMonth, todayDay + daysUntil),
  );
  const target = dateInTimezone(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
    hours,
    minutes,
    cfg.timezone,
  );

  if (target.getTime() <= now.getTime()) {
    const nextWeek = new Date(targetDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dateInTimezone(
      nextWeek.getUTCFullYear(),
      nextWeek.getUTCMonth(),
      nextWeek.getUTCDate(),
      hours,
      minutes,
      cfg.timezone,
    );
  }

  return target;
}

/**
 * Returns the UTC start timestamp of the current rotation cycle.
 *
 * The cycle start is the most recent past occurrence of the configured
 * rotation time (daily, weekly, or monthly). Boost purchases are scoped
 * to this timestamp so they expire automatically after a rotation fires.
 */
export function computeCycleStart(cfg: StructurePackRotationConfig): Date {
  const [hours, minutes] = cfg.time.split(":").map(Number);
  const now = new Date();
  const period = cfg.period as RotationPeriod;

  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: cfg.timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);

  const get = (type: string) =>
    Number(todayParts.find((p) => p.type === type)?.value ?? 0);

  const todayYear = get("year");
  const todayMonth = get("month") - 1;
  const todayDay = get("day");

  if (period === "daily") {
    const cycleStart = dateInTimezone(
      todayYear,
      todayMonth,
      todayDay,
      hours,
      minutes,
      cfg.timezone,
    );
    if (cycleStart.getTime() > now.getTime()) {
      return dateInTimezone(
        todayYear,
        todayMonth,
        todayDay - 1,
        hours,
        minutes,
        cfg.timezone,
      );
    }
    return cycleStart;
  }

  if (period === "monthly") {
    const cycleStart = dateInTimezone(
      todayYear,
      todayMonth,
      cfg.dayOfMonth,
      hours,
      minutes,
      cfg.timezone,
    );
    if (cycleStart.getTime() > now.getTime()) {
      return dateInTimezone(
        todayYear,
        todayMonth - 1,
        cfg.dayOfMonth,
        hours,
        minutes,
        cfg.timezone,
      );
    }
    return cycleStart;
  }

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekdayStr = todayParts.find((p) => p.type === "weekday")?.value ?? "";
  const currentDay = dayMap[weekdayStr] ?? now.getDay();

  let daysDiff = currentDay - cfg.dayOfWeek;
  if (daysDiff < 0) daysDiff += 7;

  const baseDate = new Date(
    Date.UTC(todayYear, todayMonth, todayDay - daysDiff),
  );
  const cycleStart = dateInTimezone(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
    hours,
    minutes,
    cfg.timezone,
  );

  if (cycleStart.getTime() > now.getTime()) {
    const prevWeek = new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    return dateInTimezone(
      prevWeek.getUTCFullYear(),
      prevWeek.getUTCMonth(),
      prevWeek.getUTCDate(),
      hours,
      minutes,
      cfg.timezone,
    );
  }

  return cycleStart;
}

/**
 * Returns true if a rotation was missed since the last recorded rotation.
 *
 * A rotation is considered missed when the elapsed time since `lastRotatedAt`
 * exceeds one full period plus the configured grace period.
 */
export function checkMissedRotation(
  cfg: StructurePackRotationConfig,
  lastRotatedAt: Date,
): boolean {
  const now = Date.now();
  const expectedInterval = periodIntervalMs(cfg.period as RotationPeriod);
  const gracePeriod = cfg.gracePeriodMinutes * 60 * 1000;
  const timeSinceLastRotation = now - lastRotatedAt.getTime();

  return timeSinceLastRotation > expectedInterval + gracePeriod;
}
