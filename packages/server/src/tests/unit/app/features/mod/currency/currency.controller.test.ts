import { describe, it, expect, vi, beforeEach } from "vitest";

const { transferMock, runIdempotentMock } = vi.hoisted(() => ({
  transferMock: vi.fn(),
  runIdempotentMock: vi.fn(),
}));

vi.mock("@/app/middleware", async () => ({
  ...(await vi.importActual<object>("@/app/middleware/error-handler")),
  ...(await vi.importActual<object>("@/app/middleware/api-envelope")),
  getAuthedPlayer: (req: { modAuth: { uuid: string } }) => ({
    uuid: req.modAuth.uuid,
    name: "sender",
  }),
}));

vi.mock("@/db", () => ({
  R: { balanceRepo: { transfer: transferMock } },
}));

vi.mock("@/services/reward/reward.service", () => ({ rewardService: {} }));

vi.mock("@/app/features/mod/currency/currency.idempotency", async () => ({
  ...(await vi.importActual<object>(
    "@/app/features/mod/currency/currency.idempotency",
  )),
  runIdempotent: runIdempotentMock,
  sendOutcome: vi.fn(),
}));

import { BadRequestError } from "@/app/middleware/error-handler";
import { CurrencyController } from "@/app/features/mod/currency/currency.controller";
import { hashRequest } from "@/app/features/mod/currency/currency.idempotency";
import type { Request, Response } from "express";

const SENDER_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RECIPIENT_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeReq(body: unknown): Request {
  return { body, modAuth: { uuid: SENDER_UUID } } as unknown as Request;
}

function makeRes(): Response & { json: ReturnType<typeof vi.fn> } {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { json: ReturnType<typeof vi.fn> };
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
      CurrencyController.pay(makeReq({ toUuid, amount: 5 }), makeRes()),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(transferMock).not.toHaveBeenCalled();
  });

  it("passes the recipient lower-cased to the transfer", async () => {
    transferMock.mockResolvedValue({ senderBalance: 5, recipientBalance: 5 });

    await CurrencyController.pay(
      makeReq({ toUuid: RECIPIENT_UUID.toUpperCase(), amount: 5 }),
      makeRes(),
    );

    expect(transferMock).toHaveBeenCalledWith(SENDER_UUID, RECIPIENT_UUID, 5);
  });

  it("answers a recipient balance overflow with a 400 and a player message", async () => {
    transferMock.mockRejectedValue(new Error("Amount exceeds maximum balance"));

    const error = await CurrencyController.pay(
      makeReq({ toUuid: RECIPIENT_UUID, amount: 5 }),
      makeRes(),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestError);
    expect((error as BadRequestError).playerMessage).toBe(
      "That player can't hold that much money.",
    );
  });
});

describe("CurrencyController.deposit", () => {
  it.each([
    ["an object", { text: "x" }],
    ["a number", 7],
    ["an over-long string", "x".repeat(201)],
  ])("rejects %s as reason", async (_label, reason) => {
    await expect(
      CurrencyController.deposit(makeReq({ amount: 5, reason }), makeRes()),
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
        makeRes(),
      );

      const [operation] = runIdempotentMock.mock.calls[0];
      expect(operation.requestHash).toBe(
        hashRequest("deposit", { amount: 5, description: expectedDescription }),
      );
    },
  );
});
