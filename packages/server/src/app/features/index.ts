import type { Express } from "express";
import config from "@/config";
import authRoutes from "./auth/auth.routes";
import donationRoutes from "./donation/donation.routes";
import skinRoutes from "./skin/skin.routes";
import serversRoutes from "./servers/servers.routes";
import modpacksRoutes from "./modpacks/modpacks.routes";
import currencyRoutes from "./mod/currency/currency.routes";
import partiesRoutes from "./mod/parties/parties.routes";
import presenceRoutes from "./mod/presence/presence.routes";
import messageRoutes from "./user/message/message.routes";
import galleryRoutes from "./gallery/gallery.routes";
import renderRoutes from "./render/render.routes";
import ogRoutes from "./og/og.routes";
import trainRoutes from "./mod/trains/trains.routes";
import internalPresenceRoutes from "./internal/presence/presence.routes";
import internalSsoExchangeRoutes from "./internal/sso-exchange/sso-exchange.routes";
import adminChatRoutes from "./admin-chat/admin-chat.routes";
import { registerLauncherRoutes } from "./launcher";

export function registerRoutes(app: Express): void {
  const API_PREFIX = "/api";

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/donations`, donationRoutes);
  app.use(`${API_PREFIX}/skin`, skinRoutes);
  app.use(`${API_PREFIX}/servers`, serversRoutes);
  app.use(`${API_PREFIX}/modpacks`, modpacksRoutes);
  app.use(`${API_PREFIX}/currency`, currencyRoutes);
  app.use(`${API_PREFIX}/parties`, partiesRoutes);
  app.use(`${API_PREFIX}/presence`, presenceRoutes);
  app.use(`${API_PREFIX}/messages`, messageRoutes);
  app.use(`${API_PREFIX}/gallery`, galleryRoutes);
  app.use(`${API_PREFIX}/render`, renderRoutes);
  app.use(`${API_PREFIX}/og`, ogRoutes);
  app.use(`${API_PREFIX}/trains`, trainRoutes);

  if (config.sync.secret) {
    app.use(`${API_PREFIX}/internal/presence`, internalPresenceRoutes);
    logger.info("Internal sync routes registered");
  }

  if (config.internal.secret) {
    app.use(`${API_PREFIX}/internal/sso-exchange`, internalSsoExchangeRoutes);
    logger.info("Internal skin-api routes registered");
  }

  registerLauncherRoutes(app, API_PREFIX);

  if (config.adminChat.url) {
    app.use(`${API_PREFIX}/claude-chat`, adminChatRoutes);
    logger.info("Admin chat proxy routes registered");
  }

  logger.info("API routes registered");
}
