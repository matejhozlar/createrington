import { describe, it, expect } from "vitest";
import {
  formatPlaytime,
  formatBalance,
  formatDaysCount,
  formatDuration,
  pluralize,
} from "@/utils/format";

describe("formatPlaytime", () => {
  it("returns 0h 0m for 0 seconds", () => {
    expect(formatPlaytime(0)).toBe("0h 0m");
  });

  it("rounds sub-minute values down to 0m", () => {
    expect(formatPlaytime(59)).toBe("0h 0m");
  });

  it("formats minutes-only durations", () => {
    expect(formatPlaytime(120)).toBe("0h 2m");
  });

  it("formats hour + minute combinations", () => {
    expect(formatPlaytime(3661)).toBe("1h 1m");
  });

  it("formats whole-hour values", () => {
    expect(formatPlaytime(36000)).toBe("10h 0m");
  });

  it("does not roll hours over into days", () => {
    expect(formatPlaytime(90000)).toBe("25h 0m");
    expect(formatPlaytime(360000)).toBe("100h 0m");
  });
});

describe("formatBalance", () => {
  it("formats zero", () => {
    expect(formatBalance(0)).toBe("$0");
  });

  it("formats values without thousands separators", () => {
    expect(formatBalance(100)).toBe("$100");
  });

  it("inserts comma separators", () => {
    expect(formatBalance(1000)).toBe("$1,000");
    expect(formatBalance(1234567)).toBe("$1,234,567");
  });

  it("floors decimal values", () => {
    expect(formatBalance(1234.99)).toBe("$1,234");
  });

  it("accepts numeric strings", () => {
    expect(formatBalance("9999.99")).toBe("$9,999");
  });

  it("returns $0 for non-numeric strings", () => {
    expect(formatBalance("not-a-number")).toBe("$0");
  });

  it("handles negative values", () => {
    // Math.floor(-1.5) === -2, so the sign is preserved.
    expect(formatBalance(-1234.5)).toBe("$-1,235");
  });
});

describe("formatDaysCount", () => {
  it("uses singular for 1", () => {
    expect(formatDaysCount(1)).toBe("1 day");
  });

  it("uses plural for 0 and >1", () => {
    expect(formatDaysCount(0)).toBe("0 days");
    expect(formatDaysCount(5)).toBe("5 days");
  });
});

describe("formatDuration", () => {
  const base = new Date("2026-04-16T12:00:00Z");

  it("uses singular 'second' for 1s", () => {
    const start = new Date(base.getTime() - 1000);
    expect(formatDuration(start, base)).toBe("1 second");
  });

  it("formats sub-minute durations in seconds", () => {
    const start = new Date(base.getTime() - 30_000);
    expect(formatDuration(start, base)).toBe("30 seconds");
  });

  it("formats sub-hour durations in minutes", () => {
    const start = new Date(base.getTime() - 5 * 60_000);
    expect(formatDuration(start, base)).toBe("5 minutes");
  });

  it("formats whole-hour durations without minutes", () => {
    const start = new Date(base.getTime() - 2 * 60 * 60_000);
    expect(formatDuration(start, base)).toBe("2 hours");
  });

  it("formats hour + minute combinations", () => {
    const start = new Date(base.getTime() - (2 * 60 + 30) * 60_000);
    expect(formatDuration(start, base)).toBe("2 hours and 30 minutes");
  });

  it("formats whole-day durations without hours", () => {
    const start = new Date(base.getTime() - 3 * 24 * 60 * 60_000);
    expect(formatDuration(start, base)).toBe("3 days");
  });

  it("formats day + hour combinations", () => {
    const start = new Date(base.getTime() - (5 * 24 + 3) * 60 * 60_000);
    expect(formatDuration(start, base)).toBe("5 days and 3 hours");
  });

  it("uses singular forms when each component is 1", () => {
    const oneMinute = new Date(base.getTime() - 60_000);
    expect(formatDuration(oneMinute, base)).toBe("1 minute");

    const oneHour = new Date(base.getTime() - 60 * 60_000);
    expect(formatDuration(oneHour, base)).toBe("1 hour");

    const oneDay = new Date(base.getTime() - 24 * 60 * 60_000);
    expect(formatDuration(oneDay, base)).toBe("1 day");

    const dayAndHour = new Date(base.getTime() - 25 * 60 * 60_000);
    expect(formatDuration(dayAndHour, base)).toBe("1 day and 1 hour");
  });
});

describe("pluralize", () => {
  it("uses singular for count=1", () => {
    expect(pluralize(1, "item")).toBe("item");
  });

  it("uses plural for 0 and >1", () => {
    expect(pluralize(0, "item")).toBe("items");
    expect(pluralize(5, "item")).toBe("items");
  });

  it("uses an explicit plural override when provided", () => {
    expect(pluralize(1, "box", "boxes")).toBe("box");
    expect(pluralize(3, "box", "boxes")).toBe("boxes");
  });
});
