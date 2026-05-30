/**
 * Shared tRPC utilities: error factories, player ID parsing, and pagination helpers.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { idToObject } from "@/app/utils/helpers";
import { AppError } from "@/app/middleware/error-handler";

type TrpcCode = ConstructorParameters<typeof TRPCError>[0]["code"];

/** Shorthand factories for common TRPCError codes. */
export const trpcError = {
  badRequest: (message: string) =>
    new TRPCError({ code: "BAD_REQUEST", message }),
  notFound: (message: string) => new TRPCError({ code: "NOT_FOUND", message }),
  conflict: (message: string) => new TRPCError({ code: "CONFLICT", message }),
  unauthorized: (message: string) =>
    new TRPCError({ code: "UNAUTHORIZED", message }),
  forbidden: (message: string) => new TRPCError({ code: "FORBIDDEN", message }),
  preconditionFailed: (message: string) =>
    new TRPCError({ code: "PRECONDITION_FAILED", message }),
  tooManyRequests: (message: string) =>
    new TRPCError({ code: "TOO_MANY_REQUESTS", message }),
  internal: (message: string) =>
    new TRPCError({ code: "INTERNAL_SERVER_ERROR", message }),
};

const APP_ERROR_TO_TRPC_CODE: Record<number, TrpcCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "TOO_MANY_REQUESTS",
};

/**
 * Re-throws a service-layer error as a TRPCError. AppError subclasses map to
 * the tRPC code matching their HTTP status; any other error propagates
 * unchanged so genuine failures still surface as INTERNAL_SERVER_ERROR rather
 * than being masked as a client error.
 */
export function rethrowTrpc(err: unknown): never {
  if (err instanceof AppError) {
    throw new TRPCError({
      code: APP_ERROR_TO_TRPC_CODE[err.statusCode] ?? "INTERNAL_SERVER_ERROR",
      message: err.message,
      cause: err,
    });
  }
  throw err;
}

/**
 * Parses a player ID string into a typed identifier object.
 * @param id - Discord ID, Minecraft UUID, or Minecraft username
 * @returns Typed identifier object for use with player queries
 */
export function parsePlayerId(id: string) {
  const identifier = idToObject(id);
  if (!identifier) {
    throw trpcError.badRequest(
      "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
    );
  }
  return identifier;
}

/**
 * Maps an authenticated admin context to the actor fields every audit log
 * entry requires. Spread into `logAction` calls: `{ ...auditActor(ctx), ... }`.
 */
export function auditActor(ctx: {
  user: { discordId: string; minecraftUsername: string };
}) {
  return {
    adminDiscordId: ctx.user.discordId,
    adminUsername: ctx.user.minecraftUsername,
  };
}

/**
 * Returns Zod schemas for `page` and `limit` input fields.
 * @param opts.maxLimit - Upper bound for limit (default 100)
 * @param opts.defaultLimit - Default page size (default 20)
 */
export function paginationInput(opts?: {
  maxLimit?: number;
  defaultLimit?: number;
}) {
  return {
    page: z.number().int().min(0).default(0),
    limit: z
      .number()
      .int()
      .min(1)
      .max(opts?.maxLimit ?? 100)
      .default(opts?.defaultLimit ?? 20),
  };
}

/**
 * Builds a pagination metadata object from query results.
 * @param page - Current zero-based page index
 * @param limit - Number of items per page
 * @param total - Total number of matching records
 * @returns Object with page, limit, total, and totalPages
 */
export function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
