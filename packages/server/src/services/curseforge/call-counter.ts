import { DailyCounter } from "@/services/daily-counter";
import { redisService } from "@/services/redis";

export const CURSEFORGE_CALL_COUNTS = [
  "calls",
  "refused",
  "throttled",
] as const;

export type CurseForgeCallCount = (typeof CURSEFORGE_CALL_COUNTS)[number];

const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;

export const curseforgeCallCounter = new DailyCounter<CurseForgeCallCount>(
  "count:curseforge",
  redisService,
);

/**
 * Counts one request this app sent to the CurseForge API: always as a call,
 * and as refused (403) or throttled (429) when CurseForge answered so.
 * `status` is null for a request that got no answer.
 */
export function countCurseForgeCall(status: number | null): void {
  curseforgeCallCounter.add("calls");
  if (status === HTTP_FORBIDDEN) curseforgeCallCounter.add("refused");
  if (status === HTTP_TOO_MANY_REQUESTS) curseforgeCallCounter.add("throttled");
}
