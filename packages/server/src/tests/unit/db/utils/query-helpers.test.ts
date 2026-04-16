import { describe, it, expect } from "vitest";
import {
  formatCriteria,
  createNotFoundError,
  escapeLike,
  getFirstCriteria,
} from "@/db/utils/query-helpers";
import { NotFoundError } from "@/db/utils/errors";

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

describe("getFirstCriteria", () => {
  it("returns the first key-value pair (insertion order)", () => {
    expect(getFirstCriteria({ discordId: "123", username: "alice" })).toEqual({
      key: "discordId",
      value: "123",
    });
  });

  it("preserves the value's runtime type", () => {
    const result = getFirstCriteria({ count: 42, name: "x" });
    expect(result.key).toBe("count");
    expect(result.value).toBe(42);
  });
});
