import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";
import {
  getTestPool,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";
const CAROL = "33333333-3333-3333-3333-333333333333";

async function seedPlayer(uuid: string, name: string, discordId: string) {
  await Q.player.create({
    minecraftUuid: uuid,
    minecraftUsername: name,
    discordId,
  });
}

beforeAll(async () => {
  await getTestPool().query("SELECT 1");
});

beforeEach(async () => {
  await truncateTable("player");
});

afterAll(async () => {
  await cleanupTestPool();
});

describe("Q.player.balance (hierarchical singleton)", () => {
  it("exposes the same singleton instance per pool", () => {
    expect(Q.player.balance).toBe(Q.player.balance);
    expect(Q.player.balance.transaction).toBe(Q.player.balance.transaction);
  });

  it("round-trips a bigint balance with camelCase fields", async () => {
    await seedPlayer(ALICE, "alice", "100");
    await Q.player.balance.create({ minecraftUuid: ALICE, balance: 5_000n });

    const row = await Q.player.balance.get({ minecraftUuid: ALICE });
    expect(row.minecraftUuid).toBe(ALICE);
    expect(row.balance).toBe(5_000n);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("updates a balance through the singleton", async () => {
    await seedPlayer(ALICE, "alice", "100");
    await Q.player.balance.create({ minecraftUuid: ALICE, balance: 5_000n });

    await Q.player.balance.update(
      { minecraftUuid: ALICE },
      { balance: 8_000n },
    );

    expect(
      await Q.player.balance.select.balance({ minecraftUuid: ALICE }),
    ).toBe(8_000n);
  });

  it("returns a username-joined leaderboard ordered by balance desc", async () => {
    await seedPlayer(ALICE, "alice", "100");
    await seedPlayer(BOB, "bob", "200");
    await seedPlayer(CAROL, "carol", "300");
    await Q.player.balance.create({ minecraftUuid: ALICE, balance: 3_000n });
    await Q.player.balance.create({ minecraftUuid: BOB, balance: 9_000n });
    await Q.player.balance.create({ minecraftUuid: CAROL, balance: 1_000n });

    const top = await Q.player.balance.getTop(2);
    expect(top).toEqual([
      { name: "bob", balance: 9 },
      { name: "alice", balance: 3 },
    ]);
  });

  it("aggregates total balance in circulation", async () => {
    await seedPlayer(ALICE, "alice", "100");
    await seedPlayer(BOB, "bob", "200");
    await Q.player.balance.create({ minecraftUuid: ALICE, balance: 2_500n });
    await Q.player.balance.create({ minecraftUuid: BOB, balance: 7_500n });

    const { totalBalance, playerCount } =
      await Q.player.balance.getTotalInCirculation();
    expect(totalBalance).toBe(10);
    expect(playerCount).toBe(2);
  });

  it("accesses the nested transaction child singleton", async () => {
    await seedPlayer(ALICE, "alice", "100");
    await Q.player.balance.create({ minecraftUuid: ALICE, balance: 5_000n });

    await Q.player.balance.transaction.create({
      playerMinecraftUuid: ALICE,
      amount: 5_000n,
      balanceBefore: 0n,
      balanceAfter: 5_000n,
      transactionType: "reward",
    });

    const rows = await Q.player.balance.transaction.findAll({
      playerMinecraftUuid: ALICE,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(5_000n);
    expect(rows[0].balanceAfter).toBe(5_000n);
  });
});
