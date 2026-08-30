import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { R, Q } from "@/db";
import { BalanceTransactionType } from "@/db/repositories/balance";
import {
  AppError,
  BadRequestError,
  ConflictError,
} from "@/app/middleware/error-handler";
import {
  hashRequest,
  parseIdempotencyKey,
  runIdempotent,
  type IdempotentOperation,
} from "@/app/features/mod/currency/currency.idempotency";
import {
  getTestPool,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

const ALICE = "11111111-1111-1111-1111-111111111111";
const KEY = "0f6a7b1c-5d4e-4f3a-9b2c-1d0e9f8a7b6c";

async function seedAlice(initialBalance: number): Promise<void> {
  await Q.player.create({
    minecraftUuid: ALICE,
    minecraftUsername: "alice",
    discordId: "100",
  });
  await R.balanceRepo.create(ALICE, initialBalance);
}

function withdrawRequest(amount: number, key?: string) {
  const operation = vi.fn<IdempotentOperation>(async (tx) => {
    try {
      const newBalance = await R.balanceRepo.deduct(
        ALICE,
        amount,
        `Withdraw ${amount}`,
        BalanceTransactionType.WITHDRAW,
        { idempotencyKey: key, tx },
      );
      return {
        message: `Withdrew ${amount}`,
        playerMessage: "Withdrawn.",
        data: { withdrawn: amount, new_balance: newBalance },
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Insufficient balance")
      ) {
        throw new BadRequestError("Insufficient balance", undefined, {
          playerMessage: "You don't have enough money to withdraw that.",
        });
      }
      throw error;
    }
  });

  const run = () =>
    runIdempotent(
      {
        playerUuid: ALICE,
        key,
        requestHash: hashRequest("withdraw", {
          denomination: amount,
          count: 1,
        }),
      },
      operation,
    );

  return { run, operation };
}

async function withdrawLedger() {
  const history = await R.balanceRepo.getHistory(ALICE);
  return history.filter(
    (t) => t.transactionType === BalanceTransactionType.WITHDRAW,
  );
}

beforeAll(async () => {
  await getTestPool().query("SELECT 1");
});

beforeEach(async () => {
  // Cascades to player_balance, player_balance_transaction, and player_balance_idempotency.
  await truncateTable("player");
});

afterAll(async () => {
  await cleanupTestPool();
});

describe("parseIdempotencyKey", () => {
  it("treats a missing key as absent", () => {
    expect(parseIdempotencyKey(undefined)).toBeUndefined();
    expect(parseIdempotencyKey(null)).toBeUndefined();
  });

  it("returns a well-formed key unchanged", () => {
    expect(parseIdempotencyKey(KEY)).toBe(KEY);
  });

  it("rejects empty, oversized, and non-string keys", () => {
    expect(() => parseIdempotencyKey("")).toThrow(BadRequestError);
    expect(() => parseIdempotencyKey("x".repeat(129))).toThrow(BadRequestError);
    expect(() => parseIdempotencyKey(42)).toThrow(BadRequestError);
  });

  it("rejects whitespace and control characters, accepts the documented charset", () => {
    expect(() => parseIdempotencyKey("a b")).toThrow(BadRequestError);
    expect(() => parseIdempotencyKey("   ")).toThrow(BadRequestError);
    expect(() => parseIdempotencyKey("key\nforged log line")).toThrow(
      BadRequestError,
    );
    expect(parseIdempotencyKey("attempt:1.2_3-x")).toBe("attempt:1.2_3-x");
  });
});

describe("hashRequest", () => {
  it("is stable for equal input and distinct across operations and bodies", () => {
    const a = hashRequest("withdraw", { denomination: 10, count: 1 });
    expect(hashRequest("withdraw", { denomination: 10, count: 1 })).toBe(a);
    expect(hashRequest("deposit", { denomination: 10, count: 1 })).not.toBe(a);
    expect(hashRequest("withdraw", { denomination: 10, count: 2 })).not.toBe(a);
  });
});

describe("runIdempotent (integration)", () => {
  it("runs the operation on every call when no key is given", async () => {
    await seedAlice(100);
    const { run, operation } = withdrawRequest(10);

    const first = await run();
    const second = await run();

    expect(operation).toHaveBeenCalledTimes(2);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(false);
    expect(await R.balanceRepo.getRaw(ALICE)).toBe(80_000n);
    expect(await withdrawLedger()).toHaveLength(2);
  });

  it("replays a stored success without applying the debit again", async () => {
    await seedAlice(100);
    const { run, operation } = withdrawRequest(10, KEY);

    const first = await run();
    const second = await run();

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.statusCode).toBe(first.statusCode);
    expect(second.body).toEqual(first.body);
    expect(first.body).toEqual({
      success: true,
      message: "Withdrew 10",
      playerMessage: "Withdrawn.",
      data: { withdrawn: 10, new_balance: 90 },
    });

    expect(await R.balanceRepo.getRaw(ALICE)).toBe(90_000n);

    const ledger = await withdrawLedger();
    expect(ledger).toHaveLength(1);
    expect(ledger[0].idempotencyKey).toBe(KEY);
  });

  it("collapses concurrent identical requests into a single ledger entry", async () => {
    await seedAlice(100);
    const { run, operation } = withdrawRequest(10, KEY);

    const outcomes = await Promise.all(Array.from({ length: 6 }, run));

    expect(operation).toHaveBeenCalledTimes(1);
    expect(outcomes.filter((o) => !o.replayed)).toHaveLength(1);
    for (const outcome of outcomes) {
      expect(outcome.statusCode).toBe(200);
      expect(outcome.body).toEqual(outcomes[0].body);
    }

    expect(await R.balanceRepo.getRaw(ALICE)).toBe(90_000n);
    expect(await withdrawLedger()).toHaveLength(1);
  });

  it("rejects the same key with a different body and changes nothing", async () => {
    await seedAlice(100);
    await withdrawRequest(10, KEY).run();

    const { run, operation } = withdrawRequest(20, KEY);
    await expect(run()).rejects.toThrow(ConflictError);

    expect(operation).not.toHaveBeenCalled();
    expect(await R.balanceRepo.getRaw(ALICE)).toBe(90_000n);
    expect(await withdrawLedger()).toHaveLength(1);
  });

  it("memoizes an operational failure with its status and messages", async () => {
    await seedAlice(5);
    const { run, operation } = withdrawRequest(10, KEY);

    const first = await run();
    const second = await run();

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first.statusCode).toBe(400);
    expect(first.body).toEqual({
      success: false,
      message: "Insufficient balance",
      playerMessage: "You don't have enough money to withdraw that.",
    });
    expect(second.replayed).toBe(true);
    expect(second.statusCode).toBe(400);
    expect(second.body).toEqual(first.body);

    expect(await R.balanceRepo.getRaw(ALICE)).toBe(5_000n);
    expect(await withdrawLedger()).toHaveLength(0);
  });

  it("carries code and details of an operational failure through the stored body", async () => {
    await seedAlice(100);
    const operation = vi.fn<IdempotentOperation>(async () => {
      throw new AppError(
        "Denied",
        422,
        true,
        { field: "amount" },
        { code: "TEST_CODE" },
      );
    });
    const params = {
      playerUuid: ALICE,
      key: KEY,
      requestHash: hashRequest("withdraw", { denomination: 10, count: 1 }),
    };

    const first = await runIdempotent(params, operation);
    const second = await runIdempotent(params, operation);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first.statusCode).toBe(422);
    expect(first.body).toEqual({
      success: false,
      message: "Denied",
      code: "TEST_CODE",
      details: { field: "amount" },
    });
    expect(second.replayed).toBe(true);
    expect(second.body).toEqual(first.body);
  });

  it("rolls back writes made before an operational failure and still memoizes it", async () => {
    await seedAlice(100);
    const operation = vi.fn<IdempotentOperation>(async (tx) => {
      await R.balanceRepo.add(
        ALICE,
        5,
        "credited before rejection",
        BalanceTransactionType.DEPOSIT,
        { tx },
      );
      throw new BadRequestError("Rejected after write", undefined, {
        playerMessage: "Rejected.",
      });
    });
    const params = {
      playerUuid: ALICE,
      key: KEY,
      requestHash: hashRequest("withdraw", { denomination: 10, count: 1 }),
    };

    const first = await runIdempotent(params, operation);
    const second = await runIdempotent(params, operation);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(first.statusCode).toBe(400);
    expect(second.replayed).toBe(true);
    expect(second.body).toEqual(first.body);

    expect(await R.balanceRepo.getRaw(ALICE)).toBe(100_000n);
    const history = await R.balanceRepo.getHistory(ALICE);
    expect(
      history.filter(
        (t) => t.transactionType === BalanceTransactionType.DEPOSIT,
      ),
    ).toHaveLength(0);
  });

  it("treats a malformed stored body as unavailable instead of replaying it", async () => {
    await seedAlice(100);
    const { run, operation } = withdrawRequest(10, KEY);
    await run();
    await getTestPool().query(
      `UPDATE player_balance_idempotency
       SET response_body = '"garbage"'::jsonb
       WHERE player_minecraft_uuid = $1 AND idempotency_key = $2`,
      [ALICE, KEY],
    );

    await expect(run()).rejects.toThrow(ConflictError);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(await R.balanceRepo.getRaw(ALICE)).toBe(90_000n);
  });

  it("does not memoize unexpected failures, so a retry runs the operation again", async () => {
    await seedAlice(100);
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("connection reset");
      return { message: "ok" };
    });
    const params = {
      playerUuid: ALICE,
      key: KEY,
      requestHash: hashRequest("withdraw", { denomination: 10, count: 1 }),
    };

    await expect(runIdempotent(params, operation)).rejects.toThrow(
      "connection reset",
    );
    const retry = await runIdempotent(params, operation);

    expect(operation).toHaveBeenCalledTimes(2);
    expect(retry.replayed).toBe(false);
    expect(retry.statusCode).toBe(200);
  });

  it("reclaims a key once its retention has elapsed", async () => {
    await seedAlice(100);
    const { run, operation } = withdrawRequest(10, KEY);

    await run();
    await getTestPool().query(
      `UPDATE player_balance_idempotency
       SET created_at = now() - interval '25 hours'
       WHERE player_minecraft_uuid = $1 AND idempotency_key = $2`,
      [ALICE, KEY],
    );
    const again = await run();

    expect(operation).toHaveBeenCalledTimes(2);
    expect(again.replayed).toBe(false);
    expect(await R.balanceRepo.getRaw(ALICE)).toBe(80_000n);
    expect(await withdrawLedger()).toHaveLength(2);
  });

  it("deleteExpired removes only rows past retention", async () => {
    await seedAlice(100);
    await withdrawRequest(10, KEY).run();
    await withdrawRequest(10, "fresh-key").run();
    await getTestPool().query(
      `UPDATE player_balance_idempotency
       SET created_at = now() - interval '25 hours'
       WHERE idempotency_key = $1`,
      [KEY],
    );

    const deleted = await Q.player.balance.idempotency.deleteExpired();

    expect(deleted).toBe(1);
    expect(await Q.player.balance.idempotency.count()).toBe(1);
  });
});
