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
} from "./middleware";
import { appRouter } from "@/trpc/router";
import { panelRouter } from "@/trpc/routers/consumers/panel";
import { createContext } from "@/trpc/context";
import config from "@/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { Status } from "discord.js";
import { container, Services, getServiceSync } from "@/services";
// import { poolMonitor } from "@/db";

/** Creates and configures the Express application with routes, tRPC, static files, and error handling */
export function createApp(): Express {
  const app = express();
  if (config.envMode.isProd) {
    // One hop: the front proxy (Cloudflare -> Caddy/nginx) must replace any
    // client-supplied X-Forwarded-For before forwarding, otherwise req.ip
    // and rate-limit keys can be spoofed.
    app.set("trust proxy", 1);
  }

  // Stripe webhook requires raw body for signature verification — mount before express.json()
  app.use("/api/donations/webhook", express.raw({ type: "application/json" }));

  // Chunk sync from opac-teams can be much larger than the default 1mb cap:
  // a full sync of up to 50k claimed chunks across many players easily reaches
  // a few megabytes. Mount before the global parser so this route gets the
  // higher limit and the rest of the API stays at 1mb.
  app.use("/api/chunks/sync", express.json({ limit: "8mb" }));

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "script-src": ["'self'", "https://static.cloudflareinsights.com"],
          "connect-src": [
            "'self'",
            "https://cloudflareinsights.com",
            "wss:",
            "ws:",
          ],
        },
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.envMode.isProd
        ? [config.meta.links.website, ...config.app.auth.sso.corsOrigins]
        : "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(globalLimiter);
  app.use("/api/auth", authLimiter);

  app.get("/health", async (_req, res) => {
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

    // Database component
    // const dbStats = poolMonitor.getStats();
    // const database = {
    //   available: true,
    //   totalCount: dbStats.totalCount,
    //   idleCount: dbStats.idleCount,
    //   waitingCount: dbStats.waitingCount,
    //   maxSize: dbStats.maxSize,
    //   utilization: dbStats.utilization,
    // };

    const discordBots: Record<string, unknown> = {};
    for (const [key, serviceKey] of [
      ["mainBot", Services.DISCORD_MAIN_BOT],
      ["webBot", Services.DISCORD_WEB_BOT],
    ] as const) {
      try {
        const bot = getServiceSync(serviceKey);
        discordBots[key] = {
          available: true,
          status: Status[bot.ws.status],
          ping: bot.ws.ping,
        };
      } catch {
        discordBots[key] = { available: false };
      }
    }

    let websocket: Record<string, unknown>;
    try {
      const ws = getServiceSync(Services.WEBSOCKET_SERVICE);
      const wsStats = await ws.getStats();
      websocket = {
        available: true,
        connectedClients: wsStats.connectedClients,
        rooms: Object.keys(wsStats.rooms).length,
        subscriptions: wsStats.subscriptions,
        uptime: wsStats.uptime,
      };
    } catch {
      websocket = { available: false };
    }

    let playtime: Record<string, unknown>;
    try {
      const pm = getServiceSync(Services.PLAYTIME_MANAGER_SERVICE);
      const pmStatus = pm.getStatus();
      const servers: Record<string, unknown> = {};
      for (const [serverId, info] of Object.entries(pmStatus)) {
        const s = info as {
          isInitialized: boolean;
          activeSessions: number;
          serverState: string;
        };
        servers[serverId] = {
          isInitialized: s.isInitialized,
          activeSessions: s.activeSessions,
          serverState: s.serverState,
        };
      }
      playtime = { available: true, servers };
    } catch {
      playtime = { available: false };
    }

    res.json({
      status,
      uptime: process.uptime(),
      services: Object.fromEntries(
        entries.map(([name, state]) => [name, state]),
      ),
      components: {
        // database,
        discord: discordBots,
        websocket,
        playtime,
      },
    });
  });

  registerRoutes(app);

  // Dedicated mount for the consumer-panel router. External consumer apps
  // (the admin panel) type their tRPC client against `PanelRouter` from
  // `@createrington/api-types`, which is a standalone router type — its
  // procedures resolve relative to its own root. Mounting panelRouter at
  // its own URL lets consumers use the natural procedure paths
  // (`presence.onlineByServer` etc) without knowing they're nested under
  // `consumers.panel.*` inside the main appRouter.
  //
  // MUST be registered BEFORE the generic `/trpc` mount — Express matches
  // handlers in order, so the more specific path has to come first to
  // avoid being swallowed by the appRouter mount.
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

  // Mount tRPC adapter — logs internal errors at error level, client errors at warn
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

  // Dev-only tRPC UI panel for interactive procedure testing
  if (config.envMode.isDev) {
    app.use("/panel", async (_req, res) => {
      const { renderTrpcPanel } = await import("trpc-ui");
      return res.send(renderTrpcPanel(appRouter, { url: "/trpc" }));
    });
  }

  // Serve client static files in production
  const clientDir = path.join(import.meta.dirname, "../../../public");
  const indexHtml = path.join(clientDir, "index.html");

  if (fs.existsSync(indexHtml)) {
    // Hashed assets are immutable — cache forever
    app.use(
      "/assets",
      express.static(path.join(clientDir, "assets"), {
        maxAge: "1y",
        immutable: true,
      }),
    );

    // Everything else (favicon, etc.) — short cache
    app.use(express.static(clientDir, { maxAge: "1h" }));

    // SPA catch-all: serve index.html with no-cache so the browser
    // always fetches the latest version after deployments
    app.get("/{*splat}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexHtml);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
