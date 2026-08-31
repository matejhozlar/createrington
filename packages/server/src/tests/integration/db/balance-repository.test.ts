import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { R, Q } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import {
  getTestPool,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

async function seedPlayer(
  uuid: string,
  name: string,
  discordId: string,
  initialBalance: number,
): Promise<void> {
  await Q.player.create({
    minecraftUuid: uuid,
    minecraftUsername: name,
    discordId,
  });
  await R.balanceRepo.create(uuid, initialBalance);
}

beforeAll(async () => {
  await getTestPool().query("SELECT 1");
});

beforeEach(async () => {
  // Cascades to player_balance and player_balance_transaction.
  await truncateTable("player");
  // admin_log_action has no cascading FK to player, so clear it explicitly.
  await truncateTable("admin_log_action");
});

afterAll(async () => {
  await cleanupTestPool();
});

describe("BalanceRepository (integration)", () => {
  describe("add", () => {
    it("increases the balance and records a transaction", async () => {
      await seedPlayer(ALICE, "alice", "100", 10);

      const newBalance = await R.balanceRepo.add(
        ALICE,
        5.5,
        "reward",
        BalanceTransactionType.REWARD,
      );

      expect(newBalance).toBe(15.5);
      expect(await R.balanceRepo.getRaw(ALICE)).toBe(15_500n);

      const history = await R.balanceRepo.getHistory(ALICE);
      expect(history).toHaveLength(2); // initial grant + this add
      expect(history[0].amount).toBe(5_500n);
      expect(history[0].balanceBefore).toBe(10_000n);
      expect(history[0].balanceAfter).toBe(15_500n);
      expect(history[0].transactionType).toBe(BalanceTransactionType.REWARD);
    });

    it("rejects non-positive amounts", async () => {
      await seedPlayer(ALICE, "alice", "100", 10);

      await expect(
        R.balanceRepo.add(ALICE, 0, "noop", BalanceTransactionType.REWARD),
      ).rejects.toThrow("Amount must be positive");
      await expect(
        R.balanceRepo.add(ALICE, -5, "neg", BalanceTransactionType.REWARD),
      ).rejects.toThrow("Amount must be positive");
    });
  });

  describe("deduct", () => {
    it("decreases the balance and records a negative transaction", async () => {
      await seedPlayer(ALICE, "alice", "100", 20);

      const newBalance = await R.balanceRepo.deduct(
        ALICE,
        7.25,
        "purchase",
        BalanceTransactionType.PURCHASE,
      );

      expect(newBalance).toBe(12.75);
      expect(await R.balanceRepo.getRaw(ALICE)).toBe(12_750n);

      const history = await R.balanceRepo.getHistory(ALICE);
      expect(history[0].amount).toBe(-7_250n);
      expect(history[0].balanceAfter).toBe(12_750n);
    });

    it("throws on insufficient funds and leaves the balance untouched", async () => {
      await seedPlayer(ALICE, "alice", "100", 5);

      await expect(
        R.balanceRepo.deduct(
          ALICE,
          10,
          "overdraw",
          BalanceTransactionType.PURCHASE,
        ),
      ).rejects.toThrow("Insufficient balance");

      expect(await R.balanceRepo.getRaw(ALICE)).toBe(5_000n);
    });
  });

  describe("transfer", () => {
    it("moves funds atomically and writes paired ledger entries", async () => {
      await seedPlayer(ALICE, "alice", "100", 100);
      await seedPlayer(BOB, "bob", "200", 0);

      const result = await R.balanceRepo.transfer(ALICE, BOB, 40);

      expect(result.senderBalance).toBe(60);
      expect(result.recipientBalance).toBe(40);
      expect(await R.balanceRepo.getRaw(ALICE)).toBe(60_000n);
      expect(await R.balanceRepo.getRaw(BOB)).toBe(40_000n);

      const senderHistory = await R.balanceRepo.getHistory(ALICE);
      expect(senderHistory[0].transactionType).toBe(
        BalanceTransactionType.TRANSFER_SEND,
      );
      expect(senderHistory[0].amount).toBe(-40_000n);
      expect(senderHistory[0].relatedPlayerUuid).toBe(BOB);

      const recipientHistory = await R.balanceRepo.getHistory(BOB);
      expect(recipientHistory[0].transactionType).toBe(
        BalanceTransactionType.TRANSFER_RECEIVE,
      );
      expect(recipientHistory[0].amount).toBe(40_000n);
    });

    it("rolls back entirely when the sender has insufficient funds", async () => {
      await seedPlayer(ALICE, "alice", "100", 10);
      await seedPlayer(BOB, "bob", "200", 10);

      await expect(R.balanceRepo.transfer(ALICE, BOB, 50)).rejects.toThrow(
        "Insufficient balance",
      );

      expect(await R.balanceRepo.getRaw(ALICE)).toBe(10_000n);
      expect(await R.balanceRepo.getRaw(BOB)).toBe(10_000n);
    });

    it("rejects transfers to self", async () => {
      await seedPlayer(ALICE, "alice", "100", 10);

      await expect(R.balanceRepo.transfer(ALICE, ALICE, 5)).rejects.toThrow(
        "Cannot transfer to self",
      );
    });
  });

  describe("adminGrant / adminDeduct", () => {
    it("adjusts the balance and writes an admin audit log entry", async () => {
      await seedPlayer(ALICE, "alice", "100", 10);

      await R.balanceRepo.adminGrant(ALICE, 15, "999", "adminUser", "grant");
      expect(await R.balanceRepo.getRaw(ALICE)).toBe(25_000n);

      await R.balanceRepo.adminDeduct(ALICE, 5, "999", "adminUser", "deduct");
      expect(await R.balanceRepo.getRaw(ALICE)).toBe(20_000n);

      const grantLogs = await Q.admin.log.action.findAll({
        actionType: "balance_grant",
        targetPlayerUuid: ALICE,
      });
      const deductLogs = await Q.admin.log.action.findAll({
        actionType: "balance_deduct",
        targetPlayerUuid: ALICE,
      });
      expect(grantLogs).toHaveLength(1);
      expect(deductLogs).toHaveLength(1);
    });
  });

  describe("concurrency", () => {
    it("lets exactly one of N concurrent full-balance deducts through", async () => {
      await seedPlayer(ALICE, "alice", "100", 100);

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          R.balanceRepo.deduct(
            ALICE,
            100,
            "withdraw",
            BalanceTransactionType.WITHDRAW,
          ),
        ),
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(7);
      for (const { reason } of rejected) {
        expect((reason as Error).message).toContain("Insufficient balance");
      }

      expect(await R.balanceRepo.getRaw(ALICE)).toBe(0n);

      const history = await R.balanceRepo.getHistory(ALICE);
      const withdrawals = history.filter(
        (t) => t.transactionType === BalanceTransactionType.WITHDRAW,
      );
      expect(withdrawals).toHaveLength(1);
      expect(history.reduce((sum, t) => sum + t.amount, 0n)).toBe(0n);
    });

    it("applies every concurrent partial deduct exactly once with a contiguous ledger", async () => {
      await seedPlayer(ALICE, "alice", "100", 100);

      await Promise.all(
        Array.from({ length: 10 }, () =>
          R.balanceRepo.deduct(
            ALICE,
            10,
            "spend",
            BalanceTransactionType.PURCHASE,
          ),
        ),
      );

      expect(await R.balanceRepo.getRaw(ALICE)).toBe(0n);

      const history = await R.balanceRepo.getHistory(ALICE);
      expect(
        history.filter(
          (t) => t.transactionType === BalanceTransactionType.PURCHASE,
        ),
      ).toHaveLength(10);
      expect(history.reduce((sum, t) => sum + t.amount, 0n)).toBe(0n);

      const oldestFirst = [...history].reverse();
      for (let i = 1; i < oldestFirst.length; i++) {
        expect(oldestFirst[i].balanceBefore).toBe(
          oldestFirst[i - 1].balanceAfter,
        );
      }
    });

    it("lets exactly one of N concurrent full-balance transfers through", async () => {
      await seedPlayer(ALICE, "alice", "100", 100);
      await seedPlayer(BOB, "bob", "200", 0);

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          R.balanceRepo.transfer(ALICE, BOB, 100),
        ),
      );

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await R.balanceRepo.getRaw(ALICE)).toBe(0n);
      expect(await R.balanceRepo.getRaw(BOB)).toBe(100_000n);

      const senderHistory = await R.balanceRepo.getHistory(ALICE);
      expect(
        senderHistory.filter(
          (t) => t.transactionType === BalanceTransactionType.TRANSFER_SEND,
        ),
      ).toHaveLength(1);

      const recipientHistory = await R.balanceRepo.getHistory(BOB);
      expect(
        recipientHistory.filter(
          (t) => t.transactionType === BalanceTransactionType.TRANSFER_RECEIVE,
        ),
      ).toHaveLength(1);
      expect(recipientHistory.reduce((sum, t) => sum + t.amount, 0n)).toBe(
        100_000n,
      );
    });

    it("completes concurrent opposite-direction transfers without deadlocking", async () => {
      await seedPlayer(ALICE, "alice", "100", 50);
      await seedPlayer(BOB, "bob", "200", 50);

      await Promise.all(
        Array.from({ length: 5 }, () => [
          R.balanceRepo.transfer(ALICE, BOB, 5),
          R.balanceRepo.transfer(BOB, ALICE, 5),
        ]).flat(),
      );

      expect(await R.balanceRepo.getRaw(ALICE)).toBe(50_000n);
      expect(await R.balanceRepo.getRaw(BOB)).toBe(50_000n);
    });
  });

  describe("idempotency key on the ledger", () => {
    it("persists the key passed through the mutation options", async () => {
      await seedPlayer(ALICE, "alice", "100", 20);

      await R.balanceRepo.deduct(
        ALICE,
        5,
        "withdraw",
        BalanceTransactionType.WITHDRAW,
        { idempotencyKey: "attempt-1" },
      );
      await R.balanceRepo.add(
        ALICE,
        5,
        "deposit",
        BalanceTransactionType.DEPOSIT,
      );

      const history = await R.balanceRepo.getHistory(ALICE);
      expect(history[0].idempotencyKey).toBeNull();
      expect(history[1].idempotencyKey).toBe("attempt-1");
    });
  });

  describe("hasSufficient", () => {
    it("compares the stored balance against a decimal amount", async () => {
      await seedPlayer(ALICE, "alice", "100", 10);

      expect(await R.balanceRepo.hasSufficient(ALICE, 10)).toBe(true);
      expect(await R.balanceRepo.hasSufficient(ALICE, 10.001)).toBe(false);
    });
  });
});

describe("BalanceUtils round-trips against stored balances", () => {
  it("preserves fixed-point precision through a create + read cycle", async () => {
    await seedPlayer(ALICE, "alice", "100", 1234.567);

    const raw = await R.balanceRepo.getRaw(ALICE);
    expect(raw).toBe(BalanceUtils.toStorage(1234.567));
    expect(BalanceUtils.fromStorage(raw)).toBe(1234.567);
  });
});
