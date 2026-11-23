import { describe, expect, it } from "vitest";
import { plural, pluralize } from "@/lib/format";

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    expect(plural(1, "mod")).toBe("mod");
  });

  it("adds an s for zero and for more than one", () => {
    expect(plural(0, "mod")).toBe("mods");
    expect(plural(2, "mod")).toBe("mods");
  });

  it("uses the given plural for irregular nouns", () => {
    expect(plural(1, "party", "parties")).toBe("party");
    expect(plural(3, "party", "parties")).toBe("parties");
  });
});

describe("pluralize", () => {
  it("prefixes the count", () => {
    expect(pluralize(1, "chunk")).toBe("1 chunk");
    expect(pluralize(4, "entry", "entries")).toBe("4 entries");
  });

  it("groups thousands in the count", () => {
    expect(pluralize(12500, "vote")).toBe("12,500 votes");
  });
});
