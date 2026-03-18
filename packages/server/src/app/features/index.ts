import type { Express } from "express";
import authRoutes from "./auth/auth.routes";
import skinRoutes from "./skin/skin.routes";
import currencyRoutes from "./mod/currency/currency.routes";
import presenceRoutes from "./mod/presence/presence.routes";
import messageRoutes from "./user/message/message.routes";
import renderRoutes from "./render/render.routes";
import trainRoutes from "./mod/trains/trains.routes";

/** Mounts all feature route modules onto the Express app under the /api prefix */
export function registerRoutes(app: Express): void {
  const API_PREFIX = "/api";

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/skin`, skinRoutes);
  app.use(`${API_PREFIX}/currency`, currencyRoutes);
  app.use(`${API_PREFIX}/presence`, presenceRoutes);
  app.use(`${API_PREFIX}/messages`, messageRoutes);
  app.use(`${API_PREFIX}/render`, renderRoutes);
  app.use(`${API_PREFIX}/trains`, trainRoutes);

  logger.info("API routes registered");
}
