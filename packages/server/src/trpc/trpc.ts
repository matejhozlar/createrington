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
import { AuthRole } from "@/services/discord/oauth/oauth.service";
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

/** Procedure with no authentication requirement. */
export const publicProcedure = t.procedure;

/** Rejects unauthenticated or unverified users. */
const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  if (ctx.user.role === AuthRole.UNVERIFIED) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Account verification required",
    });
  }

  return next({ ctx: { user: ctx.user } });
});

/** Rejects non-admin users. */
const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user?.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({ ctx: { user: ctx.user } });
});

/**
 * Rejects requests when the crypto master toggle is off. Reads the in-memory
 * value from the settings service so the check is free on the hot path.
 */
const requireCryptoEnabled = middleware(async ({ next }) => {
  // Lazy import to avoid a top-level dep cycle (trpc <-> services).
  // The explicit /index.js is required: Node ESM does not resolve directory
  // imports, and post-build only rewrites static import/from statements.
  const { getServiceSync, Services } = await import("@/services/index.js");
  try {
    const settings = getServiceSync(Services.CRYPTO_SETTINGS_SERVICE);
    if (!settings.get("cryptoEnabled")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Crypto market is currently disabled",
      });
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    // Service not yet ready (boot or test harness): fall through.
  }
  return next();
});

/** Rejects anyone whose JWT discordId doesn't match the configured owner. */
const isOwner = middleware(async ({ ctx, next }) => {
  if (ctx.user?.discordId !== config.app.auth.owner.discordId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner access required",
    });
  }
  return next({ ctx: { user: ctx.user } });
});

/** Procedure that requires a valid JWT and a verified (non-UNVERIFIED) account. */
export const userProcedure = t.procedure.use(isAuthenticated);
/** Procedure that requires a valid JWT, a verified account, and the isAdmin flag. */
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
/** Procedure gated on matching the configured owner Discord ID. */
export const ownerProcedure = t.procedure.use(isAuthenticated).use(isOwner);

/**
 * User procedure that additionally fails when the crypto master toggle is off.
 * Use for trade-side mutations (buy/sell/order placement) so reads still work
 * while the market is paused.
 */
export const cryptoUserProcedure = userProcedure.use(requireCryptoEnabled);
