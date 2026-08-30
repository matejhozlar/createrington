import { respondSuccess } from "@/app/middleware/api-envelope";
import {
  AppError,
  BadRequestError,
  ConflictError,
} from "@/app/middleware/error-handler";
import { db, Q } from "@/db";
import type { DatabaseQueries } from "@/generated/db";
import { createHash } from "node:crypto";
import type { Response } from "express";

const MAX_KEY_LENGTH = 128;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface IdempotentSuccess {
  message: string;
  playerMessage?: string;
  data?: unknown;
}

interface StoredSuccess {
  success: true;
  message: string;
  playerMessage?: string;
  data?: unknown;
}

interface StoredFailure {
  success: false;
  message: string;
  playerMessage?: string;
}

export interface IdempotentOutcome {
  statusCode: number;
  body: StoredSuccess | StoredFailure;
  replayed: boolean;
}

type ClaimResult =
  | { kind: "fresh"; outcome: IdempotentOutcome }
  | { kind: "replay"; outcome: IdempotentOutcome }
  | { kind: "mismatch" }
  | { kind: "in-progress" };

export type IdempotentOperation = (
  tx?: DatabaseQueries,
) => Promise<IdempotentSuccess>;

export function parseIdempotencyKey(value: unknown): string | undefined {
  if (value == null) return undefined;

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_KEY_LENGTH
  ) {
    throw new BadRequestError(
      `idempotencyKey must be a non-empty string of at most ${MAX_KEY_LENGTH} characters`,
    );
  }

  return value;
}

export function hashRequest(
  operation: string,
  body: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ operation, body }))
    .digest("hex");
}

let nextCleanupAt = 0;

function scheduleCleanup(): void {
  const now = Date.now();
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;

  Q.player.balance.idempotency
    .deleteExpired()
    .then((deleted) => {
      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} expired currency idempotency rows`);
      }
    })
    .catch((error: unknown) => {
      logger.error("Currency idempotency cleanup failed:", error);
    });
}

async function capture(
  operation: IdempotentOperation,
  tx?: DatabaseQueries,
): Promise<IdempotentOutcome> {
  try {
    const { message, playerMessage, data } = await operation(tx);
    return {
      statusCode: 200,
      body: {
        success: true,
        message,
        ...(playerMessage ? { playerMessage } : {}),
        ...(data !== undefined ? { data } : {}),
      },
      replayed: false,
    };
  } catch (error) {
    if (
      error instanceof AppError &&
      error.isOperational &&
      error.statusCode < 500
    ) {
      return {
        statusCode: error.statusCode,
        body: {
          success: false,
          message: error.message,
          ...(error.playerMessage
            ? { playerMessage: error.playerMessage }
            : {}),
        },
        replayed: false,
      };
    }
    throw error;
  }
}

export async function runIdempotent(
  params: { playerUuid: string; key?: string; requestHash: string },
  operation: IdempotentOperation,
): Promise<IdempotentOutcome> {
  const { playerUuid, key, requestHash } = params;

  if (!key) return capture(operation);

  const result = await db.inTransaction(async (tx): Promise<ClaimResult> => {
    const claimed = await tx.player.balance.idempotency.claim({
      playerMinecraftUuid: playerUuid,
      idempotencyKey: key,
      requestHash,
    });

    if (!claimed) {
      const stored = await tx.player.balance.idempotency.get({
        playerMinecraftUuid: playerUuid,
        idempotencyKey: key,
      });

      if (stored.requestHash !== requestHash) return { kind: "mismatch" };
      if (stored.statusCode == null || stored.responseBody == null) {
        return { kind: "in-progress" };
      }

      return {
        kind: "replay",
        outcome: {
          statusCode: stored.statusCode,
          body: stored.responseBody as StoredSuccess | StoredFailure,
          replayed: true,
        },
      };
    }

    const outcome = await capture(operation, tx);

    await tx.player.balance.idempotency.update(
      { playerMinecraftUuid: playerUuid, idempotencyKey: key },
      { statusCode: outcome.statusCode, responseBody: outcome.body },
    );

    return { kind: "fresh", outcome };
  });

  switch (result.kind) {
    case "mismatch":
      throw new ConflictError(
        "idempotencyKey was already used with a different request",
      );
    case "in-progress":
      throw new ConflictError(
        "A request with this idempotencyKey is still being processed",
      );
    case "replay":
      logger.info(
        `Replayed idempotent currency request ${key} for ${playerUuid}`,
      );
      return result.outcome;
    case "fresh":
      scheduleCleanup();
      return result.outcome;
  }
}

export function sendOutcome(res: Response, outcome: IdempotentOutcome): void {
  const { statusCode, body } = outcome;

  if (!body.success) {
    throw new AppError(body.message, statusCode, true, undefined, {
      playerMessage: body.playerMessage,
    });
  }

  respondSuccess(res, {
    message: body.message,
    playerMessage: body.playerMessage,
    data: body.data,
    status: statusCode,
  });
}
