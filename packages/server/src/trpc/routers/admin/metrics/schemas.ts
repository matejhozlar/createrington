import { z } from "zod";

/** Date range input with day/week granularity */
export const dateRangeInput = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  granularity: z.enum(["day", "week"]).default("day"),
});

/** Date range input with day/week/month granularity */
export const dateRangeWithMonthInput = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});
