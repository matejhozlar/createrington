import { describe, it, expect } from "vitest";
import { splitPeriod } from "@/db/queries/player/playtime/split";

const at = (iso: string) => new Date(iso);
const sum = (buckets: Array<{ seconds: number }>) =>
  buckets.reduce((total, b) => total + b.seconds, 0);

describe("splitPeriod", () => {
  it("returns nothing for zero seconds", () => {
    expect(
      splitPeriod(
        at("2026-09-14T10:00:00"),
        at("2026-09-14T11:00:00"),
        0,
        "hour",
      ),
    ).toEqual([]);
  });

  it("puts a window inside one hour into that hour's bucket", () => {
    const buckets = splitPeriod(
      at("2026-09-14T10:10:00"),
      at("2026-09-14T10:20:00"),
      600,
      "hour",
    );

    expect(buckets).toEqual([
      { bucket: at("2026-09-14T10:00:00"), seconds: 600 },
    ]);
  });

  it("splits credited seconds across hours in proportion to wall-clock", () => {
    const buckets = splitPeriod(
      at("2026-09-14T10:45:00"),
      at("2026-09-14T11:15:00"),
      600,
      "hour",
    );

    expect(buckets).toEqual([
      { bucket: at("2026-09-14T10:00:00"), seconds: 300 },
      { bucket: at("2026-09-14T11:00:00"), seconds: 300 },
    ]);
  });

  it("gives rounding remainders to the last bucket so the parts sum exactly", () => {
    const buckets = splitPeriod(
      at("2026-09-14T10:40:00"),
      at("2026-09-14T11:20:00"),
      100,
      "hour",
    );

    expect(sum(buckets)).toBe(100);
    expect(buckets[0]).toEqual({
      bucket: at("2026-09-14T10:00:00"),
      seconds: 50,
    });
    expect(buckets[1]).toEqual({
      bucket: at("2026-09-14T11:00:00"),
      seconds: 50,
    });

    const uneven = splitPeriod(
      at("2026-09-14T10:59:00"),
      at("2026-09-14T11:02:00"),
      10,
      "hour",
    );
    expect(sum(uneven)).toBe(10);
    expect(uneven).toEqual([
      { bucket: at("2026-09-14T10:00:00"), seconds: 3 },
      { bucket: at("2026-09-14T11:00:00"), seconds: 7 },
    ]);
  });

  it("drops buckets whose proportional share rounds to zero", () => {
    const buckets = splitPeriod(
      at("2026-09-14T10:59:59"),
      at("2026-09-14T11:59:00"),
      1,
      "hour",
    );

    expect(buckets).toEqual([
      { bucket: at("2026-09-14T11:00:00"), seconds: 1 },
    ]);
  });

  it("puts a zero-length period into the bucket of its end", () => {
    const end = at("2026-09-14T11:30:00");
    const buckets = splitPeriod(end, end, 42, "day");

    expect(buckets).toEqual([
      { bucket: at("2026-09-14T00:00:00"), seconds: 42 },
    ]);
  });

  it("splits across day boundaries", () => {
    const buckets = splitPeriod(
      at("2026-09-14T23:00:00"),
      at("2026-09-15T01:00:00"),
      7200,
      "day",
    );

    expect(buckets).toEqual([
      { bucket: at("2026-09-14T00:00:00"), seconds: 3600 },
      { bucket: at("2026-09-15T00:00:00"), seconds: 3600 },
    ]);
  });
});
