import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerRoutes } from "./features";
import {
  errorHandler,
  notFoundHandler,
  globalLimiter,
  authLimiter,
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
      origin: config.envMode.isProd
        ? [config.meta.links.website, ...config.app.auth.sso.corsOrigins]
        : config.app.devClientOrigin,
      credentials: true,
    }),
  );
  app.use(requestLogger);
  app.use(globalLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/modpacks", modpacksLimiter);

  registerHealthRoute(app);

  registerRoutes(app);

  app.use(
    "/trpc/consumers/panel",
    createExpressMiddleware({
      router: panelRouter,
      createContext,
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error(`[tRPC consumers.panel] ${path}:`, {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
          });
        } else {
          logger.warn(`[tRPC consumers.panel] ${path}: ${error.message}`);
        }
      },
    }),
  );

  app.use(
    "/trpc/consumers/sandbox",
    createExpressMiddleware({
      router: sandboxRouter,
      createContext,
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error(`[tRPC consumers.sandbox] ${path}:`, {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
          });
        } else {
          logger.warn(`[tRPC consumers.sandbox] ${path}: ${error.message}`);
        }
      },
    }),
  );

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error(`[tRPC] ${path}:`, {
            message: error.message,
            stack: error.stack,
            cause: error.cause,
          });
        } else {
          logger.warn(`[tRPC] ${path}: ${error.message}`);
        }
      },
    }),
  );

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

    app.get("/{*splat}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexHtml);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
