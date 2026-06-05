import { describe, it, expect } from "vitest";
import { rankNetWorth } from "@/services/discord/leaderboard/networth";

describe("rankNetWorth", () => {
  it("sums crypto holdings and balance per player and ranks descending", () => {
    const holdings = new Map([
      ["uuid-a", 100],
      ["uuid-b", 50],
    ]);
    const balances = [
      { minecraftUuid: "uuid-a", balance: 25 }, // a => 125
      { minecraftUuid: "uuid-b", balance: 200 }, // b => 250
      { minecraftUuid: "uuid-c", balance: 300 }, // c => 300, no crypto
    ];
    const names = new Map([
      ["uuid-a", "Alice"],
      ["uuid-b", "Bob"],
      ["uuid-c", "Carol"],
    ]);

    const result = rankNetWorth(holdings, balances, names, 10);

    expect(result.map((e) => e.playerName)).toEqual(["Carol", "Bob", "Alice"]);
    expect(result.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(result[0]).toMatchObject({ playerUuid: "uuid-c", value: "300.00" });
    expect(result[2]).toMatchObject({ playerName: "Alice", value: "125.00" });
  });

  it("summarizes the balance and crypto split in the subtitle", () => {
    const holdings = new Map([["uuid-a", 100]]);
    const balances = [{ minecraftUuid: "uuid-a", balance: 25 }];

    const [entry] = rankNetWorth(holdings, balances, new Map(), 10);

    expect(entry.subtitle).toContain("balance");
    expect(entry.subtitle).toContain("crypto");
  });

  it("includes players with only crypto or only a balance", () => {
    const holdings = new Map([["only-crypto", 40]]);
    const balances = [{ minecraftUuid: "only-balance", balance: 10 }];

    const result = rankNetWorth(holdings, balances, new Map(), 10);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ playerUuid: "only-crypto" });
    // Unknown name falls back to the UUID
    expect(result[0].playerName).toBe("only-crypto");
  });

  it("respects the limit", () => {
    const holdings = new Map([
      ["a", 3],
      ["b", 2],
      ["c", 1],
    ]);

    const result = rankNetWorth(holdings, [], new Map(), 2);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.rank)).toEqual([1, 2]);
  });
});
