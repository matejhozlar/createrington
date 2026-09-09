import { describe, it, expect } from "vitest";
import {
  formatCompactDuration,
  formatDate,
  formatPlaytime,
} from "@createrington/shared/format";

describe("formatDate", () => {
  it("formats a local datetime string", () => {
    expect(formatDate("2026-09-09T12:00:00")).toBe("Sep 9, 2026");
  });

  it("formats a Date object", () => {
    expect(formatDate(new Date(2026, 8, 9, 12))).toBe("Sep 9, 2026");
  });

  it("pins date-only strings to midday so the day never shifts", () => {
    expect(formatDate("2026-09-09")).toBe("Sep 9, 2026");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("returns the fallback for null and undefined", () => {
    expect(formatDate(null)).toBe("Unknown");
    expect(formatDate(undefined)).toBe("Unknown");
  });

  it("returns the fallback for empty and unparseable strings", () => {
    expect(formatDate("")).toBe("Unknown");
    expect(formatDate("nonsense")).toBe("Unknown");
  });

  it("accepts a custom fallback", () => {
    expect(formatDate(null, "—")).toBe("—");
  });
});

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

describe("formatCompactDuration", () => {
  it("keeps hours and minutes for hour-plus spans", () => {
    expect(formatCompactDuration(9000)).toBe("2h 30m");
    expect(formatCompactDuration(7200)).toBe("2h 0m");
    expect(formatCompactDuration(3661)).toBe("1h 1m");
  });

  it("shows minutes only below one hour", () => {
    expect(formatCompactDuration(2700)).toBe("45m");
    expect(formatCompactDuration(3599)).toBe("59m");
  });

  it("shows seconds below one minute", () => {
    expect(formatCompactDuration(45)).toBe("45s");
    expect(formatCompactDuration(0)).toBe("0s");
  });

  it("floors fractional seconds", () => {
    expect(formatCompactDuration(61.9)).toBe("1m");
    expect(formatCompactDuration(59.9)).toBe("59s");
  });

  it("clamps negative input to 0s", () => {
    expect(formatCompactDuration(-42)).toBe("0s");
    expect(formatCompactDuration(-7200)).toBe("0s");
  });
});
