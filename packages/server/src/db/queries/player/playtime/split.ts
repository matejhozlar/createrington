export type PeriodBucket = { bucket: Date; seconds: number };

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function nextDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function startOfHour(date: Date): Date {
  const hour = new Date(date);
  hour.setMinutes(0, 0, 0);
  return hour;
}

function nextHour(date: Date): Date {
  return new Date(date.getTime() + 60 * 60 * 1000);
}

const UNITS = {
  day: { floor: startOfDay, next: nextDay },
  hour: { floor: startOfHour, next: nextHour },
} as const;

/**
 * Distributes `seconds` over the day or hour buckets spanned by
 * [periodStart, periodEnd], proportionally to the wall-clock time each bucket
 * covers. Rounding remainders land in the last bucket so the parts always sum
 * to `seconds`. A zero-length period puts everything in the bucket of
 * `periodEnd`.
 */
export function splitPeriod(
  periodStart: Date,
  periodEnd: Date,
  seconds: number,
  unit: keyof typeof UNITS,
): PeriodBucket[] {
  if (seconds <= 0) return [];

  const { floor, next } = UNITS[unit];
  const wallclockMs = periodEnd.getTime() - periodStart.getTime();

  if (wallclockMs <= 0) {
    return [{ bucket: floor(periodEnd), seconds }];
  }

  const windows: Array<{ bucket: Date; ms: number }> = [];
  let current = floor(periodStart);

  while (current < periodEnd) {
    const following = next(current);
    const windowStart = current <= periodStart ? periodStart : current;
    const windowEnd = following <= periodEnd ? following : periodEnd;
    const ms = windowEnd.getTime() - windowStart.getTime();
    if (ms > 0) {
      windows.push({ bucket: current, ms });
    }
    current = following;
  }

  const buckets: PeriodBucket[] = [];
  let assigned = 0;

  for (let i = 0; i < windows.length; i++) {
    const isLast = i === windows.length - 1;
    const share = isLast
      ? seconds - assigned
      : Math.floor((seconds * windows[i].ms) / wallclockMs);
    assigned += share;
    if (share > 0) {
      buckets.push({ bucket: windows[i].bucket, seconds: share });
    }
  }

  return buckets;
}
