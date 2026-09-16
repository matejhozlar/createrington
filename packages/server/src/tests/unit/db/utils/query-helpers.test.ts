import { describe, it, expect } from "vitest";
import {
  formatCriteria,
  createNotFoundError,
  escapeLike,
  ilikeContains,
  calendarDay,
} from "@/db/utils/query-helpers";
import { NotFoundError } from "@/db/utils/errors";

describe("calendarDay", () => {
  it("formats the local calendar day as YYYY-MM-DD", () => {
    expect(calendarDay(new Date(2026, 6, 18, 0, 0, 0))).toBe("2026-07-18");
    expect(calendarDay(new Date(2026, 0, 5, 23, 59, 59))).toBe("2026-01-05");
  });

  it("uses local time rather than UTC", () => {
    const localMidnight = new Date(2026, 6, 18, 0, 0, 0);
    expect(calendarDay(localMidnight)).toBe("2026-07-18");
    expect(calendarDay(new Date(localMidnight.getTime() - 1))).toBe(
      "2026-07-17",
    );
  });
});

describe("formatCriteria", () => {
  it("formats a single key-value pair", () => {
    expect(formatCriteria({ id: 1 })).toBe("id: 1");
  });

  it("joins multiple pairs with comma + space, in insertion order", () => {
    expect(formatCriteria({ a: 1, b: 2, c: 3 })).toBe("a: 1, b: 2, c: 3");
  });

  it("formats null and undefined values verbatim", () => {
    expect(formatCriteria({ x: null, y: undefined })).toBe(
      "x: null, y: undefined",
    );
  });

  it("returns an empty string for an empty object", () => {
    expect(formatCriteria({})).toBe("");
  });
});

describe("createNotFoundError", () => {
  it("returns a NotFoundError with the given entity and criteria", () => {
    const err = createNotFoundError("Player", { discordId: "123" });
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.entityName).toBe("Player");
    expect(err.criteria).toEqual({ discordId: "123" });
    expect(err.message).toBe("Player not found with discordId: 123");
  });
});

describe("escapeLike", () => {
  it("escapes the % wildcard", () => {
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("escapes the _ wildcard", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes existing backslashes", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("escapes a mix of special characters in one pass", () => {
    expect(escapeLike("100%_done\\!")).toBe("100\\%\\_done\\\\!");
  });

  it("returns plain text unchanged", () => {
    expect(escapeLike("hello world")).toBe("hello world");
  });

  it("returns an empty string unchanged", () => {
    expect(escapeLike("")).toBe("");
  });
});

describe("ilikeContains", () => {
  it("wraps the needle in wildcards", () => {
    expect(ilikeContains("steve")).toEqual({ $ilike: "%steve%" });
  });

  it("escapes wildcards inside the needle so they match literally", () => {
    expect(ilikeContains("100%_x")).toEqual({ $ilike: "%100\\%\\_x%" });
  });
});
