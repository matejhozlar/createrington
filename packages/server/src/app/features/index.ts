import type { Express } from "express";
import waitlistRoutes from "./waitlist/waitlist.routes";
import authRoutes from "./auth/auth.routes";
import presenceRoutes from "./presence/presence.routes";
import serverRoutes from "./server/server.routes";
import playerRoutes from "./player/player.routes";
import messageRoutes from "./message/message.routes";

/**
 * Register all API routes
 *
 * @param app - Express application instance
 */
export function registerRoutes(app: Express): void {
  // API prefix
  const API_PREFIX = "/api";

  // Register route modules
  app.use(`${API_PREFIX}/waitlist`, waitlistRoutes);
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/presence`, presenceRoutes);
  app.use(`${API_PREFIX}/servers`, serverRoutes);
  app.use(`${API_PREFIX}/players`, playerRoutes);
  app.use(`${API_PREFIX}/messages`, messageRoutes);

  logger.info("API routes registered");
}
