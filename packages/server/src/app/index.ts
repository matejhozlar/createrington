import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerRoutes } from "./features";
import { errorHandler, notFoundHandler } from "./middleware";
import { appRouter } from "@/trpc/router";
import { createContext } from "@/trpc/context";
import config from "@/config";
import cors from "cors";
import { container } from "@/services";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({ origin: true, credentials: true }));

  app.get("/health", (_req, res) => {
    const states = container.getAllStates();
    const entries = Object.entries(states);
    const failed = entries.filter(([, s]) => s === "failed");
    const ready = entries.filter(([, s]) => s === "ready");

    const status =
      failed.length > 0
        ? "degraded"
        : ready.length === entries.length
          ? "healthy"
          : "starting";

    res.json({
      status,
      uptime: process.uptime(),
      services: Object.fromEntries(
        entries.map(([name, state]) => [name, state]),
      ),
    });
  });

  registerRoutes(app);

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

  if (config.envMode.isDev) {
    app.use("/panel", async (_req, res) => {
      const { renderTrpcPanel } = await import("trpc-ui");
      return res.send(
        renderTrpcPanel(appRouter, { url: "/trpc" }),
      );
    });
  }

  // Serve client static files in production
  const clientDir = path.join(import.meta.dirname, "../../../public");
  const indexHtml = path.join(clientDir, "index.html");

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(clientDir));

    // SPA catch-all: serve index.html for client-side routes
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(indexHtml);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
