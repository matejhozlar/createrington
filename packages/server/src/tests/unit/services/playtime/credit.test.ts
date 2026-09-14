import { describe, it, expect } from "vitest";
import { computeCredit, parsePlayTimeTicks } from "@/services/playtime/credit";

const T0 = new Date("2026-09-14T10:00:00Z");
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe("computeCredit", () => {
  it("credits wall-clock when the session was never tick-tracked", () => {
    const credit = computeCredit({
      periodStart: T0,
      periodEnd: after(90),
      lastPlayTicks: undefined,
      playTimeTicks: undefined,
    });

    expect(credit.seconds).toBe(90);
    expect(credit.playTimeTicks).toBeUndefined();
  });

  it("credits wall-clock and adopts the first tick reading as the baseline", () => {
    const credit = computeCredit({
      periodStart: T0,
      periodEnd: after(90),
      lastPlayTicks: null,
      playTimeTicks: 5000,
    });

    expect(credit.seconds).toBe(90);
    expect(credit.playTimeTicks).toBe(5000);
  });

  it("credits the tick delta at 20 ticks per second", () => {
    const credit = computeCredit({
      periodStart: T0,
      periodEnd: after(60),
      lastPlayTicks: 1000,
      playTimeTicks: 1000 + 45 * 20,
    });

    expect(credit.seconds).toBe(45);
    expect(credit.playTimeTicks).toBe(1900);
  });

  it("credits nothing when the stat did not advance", () => {
    const credit = computeCredit({
      periodStart: T0,
      periodEnd: after(300),
      lastPlayTicks: 1000,
      playTimeTicks: 1000,
    });

    expect(credit.seconds).toBe(0);
  });

  it("credits nothing for a tick-tracked session with no new reading", () => {
    const credit = computeCredit({
      periodStart: T0,
      periodEnd: after(300),
      lastPlayTicks: 1000,
      playTimeTicks: undefined,
    });

    expect(credit.seconds).toBe(0);
    expect(credit.playTimeTicks).toBeUndefined();
  });

  it("treats a stat that went backwards as a reset: zero credit, new baseline", () => {
    const credit = computeCredit({
      periodStart: T0,
      periodEnd: after(60),
      lastPlayTicks: 100000,
      playTimeTicks: 40,
    });

    expect(credit.seconds).toBe(0);
    expect(credit.playTimeTicks).toBe(40);
  });

  it("caps the tick delta at wall-clock plus catch-up slack", () => {
    const credit = computeCredit({
      periodStart: T0,
      periodEnd: after(60),
      lastPlayTicks: 0,
      playTimeTicks: 10_000 * 20,
    });

    expect(credit.seconds).toBe(90);
  });

  it("never credits negative wall-clock", () => {
    const credit = computeCredit({
      periodStart: after(10),
      periodEnd: T0,
      lastPlayTicks: undefined,
      playTimeTicks: undefined,
    });

    expect(credit.seconds).toBe(0);
  });
});

describe("parsePlayTimeTicks", () => {
  it("accepts non-negative integers", () => {
    expect(parsePlayTimeTicks(0)).toBe(0);
    expect(parsePlayTimeTicks(123456)).toBe(123456);
  });

  it("rejects everything else", () => {
    expect(parsePlayTimeTicks(-1)).toBeUndefined();
    expect(parsePlayTimeTicks(1.5)).toBeUndefined();
    expect(parsePlayTimeTicks("100")).toBeUndefined();
    expect(parsePlayTimeTicks(null)).toBeUndefined();
    expect(parsePlayTimeTicks(undefined)).toBeUndefined();
    expect(parsePlayTimeTicks(Number.NaN)).toBeUndefined();
  });
});
