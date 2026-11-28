import { initTRPC } from "@trpc/server";
import type { Context } from "./context";
import {
  INTERNAL_ERROR_MESSAGE,
  inputValidationMessage,
  isUnmappedFailure,
  mapDomainError,
  trpcError,
} from "@/trpc/utils";
import { AuthRole } from "@createrington/shared/auth";
import { adminStatusService } from "@/services/auth/admin-status/admin-status.service";
import { httpLogger, colorDuration } from "@/http-logger";
import config from "@/config";

export interface Meta {
  description?: string;
}

const t = initTRPC
  .context<Context>()
  .meta<Meta>()
  .create({
    isDev: config.envMode.isDev,
    errorFormatter({ shape, error }) {
      const validationMessage = inputValidationMessage(error);
      if (validationMessage) return { ...shape, message: validationMessage };
      if (config.envMode.isDev || !isUnmappedFailure(error)) return shape;
      return { ...shape, message: INTERNAL_ERROR_MESSAGE };
    },
  });

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

const domainErrorMiddleware = middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const mapped = mapDomainError(result.error);
    if (mapped) throw mapped;
  }
  return result;
});

const baseProcedure = t.procedure
  .use(loggingMiddleware)
  .use(domainErrorMiddleware);

export const publicProcedure = baseProcedure;

const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw trpcError.unauthorized("Authentication required");
  }

  if (ctx.user.role === AuthRole.UNVERIFIED) {
    throw trpcError.forbidden("Account verification required");
  }

  return next({ ctx: { user: ctx.user } });
});

const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user?.isAdmin) {
    throw trpcError.forbidden("Admin access required");
  }

  const stillAdmin = await adminStatusService.isAdmin(ctx.user.discordId);
  if (!stillAdmin) {
    throw trpcError.forbidden("Admin access required");
  }

  return next({ ctx: { user: ctx.user } });
});

const isOwner = middleware(async ({ ctx, next }) => {
  if (ctx.user?.discordId !== config.app.auth.owner.discordId) {
    throw trpcError.forbidden("Owner access required");
  }
  return next({ ctx: { user: ctx.user } });
});

const isSandboxService = middleware(async ({ ctx, next }) => {
  if (ctx.service !== "sandbox") {
    throw trpcError.unauthorized("Sandbox service token required");
  }
  return next();
});

export const launcherAvailable = middleware(async ({ next }) => {
  if (!config.launcher.available) {
    throw trpcError.notFound("Not found");
  }
  return next();
});

export const userProcedure = baseProcedure.use(isAuthenticated);
export const sandboxServiceProcedure = baseProcedure.use(isSandboxService);
export const adminProcedure = baseProcedure.use(isAuthenticated).use(isAdmin);
export const ownerProcedure = baseProcedure.use(isAuthenticated).use(isOwner);
