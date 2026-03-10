/**
 * tRPC initialization and procedure definitions.
 *
 * Exports three auth-level procedures used across all routers:
 * - `publicProcedure` — no auth required
 * - `userProcedure` — requires valid JWT and verified account
 * - `adminProcedure` — requires valid JWT, verified account, and isAdmin flag
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

// ─── Procedures ──────────────────────────────────────────────

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

export const userProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
