import type { Express } from "express";
import config from "@/config";
import { requireSupportedLauncher } from "@/app/middleware/launcher-version.middleware";
import { launcherJwtService } from "@/services/auth/launcher/launcher-jwt.service";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import launcherAuthRoutes from "./auth/launcher-auth.routes";
import launcherContentRoutes from "./content/launcher-content.routes";
import launcherPackRoutes from "./pack/launcher-pack.routes";
import {
  launcherPublishRoutes,
  launcherUpdateCheckRoutes,
} from "./releases/launcher-release.routes";

export function registerLauncherRoutes(app: Express, apiPrefix: string): void {
  if (!config.launcher.available) {
    logger.info("Launcher routes not registered on the production deployment");
    return;
  }

  if (launcherJwtService.isEnabled()) {
    app.use(
      `${apiPrefix}/launcher/auth`,
      requireSupportedLauncher,
      launcherAuthRoutes,
    );
    app.use(
      `${apiPrefix}/launcher/packs`,
      requireSupportedLauncher,
      launcherPackRoutes,
    );
    app.use(
      `${apiPrefix}/launcher/content`,
      requireSupportedLauncher,
      launcherContentRoutes,
    );
    logger.info("Launcher auth, pack and content routes registered");
  }

  app.use(`${apiPrefix}/launcher`, launcherUpdateCheckRoutes);

  if (launcherReleaseService.isEnabled()) {
    app.use(`${apiPrefix}/launcher`, launcherPublishRoutes);
    logger.info("Launcher publish route registered");
  }
}
