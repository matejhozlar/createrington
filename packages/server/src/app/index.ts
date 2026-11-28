import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import type { AnyTRPCRouter } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerRoutes } from "./features";
import {
  errorHandler,
  notFoundHandler,
  globalLimiter,
  authLimiter,
  authRefreshLimiter,
  modpacksLimiter,
  requestLogger,
} from "./middleware";
import { appRouter } from "@/trpc/router";
import { panelRouter } from "@/trpc/routers/consumers/panel";
import { sandboxRouter } from "@/trpc/routers/consumers/sandbox";
import { createContext } from "@/trpc/context";
import config from "@/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { registerHealthRoute } from "./health";
import { spaFallback } from "./spa-fallback";
import { allowedOrigins } from "./utils/allowed-origins";
import { TRPC_MAX_BATCH_SIZE } from "@createrington/shared/trpc";

const TRPC_MAX_BODY_BYTES = 1024 * 1024;

function mountTrpc(
  app: Express,
  path: string,
  router: AnyTRPCRouter,
  tag: string,
): void {
  app.use(
    path,
    createExpressMiddleware({
      router,
      createContext,
      maxBodySize: TRPC_MAX_BODY_BYTES,
      maxBatchSize: TRPC_MAX_BATCH_SIZE,
      onError({ error, path: procedure }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error(`[${tag}] ${procedure}:`, {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
          });
        } else {
          logger.warn(`[${tag}] ${procedure}: ${error.message}`);
        }
      },
    }),
  );
}

export function createApp(): Express {
  const app = express();
  if (config.envMode.isProd) {
    app.set("trust proxy", 1);
  }

  app.use("/api/donations/webhook", express.raw({ type: "application/json" }));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: allowedOrigins(),
      credentials: true,
    }),
  );
  app.use(requestLogger);
  app.use(globalLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/auth/refresh", authRefreshLimiter);
  app.use("/api/modpacks", modpacksLimiter);

  registerHealthRoute(app);

  registerRoutes(app);

  mountTrpc(app, "/trpc/consumers/panel", panelRouter, "tRPC consumers.panel");
  mountTrpc(
    app,
    "/trpc/consumers/sandbox",
    sandboxRouter,
    "tRPC consumers.sandbox",
  );
  mountTrpc(app, "/trpc", appRouter, "tRPC");

  const clientDir = path.join(import.meta.dirname, "../../../public");
  const indexHtml = path.join(clientDir, "index.html");

  if (fs.existsSync(indexHtml)) {
    app.use(
      "/assets",
      express.static(path.join(clientDir, "assets"), {
        maxAge: "1y",
        immutable: true,
      }),
    );

    app.use(express.static(clientDir, { maxAge: "1h" }));

    app.get("/{*splat}", spaFallback(indexHtml));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
