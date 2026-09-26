import { describe, it, expect } from "vitest";
import { toNetWorthEntries } from "@/services/discord/leaderboard/networth";

describe("toNetWorthEntries", () => {
  it("numbers ranked rows in order and formats their balances", () => {
    const result = toNetWorthEntries([
      { minecraftUuid: "uuid-c", minecraftUsername: "Carol", balance: 300 },
      { minecraftUuid: "uuid-b", minecraftUsername: "Bob", balance: 250 },
      { minecraftUuid: "uuid-a", minecraftUsername: "Alice", balance: 125 },
    ]);

    expect(result.map((e) => e.playerName)).toEqual(["Carol", "Bob", "Alice"]);
    expect(result.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(result[0]).toMatchObject({ playerUuid: "uuid-c", value: "300.00" });
    expect(result[2]).toMatchObject({ playerName: "Alice", value: "125.00" });
    expect(result[0].formattedValue).toBeTruthy();
  });
});
