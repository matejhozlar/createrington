/**
 * tRPC initialization and procedure definitions.
 *
 * Exports four auth-level procedures used across all routers:
 * - `publicProcedure` — no auth required
 * - `userProcedure` — requires valid JWT and verified account
 * - `adminProcedure` — requires valid JWT, verified account, and isAdmin flag
 * - `ownerProcedure` — additionally requires JWT discordId to match
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
