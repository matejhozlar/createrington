import { z } from "zod";

const isoDate = z.iso.datetime().transform((value) => new Date(value));

/** Start/end bounds, parsed from ISO strings into Date objects */
export const dateRange = z.object({ start: isoDate, end: isoDate });

/** Optional start/end bounds; each one is a Date when present */
export const optionalDateRange = z.object({
  start: isoDate.optional(),
  end: isoDate.optional(),
});

/** Date range with day/week granularity */
export const dateRangeWithGranularity = dateRange.extend({
  granularity: z.enum(["day", "week"]).default("day"),
});

/** Date range with day/week/month granularity */
export const dateRangeWithMonthGranularity = dateRange.extend({
  granularity: z.enum(["day", "week", "month"]).default("day"),
});
