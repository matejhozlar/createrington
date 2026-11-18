import { z } from "zod";

const isoDate = z.iso.datetime().transform((value) => new Date(value));

export const dateRange = z.object({ start: isoDate, end: isoDate });

export const optionalDateRange = z.object({
  start: isoDate.optional(),
  end: isoDate.optional(),
});

export const dateRangeWithGranularity = dateRange.extend({
  granularity: z.enum(["day", "week"]).default("day"),
});

export const dateRangeWithMonthGranularity = dateRange.extend({
  granularity: z.enum(["day", "week", "month"]).default("day"),
});
