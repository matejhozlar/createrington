/**
 * tRPC initialization and procedure definitions.
 *
 * Exports four auth-level procedures used across all routers:
 * - `publicProcedure`: no auth required
 * - `userProcedure`: requires valid JWT and verified account
 * - `adminProcedure`: requires valid JWT, verified account, and isAdmin flag
 * - `ownerProcedure`: additionally requires JWT discordId to match
 *   `config.app.auth.owner.discordId` (single-owner gate, env-rooted)
 */
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { trpcError } from "@/trpc/utils";
import { AuthRole } from "@/services/discord/oauth/oauth.service";
import { adminStatusService } from "@/services/auth/admin-status/admin-status.service";
import { httpLogger, colorDuration } from "@/http-logger";
import config from "@/config";

/** Optional metadata attached to each procedure (used for auto-documentation). */
export interface Meta {
  description?: string;
}

const t = initTRPC
  .context<Context>()
  .meta<Meta>()
  .create({ isDev: config.envMode.isDev });

export const router = t.router;
export const middleware = t.middleware;

const TRPC_TYPE_PREFIX: Record<string, string> = {
  query: "q",
  mutation: "m",
  subscription: "s",
};

const loggingMiddleware = middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const ms = Date.now() - start;
  const tag = TRPC_TYPE_PREFIX[type] ?? type;
  const userId = ctx.user?.discordId;
  const userTag = userId ? ` u=${userId}` : "";
  const status = result.ok ? "ok" : "err";
  httpLogger.info(
    `[tRPC] ${tag} ${path} ${status} ${colorDuration(ms)}${userTag}`,
  );
  return result;
});

const baseProcedure = t.procedure.use(loggingMiddleware);

/** Procedure with no authentication requirement. */
export const publicProcedure = baseProcedure;

/** Rejects unauthenticated or unverified users. */
const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw trpcError.unauthorized("Authentication required");
  }

  if (ctx.user.role === AuthRole.UNVERIFIED) {
    throw trpcError.forbidden("Account verification required");
  }

  return next({ ctx: { user: ctx.user } });
});

/** Rejects non-admin users. */
const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user?.isAdmin) {
    throw trpcError.forbidden("Admin access required");
  }

  // JWT isAdmin can be stale up to the access-token lifetime; confirm against DB.
  const stillAdmin = await adminStatusService.isAdmin(ctx.user.discordId);
  if (!stillAdmin) {
    throw trpcError.forbidden("Admin access required");
  }

  return next({ ctx: { user: ctx.user } });
});

/**
 * Rejects requests when the crypto master toggle is off. Reads the in-memory
 * value from the settings service so the check is free on the hot path.
 */
const requireCryptoEnabled = middleware(async ({ next }) => {
  // Lazy import to avoid a top-level dep cycle (trpc <-> services).
  const { getServiceSync, Services } = await import("@/services/index.js");
  try {
    const settings = getServiceSync(Services.CRYPTO_SETTINGS_SERVICE);
    if (!settings.get("cryptoEnabled")) {
      throw trpcError.forbidden("Crypto market is currently disabled");
    }
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    // Service not yet ready (boot or test harness): fall through.
  }
  return next();
});

/** Rejects anyone whose JWT discordId doesn't match the configured owner. */
const isOwner = middleware(async ({ ctx, next }) => {
  if (ctx.user?.discordId !== config.app.auth.owner.discordId) {
    throw trpcError.forbidden("Owner access required");
  }
  return next({ ctx: { user: ctx.user } });
});

/** Procedure that requires a valid JWT and a verified (non-UNVERIFIED) account. */
export const userProcedure = baseProcedure.use(isAuthenticated);
/** Procedure that requires a valid JWT, a verified account, and the isAdmin flag. */
export const adminProcedure = baseProcedure.use(isAuthenticated).use(isAdmin);
/** Procedure gated on matching the configured owner Discord ID. */
export const ownerProcedure = baseProcedure.use(isAuthenticated).use(isOwner);

/**
 * User procedure that additionally fails when the crypto master toggle is off.
 * Use for trade-side mutations (buy/sell/order placement) so reads still work
 * while the market is paused.
 */
export const cryptoUserProcedure = userProcedure.use(requireCryptoEnabled);
