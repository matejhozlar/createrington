import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { AuthRole } from "@/services/discord/oauth/oauth.service";

export interface Meta {
  description?: string;
}

const t = initTRPC.context<Context>().meta<Meta>().create();

export const router = t.router;
export const middleware = t.middleware;

export const publicProcedure = t.procedure;

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

const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  if (!ctx.user.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({ ctx: { user: ctx.user } });
});

export const userProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAdmin);
