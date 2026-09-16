import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  selectViolationUuids,
  violationFilterInput,
} from "@/trpc/routers/admin/players/violation-filter";

const STRIKES = ["a", "b", "c"];
const BANS = ["b", "c", "d"];

describe("selectViolationUuids", () => {
  it("unions strikes and bans without duplicates for hasViolations", () => {
    expect(
      selectViolationUuids({ hasViolations: true }, STRIKES, BANS),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("intersects strikes and bans when both flags are set", () => {
    expect(
      selectViolationUuids({ hasStrikes: true, hasBans: true }, STRIKES, BANS),
    ).toEqual(["b", "c"]);
  });

  it("returns only the requested list for a single flag", () => {
    expect(selectViolationUuids({ hasStrikes: true }, STRIKES, BANS)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(selectViolationUuids({ hasBans: true }, STRIKES, BANS)).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("returns nothing when no flag is true", () => {
    expect(selectViolationUuids({ hasStrikes: false }, STRIKES, BANS)).toEqual(
      [],
    );
  });

  it("narrows to the exact minecraftUuid when that player has the violation", () => {
    expect(
      selectViolationUuids(
        { hasViolations: true, minecraftUuid: "d" },
        STRIKES,
        BANS,
      ),
    ).toEqual(["d"]);
  });

  it("returns nothing when the exact minecraftUuid has no matching violation", () => {
    expect(
      selectViolationUuids(
        { hasStrikes: true, minecraftUuid: "d" },
        STRIKES,
        BANS,
      ),
    ).toEqual([]);
  });
});

describe("violationFilterInput", () => {
  const schema = z.object(violationFilterInput);

  it("lowercases the exact minecraftUuid so both filter paths agree", () => {
    const parsed = schema.parse({
      minecraftUuid: "A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11",
    });

    expect(parsed.minecraftUuid).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  });

  it("rejects a minecraftUuid that is not a UUID", () => {
    expect(schema.safeParse({ minecraftUuid: "steve" }).success).toBe(false);
  });

  it("leaves every field optional", () => {
    expect(schema.parse({})).toEqual({});
  });
});
