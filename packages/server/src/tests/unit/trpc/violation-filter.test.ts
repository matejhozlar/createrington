import { describe, it, expect } from "vitest";
import { selectViolationUuids } from "@/trpc/routers/admin/players/violation-filter";

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
    expect(selectViolationUuids({ hasStrikes: true }, STRIKES, BANS)).toEqual(
      STRIKES,
    );
    expect(selectViolationUuids({ hasBans: true }, STRIKES, BANS)).toEqual(
      BANS,
    );
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
