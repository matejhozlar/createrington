import { describe, it, expect, vi, beforeEach } from "vitest";

const { transferMock, runIdempotentMock, historyMock } = vi.hoisted(() => ({
  transferMock: vi.fn(),
  runIdempotentMock: vi.fn(),
  historyMock: vi.fn(),
}));

vi.mock("@/app/middleware", async () => ({
  ...(await vi.importActual<object>("@/app/middleware/api-envelope")),
  getAuthedPlayer: (req: { modAuth: { uuid: string } }) => ({
    uuid: req.modAuth.uuid,
    name: "sender",
  }),
}));

vi.mock("@/db", () => ({
  balanceRepo: { transfer: transferMock, getFormattedHistory: historyMock },
}));

vi.mock("@/services/reward/reward.service", () => ({ rewardService: {} }));

vi.mock("@/app/features/mod/currency/currency.idempotency", async () => ({
  ...(await vi.importActual<object>(
    "@/app/features/mod/currency/currency.idempotency",
  )),
  runIdempotent: runIdempotentMock,
  sendOutcome: vi.fn(),
}));

import { BadRequestError } from "@/errors";
import { CurrencyController } from "@/app/features/mod/currency/currency.controller";
import { hashRequest } from "@/app/features/mod/currency/currency.idempotency";
import type { Request } from "express";
import { fakeReq, fakeRes } from "@/tests/helpers/http";

const SENDER_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RECIPIENT_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeReq(body: unknown): Request {
  return fakeReq({ body, modAuth: { uuid: SENDER_UUID } });
}

beforeEach(() => {
  transferMock.mockReset();
  runIdempotentMock.mockReset();
});

describe("CurrencyController.pay", () => {
  it.each([
    ["a non-UUID string", "not-a-uuid"],
    ["an identifier object", { discordId: "123" }],
    ["an array", [RECIPIENT_UUID]],
    ["a number", 42],
  ])("rejects %s as toUuid", async (_label, toUuid) => {
    await expect(
      CurrencyController.pay(makeReq({ toUuid, amount: 5 }), fakeRes()),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(transferMock).not.toHaveBeenCalled();
  });

  it.each([
    ["more than 3 decimal places", 1.2345, /at most 3 decimal places/],
    ["an amount that rounds to zero", 0.00004, /too small/],
  ])(
    "rejects %s with a 400 and a player message",
    async (_label, amount, message) => {
      const error = await CurrencyController.pay(
        makeReq({ toUuid: RECIPIENT_UUID, amount }),
        fakeRes(),
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).message).toMatch(message);
      expect((error as BadRequestError).playerMessage).toBeTruthy();
      expect(runIdempotentMock).not.toHaveBeenCalled();
    },
  );

  function runOperation() {
    runIdempotentMock.mockImplementation(
      async (_params: unknown, operation: (tx?: unknown) => Promise<unknown>) =>
        operation(undefined),
    );
  }

  it("passes the recipient lower-cased to the transfer", async () => {
    runOperation();
    transferMock.mockResolvedValue({ senderBalance: 5, recipientBalance: 5 });

    await CurrencyController.pay(
      makeReq({ toUuid: RECIPIENT_UUID.toUpperCase(), amount: 5 }),
      fakeRes(),
    );

    expect(transferMock).toHaveBeenCalledWith(
      SENDER_UUID,
      RECIPIENT_UUID,
      5,
      undefined,
      { idempotencyKey: undefined, tx: undefined },
    );
  });

  it("runs the transfer under the sender's idempotency key and request hash", async () => {
    runIdempotentMock.mockResolvedValue({});

    await CurrencyController.pay(
      makeReq({ toUuid: RECIPIENT_UUID, amount: 5, idempotencyKey: "pay-1" }),
      fakeRes(),
    );

    const [params] = runIdempotentMock.mock.calls[0];
    expect(params).toEqual({
      playerUuid: SENDER_UUID,
      key: "pay-1",
      requestHash: hashRequest("pay", { toUuid: RECIPIENT_UUID, amount: 5 }),
    });
  });

  it("rejects a malformed idempotency key before transferring", async () => {
    await expect(
      CurrencyController.pay(
        makeReq({ toUuid: RECIPIENT_UUID, amount: 5, idempotencyKey: "a b" }),
        fakeRes(),
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(runIdempotentMock).not.toHaveBeenCalled();
  });

  it("answers a recipient balance overflow with a 400 and a player message", async () => {
    runOperation();
    transferMock.mockRejectedValue(new Error("Amount exceeds maximum balance"));

    const error = await CurrencyController.pay(
      makeReq({ toUuid: RECIPIENT_UUID, amount: 5 }),
      fakeRes(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestError);
    expect((error as BadRequestError).playerMessage).toBe(
      "That player can't hold that much money.",
    );
  });
});

describe("CurrencyController.getHistory", () => {
  it("returns only the documented transaction fields", async () => {
    historyMock.mockResolvedValue([
      {
        id: 7,
        amount: "+50.000",
        balanceBefore: "100.000",
        balanceAfter: "150.000",
        transactionType: "admin_grant",
        description: "Event prize",
        createdAt: new Date("2026-11-20T10:00:00Z"),
        metadata: { adminDiscordId: "1", adminUsername: "admin" },
      },
    ]);
    const res = fakeRes();

    await CurrencyController.getHistory(
      fakeReq({ query: {}, modAuth: { uuid: SENDER_UUID } }),
      res,
    );

    const [body] = res.json.mock.calls[0];
    expect(body.data.transactions).toEqual([
      {
        id: 7,
        amount: "+50.000",
        balanceBefore: "100.000",
        balanceAfter: "150.000",
        transactionType: "admin_grant",
        description: "Event prize",
        createdAt: "2026-11-20T10:00:00.000Z",
      },
    ]);
  });
});

describe("CurrencyController.deposit", () => {
  it.each([
    ["an object", { text: "x" }],
    ["a number", 7],
    ["an over-long string", "x".repeat(201)],
  ])("rejects %s as reason", async (_label, reason) => {
    await expect(
      CurrencyController.deposit(makeReq({ amount: 5, reason }), fakeRes()),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(runIdempotentMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined, "Deposit"],
    ["null", null, "Deposit"],
    ["a string", "atm", "atm"],
  ])(
    "accepts a reason that is %s",
    async (_label, reason, expectedDescription) => {
      runIdempotentMock.mockResolvedValue({});

      await CurrencyController.deposit(
        makeReq({ amount: 5, reason }),
        fakeRes(),
      );

      const [operation] = runIdempotentMock.mock.calls[0];
      expect(operation.requestHash).toBe(
        hashRequest("deposit", { amount: 5, description: expectedDescription }),
      );
    },
  );
});
