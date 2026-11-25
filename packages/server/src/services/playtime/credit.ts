import type { PlaytimeCredit } from "./types";

export const TICKS_PER_SECOND = 20;

const CATCH_UP_SLACK_SECONDS = 30;

export interface CreditInput {
  periodStart: Date;
  periodEnd: Date;
  lastPlayTicks?: number | null;
  playTimeTicks?: number | null;
}

export function computeCredit(input: CreditInput): PlaytimeCredit {
  const wallclock = Math.max(
    0,
    Math.floor(
      (input.periodEnd.getTime() - input.periodStart.getTime()) / 1000,
    ),
  );
  const observed = input.playTimeTicks ?? undefined;
  const baseline = input.lastPlayTicks ?? undefined;

  let seconds: number;
  let carriedTicks = observed;
  if (baseline === undefined) {
    seconds = wallclock;
  } else if (observed === undefined || observed < baseline) {
    seconds = 0;
  } else {
    const earned = Math.floor((observed - baseline) / TICKS_PER_SECOND);
    const ceiling = wallclock + CATCH_UP_SLACK_SECONDS;
    if (earned <= ceiling) {
      seconds = earned;
      carriedTicks = baseline + earned * TICKS_PER_SECOND;
    } else {
      seconds = ceiling;
    }
  }

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    seconds,
    playTimeTicks: carriedTicks,
  };
}

export function parseEventTimestamp(value: unknown): Date | null {
  if (!value) return new Date();
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
