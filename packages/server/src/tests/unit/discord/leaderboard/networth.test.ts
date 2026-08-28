import { describe, it, expect } from "vitest";
import { rankNetWorth } from "@/services/discord/leaderboard/networth";

describe("rankNetWorth", () => {
  it("ranks players by balance descending", () => {
    const balances = [
      { minecraftUuid: "uuid-a", balance: 125 },
      { minecraftUuid: "uuid-b", balance: 250 },
      { minecraftUuid: "uuid-c", balance: 300 },
    ];
    const names = new Map([
      ["uuid-a", "Alice"],
      ["uuid-b", "Bob"],
      ["uuid-c", "Carol"],
    ]);

    const result = rankNetWorth(balances, names, 10);

    expect(result.map((e) => e.playerName)).toEqual(["Carol", "Bob", "Alice"]);
    expect(result.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(result[0]).toMatchObject({ playerUuid: "uuid-c", value: "300.00" });
    expect(result[2]).toMatchObject({ playerName: "Alice", value: "125.00" });
  });

  it("falls back to the UUID when the name is unknown", () => {
    const balances = [{ minecraftUuid: "only-balance", balance: 10 }];

    const [entry] = rankNetWorth(balances, new Map(), 10);

    expect(entry.playerName).toBe("only-balance");
    expect(entry.formattedValue).toBeTruthy();
  });

  it("respects the limit", () => {
    const balances = [
      { minecraftUuid: "a", balance: 3 },
      { minecraftUuid: "b", balance: 2 },
      { minecraftUuid: "c", balance: 1 },
    ];

    const result = rankNetWorth(balances, new Map(), 2);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.rank)).toEqual([1, 2]);
  });
});
