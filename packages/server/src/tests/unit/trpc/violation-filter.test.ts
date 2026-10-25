import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  violationFilterInput,
  violationRequirement,
} from "@/trpc/routers/admin/players/violation-filter";

describe("violationRequirement", () => {
  it("asks for either violation when hasViolations is set", () => {
    expect(violationRequirement({ hasViolations: true })).toBe("either");
    expect(
      violationRequirement({ hasViolations: true, hasStrikes: true }),
    ).toBe("either");
  });

  it("asks for both when strikes and bans are both required", () => {
    expect(violationRequirement({ hasStrikes: true, hasBans: true })).toBe(
      "both",
    );
  });

  it("asks for the single requested violation", () => {
    expect(violationRequirement({ hasStrikes: true })).toBe("strikes");
    expect(violationRequirement({ hasBans: true })).toBe("bans");
    expect(violationRequirement({ hasBans: true, hasStrikes: false })).toBe(
      "bans",
    );
  });

  it("matches nobody when a flag is given but none is true", () => {
    expect(violationRequirement({ hasStrikes: false })).toBe("none");
    expect(violationRequirement({ hasViolations: false })).toBe("none");
  });

  it("imposes nothing when no flag is given", () => {
    expect(violationRequirement({})).toBeNull();
    expect(violationRequirement({ minecraftUuid: "x" })).toBeNull();
  });
});

describe("violationFilterInput", () => {
  const schema = z.object(violationFilterInput);

  it("lowercases the exact minecraftUuid so both filter paths agree", () => {
    const parsed = schema.parse({
      minecraftUuid: "069A79F4-44E9-4726-A5BE-FCA90E38AAF5",
    });
    expect(parsed.minecraftUuid).toBe("069a79f4-44e9-4726-a5be-fca90e38aaf5");
  });

  it("rejects a minecraftUuid that is not a UUID", () => {
    expect(() => schema.parse({ minecraftUuid: "steve" })).toThrow();
  });

  it("leaves every field optional", () => {
    expect(schema.parse({})).toEqual({});
  });
});
