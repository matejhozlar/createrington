import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { idToObject } from "@/utils/player-identifier";
import { AppError } from "@/errors";
import { NotFoundError as DbNotFoundError } from "@/db/utils/errors";
import type { OrderBy, OrderDirection } from "@/db/queries/query-builder";

type TrpcCode = ConstructorParameters<typeof TRPCError>[0]["code"];

const INT4_MAX = 2147483647;

export const id = () => z.number().int().positive().max(INT4_MAX);

export const coercedId = () => z.coerce.number().int().positive().max(INT4_MAX);

export const serverIdInput = z.object({
  serverId: coercedId(),
});

export const sortDirection = () => z.enum(["asc", "desc"]);

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

export function assertPatchNotEmpty(patch: Record<string, unknown>): void {
  if (Object.keys(patch).length === 0) {
    throw trpcError.badRequest("Nothing to update");
  }
}

const APP_ERROR_TO_TRPC_CODE: Record<number, TrpcCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "TOO_MANY_REQUESTS",
  503: "SERVICE_UNAVAILABLE",
};

function domainErrorCode(cause: unknown): TrpcCode | undefined {
  if (cause instanceof AppError)
    return APP_ERROR_TO_TRPC_CODE[cause.statusCode];
  if (cause instanceof DbNotFoundError) return "NOT_FOUND";
  return undefined;
}

export function mapDomainError(error: TRPCError): TRPCError | null {
  if (error.code !== "INTERNAL_SERVER_ERROR") return null;
  const code = domainErrorCode(error.cause);
  if (!code) return null;
  const mapped = new TRPCError({
    code,
    message: error.message,
    cause: error.cause,
  });
  mapped.stack = error.stack;
  return mapped;
}

export const INTERNAL_ERROR_MESSAGE =
  "Something went wrong on our side. Please try again.";

export function isUnmappedFailure(error: TRPCError): boolean {
  return error.code === "INTERNAL_SERVER_ERROR" && error.cause !== undefined;
}

export function inputValidationMessage(error: TRPCError): string | null {
  if (error.code !== "BAD_REQUEST" || !(error.cause instanceof z.ZodError)) {
    return null;
  }
  return error.cause.issues[0]?.message ?? null;
}

export function parsePlayerId(id: string) {
  const identifier = idToObject(id);
  if (!identifier) {
    throw trpcError.badRequest(
      "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
    );
  }
  return identifier;
}

export const playerId = () => z.string().min(1).transform(parsePlayerId);

export function auditActor(ctx: {
  user: { discordId: string; minecraftUsername: string };
}) {
  return {
    adminDiscordId: ctx.user.discordId,
    adminUsername: ctx.user.minecraftUsername,
  };
}

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

export function pageOffset(input: { page: number; limit: number }): number {
  return input.page * input.limit;
}

export function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

interface PageSource<TEntity, TFilters> {
  findAll(
    filters: TFilters | undefined,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: OrderBy<TEntity>;
      orderDirection?: OrderDirection;
    },
  ): Promise<TEntity[]>;
  count(filters?: TFilters): Promise<number>;
}

export async function paginateQuery<TEntity, TFilters>(
  source: PageSource<TEntity, TFilters>,
  filters: TFilters,
  input: { page: number; limit: number },
  order?: { orderBy?: OrderBy<TEntity>; orderDirection?: OrderDirection },
) {
  const [rows, total] = await Promise.all([
    source.findAll(filters, {
      ...order,
      limit: input.limit,
      offset: pageOffset(input),
    }),
    source.count(filters),
  ]);
  return { rows, pagination: buildPagination(input.page, input.limit, total) };
}

export async function findOrThrow<T>(
  lookup: Promise<T | null | undefined>,
  message: string,
): Promise<T> {
  const row = await lookup;
  if (row === null || row === undefined) {
    throw trpcError.notFound(message);
  }
  return row;
}
