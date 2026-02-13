import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { idToObject } from "@/app/utils/helpers";

export const trpcError = {
  badRequest: (message: string) =>
    new TRPCError({ code: "BAD_REQUEST", message }),
  notFound: (message: string) =>
    new TRPCError({ code: "NOT_FOUND", message }),
  conflict: (message: string) =>
    new TRPCError({ code: "CONFLICT", message }),
  unauthorized: (message: string) =>
    new TRPCError({ code: "UNAUTHORIZED", message }),
  forbidden: (message: string) =>
    new TRPCError({ code: "FORBIDDEN", message }),
  internal: (message: string) =>
    new TRPCError({ code: "INTERNAL_SERVER_ERROR", message }),
};

export function parsePlayerId(id: string) {
  const identifier = idToObject(id);
  if (!identifier) {
    throw trpcError.badRequest(
      "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
    );
  }
  return identifier;
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

export function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
