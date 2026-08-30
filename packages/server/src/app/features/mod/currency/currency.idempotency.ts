import { respondSuccess } from "@/app/middleware/api-envelope";
import {
  AppError,
  BadRequestError,
  ConflictError,
} from "@/app/middleware/error-handler";
import { db, Q } from "@/db";
import { releaseSavepoint, rollbackToSavepoint, savepoint } from "@/db/utils";
import type { DatabaseQueries } from "@/generated/db";
import { createHash } from "node:crypto";
import type { Response } from "express";
import type { PoolClient } from "pg";

const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const OPERATION_SAVEPOINT = "idempotent_operation";

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
  code?: string;
  details?: unknown;
}

type StoredBody = StoredSuccess | StoredFailure;

export interface IdempotentOutcome {
  statusCode: number;
  body: StoredBody;
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

  if (typeof value !== "string" || !KEY_PATTERN.test(value)) {
    throw new BadRequestError(
      "idempotencyKey must be 1 to 128 characters of letters, digits, '.', '_', ':' or '-'",
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

function isStoredBody(value: unknown): value is StoredBody {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { success?: unknown; message?: unknown };
  return (
    typeof candidate.success === "boolean" &&
    typeof candidate.message === "string"
  );
}

function isOperationalFailure(error: unknown): error is AppError {
  return (
    error instanceof AppError && error.isOperational && error.statusCode < 500
  );
}

function transactionClient(tx: DatabaseQueries): PoolClient {
  if (!tx.isInTransaction()) {
    throw new Error("Idempotent operations require a transaction-bound client");
  }
  return tx.getDb() as PoolClient;
}

function successOutcome({
  message,
  playerMessage,
  data,
}: IdempotentSuccess): IdempotentOutcome {
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
}

function failureOutcome(error: AppError): IdempotentOutcome {
  return {
    statusCode: error.statusCode,
    body: {
      success: false,
      message: error.message,
      ...(error.playerMessage ? { playerMessage: error.playerMessage } : {}),
      ...(error.code ? { code: error.code } : {}),
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
    replayed: false,
  };
}

async function capture(
  operation: IdempotentOperation,
  tx?: DatabaseQueries,
): Promise<IdempotentOutcome> {
  const client = tx ? transactionClient(tx) : undefined;
  if (client) await savepoint(client, OPERATION_SAVEPOINT);

  try {
    const outcome = successOutcome(await operation(tx));
    if (client) await releaseSavepoint(client, OPERATION_SAVEPOINT);
    return outcome;
  } catch (error) {
    if (!isOperationalFailure(error)) throw error;
    if (client) await rollbackToSavepoint(client, OPERATION_SAVEPOINT);
    return failureOutcome(error);
  }
}

let nextCleanupAt = 0;

async function cleanupExpired(): Promise<void> {
  const now = Date.now();
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;

  try {
    const deleted = await Q.player.balance.idempotency.deleteExpired();
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired currency idempotency rows`);
    }
  } catch (error) {
    logger.error("Currency idempotency cleanup failed:", error);
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
      if (stored.statusCode == null || !isStoredBody(stored.responseBody)) {
        return { kind: "in-progress" };
      }

      return {
        kind: "replay",
        outcome: {
          statusCode: stored.statusCode,
          body: stored.responseBody,
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
      await cleanupExpired();
      return result.outcome;
  }
}

export function sendOutcome(res: Response, outcome: IdempotentOutcome): void {
  const { statusCode, body } = outcome;

  if (!body.success) {
    throw new AppError(body.message, statusCode, true, body.details, {
      playerMessage: body.playerMessage,
      code: body.code,
    });
  }

  respondSuccess(res, {
    message: body.message,
    playerMessage: body.playerMessage,
    data: body.data,
    status: statusCode,
  });
}
