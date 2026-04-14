import type { Express } from "express";
import config from "@/config";
import { env } from "@/config/env/env.config";
import authRoutes from "./auth/auth.routes";
import donationRoutes from "./donation/donation.routes";
import skinRoutes from "./skin/skin.routes";
import currencyRoutes from "./mod/currency/currency.routes";
import forceloadsRoutes from "./mod/forceloads/forceloads.routes";
import presenceRoutes from "./mod/presence/presence.routes";
import messageRoutes from "./user/message/message.routes";
import renderRoutes from "./render/render.routes";
import trainRoutes from "./mod/trains/trains.routes";
import internalPresenceRoutes from "./internal/presence/presence.routes";
import adminChatRoutes from "./admin-chat/admin-chat.routes";
import legacyCurrencyRoutes from "./legacy/currency/currency.routes";

/** Mounts all feature route modules onto the Express app under the /api prefix */
export function registerRoutes(app: Express): void {
  const API_PREFIX = "/api";

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/donations`, donationRoutes);
  app.use(`${API_PREFIX}/skin`, skinRoutes);
  app.use(`${API_PREFIX}/currency`, currencyRoutes);
  app.use(`${API_PREFIX}/legacy/currency`, legacyCurrencyRoutes);
  app.use(`${API_PREFIX}/forceloads`, forceloadsRoutes);
  app.use(`${API_PREFIX}/presence`, presenceRoutes);
  app.use(`${API_PREFIX}/messages`, messageRoutes);
  app.use(`${API_PREFIX}/render`, renderRoutes);
  app.use(`${API_PREFIX}/trains`, trainRoutes);

  // Internal cross-environment routes (only active when sync secret is set)
  if (config.sync.secret) {
    app.use(`${API_PREFIX}/internal/presence`, internalPresenceRoutes);
    logger.info("Internal sync routes registered");
  }

  // Admin chat proxy — only active when the upstream URL is configured.
  // Routes gate on requireAdmin internally; the secret (if set) is injected
  // into outbound calls so it never touches the browser.
  if (env.CLAUDE_API_URL) {
    app.use(`${API_PREFIX}/claude-chat`, adminChatRoutes);
    logger.info("Admin chat proxy routes registered");
  }

  logger.info("API routes registered");
}
