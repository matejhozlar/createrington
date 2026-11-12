import { describe, it, expect } from "vitest";
import {
  bannedPlayerLabel,
  resolveBannedPlayer,
} from "@/db/repositories/player/ban/banned-player";

describe("resolveBannedPlayer", () => {
  it("uses the live username while the player row exists", () => {
    const player = resolveBannedPlayer(
      { metadata: { minecraftUsername: "old_steve" } },
      { minecraftUsername: "steve" },
    );

    expect(player).toEqual({ name: "steve", wasDeleted: false });
  });

  it("falls back to the username stored on the ban once the row is gone", () => {
    const player = resolveBannedPlayer(
      { metadata: { minecraftUsername: "old_steve" } },
      null,
    );

    expect(player).toEqual({ name: "old_steve", wasDeleted: true });
    expect(bannedPlayerLabel(player)).toBe("old_steve");
  });

  it("has no name for a deleted player whose ban stored none", () => {
    const player = resolveBannedPlayer({ metadata: {} }, null);

    expect(player).toEqual({ name: null, wasDeleted: true });
    expect(bannedPlayerLabel(player)).toBe("Unknown (Deleted)");
  });
});
