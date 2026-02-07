import type { Express } from "express";
import waitlistRoutes from "./public/waitlists/waitlist.routes";
import authRoutes from "./auth/auth.routes";
import presenceRoutes from "./mod/presence/presence.routes";
import serverRoutes from "./public/servers/server.routes";
import playerRoutes from "./public/players/player.routes";
import messageRoutes from "./user/message/message.routes";
import adminPlayerRoutes from "./admin/player/admin-player.routes";
import adminWaitlistRoutes from "./admin/waitlist/admin-waitlist.routes";
import metricRoutes from "./public/metrics/metrics.routes";

/**
 * Register all API routes
 *
 * @param app - Express application instance
 */
export function registerRoutes(app: Express): void {
  // API prefix
  const API_PREFIX = "/api";

  // Register route modules
  app.use(`${API_PREFIX}/waitlists`, waitlistRoutes);
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/presence`, presenceRoutes);
  app.use(`${API_PREFIX}/servers`, serverRoutes);
  app.use(`${API_PREFIX}/players`, playerRoutes);
  app.use(`${API_PREFIX}/messages`, messageRoutes);
  app.use(`${API_PREFIX}/admin/players`, adminPlayerRoutes);
  app.use(`${API_PREFIX}/admin/waitlists`, adminWaitlistRoutes);
  app.use(`${API_PREFIX}/metrics`, metricRoutes);

  logger.info("API routes registered");
}
