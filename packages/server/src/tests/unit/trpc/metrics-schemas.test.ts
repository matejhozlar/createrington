import { describe, it, expect } from "vitest";
import {
  dateRange,
  dateRangeInput,
  optionalDateRange,
} from "@/trpc/routers/admin/metrics/schemas";

const START = "2026-09-01T00:00:00.000Z";
const END = "2026-09-16T12:30:00.000Z";

describe("metrics date range schemas", () => {
  it("parses ISO bounds into Date objects", () => {
    const parsed = dateRange.parse({ start: START, end: END });

    expect(parsed.start).toBeInstanceOf(Date);
    expect(parsed.end).toBeInstanceOf(Date);
    expect(parsed.start.toISOString()).toBe(START);
    expect(parsed.end.toISOString()).toBe(END);
  });

  it("keeps the granularity default next to the parsed bounds", () => {
    const parsed = dateRangeInput.parse({ start: START, end: END });

    expect(parsed.granularity).toBe("day");
    expect(parsed.start).toBeInstanceOf(Date);
  });

  it("leaves absent optional bounds undefined and parses present ones", () => {
    const parsed = optionalDateRange.parse({ start: START });

    expect(parsed.start).toBeInstanceOf(Date);
    expect(parsed.end).toBeUndefined();
  });

  it("rejects a bound that is not an ISO datetime", () => {
    expect(() => dateRange.parse({ start: "yesterday", end: END })).toThrow();
  });
});
