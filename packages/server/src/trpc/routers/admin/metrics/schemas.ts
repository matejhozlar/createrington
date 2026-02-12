import { z } from "zod";

/** Date range input with day/week granularity */
export const dateRangeInput = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  granularity: z.enum(["day", "week"]).default("day"),
});

/** Date range input with day/week/month granularity */
export const dateRangeWithMonthInput = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});
