import { route } from "@/app/middleware";
import { Router } from "express";
import { ModpacksController } from "./modpacks.controller";

const router = Router();

/**
 * Modpack routes
 * Base path: /api/modpacks
 *
 * Public, cache-friendly modpack content for in-game menu integrations
 * (e.g. FancyMenu) that fetch the URL directly.
 */

// GET /api/modpacks/:project/changelog.md - Markdown changelog of the newest release of the modpack published as CurseForge project :project
router.get(
  "/:project/changelog.md",
  ...route("public", ModpacksController.getChangelog),
);

// GET /api/modpacks/:project/changelog/:version.md - Same changelog, followed by the installed release's when :version names an older one
router.get(
  "/:project/changelog/:version.md",
  ...route("public", ModpacksController.getChangelog),
);

// GET /api/modpacks/:project/version/:version.json - Whether the installed pack version is behind the newest release
router.get(
  "/:project/version/:version.json",
  ...route("public", ModpacksController.getVersionStatus),
);

// GET /api/modpacks/:project/changelog/rows/:release/:mod.png - One changelog entry rendered as a PNG row (icon, name, version change)
router.get(
  "/:project/changelog/rows/:release/:mod.png",
  ...route("public", ModpacksController.getChangelogRow),
);

export default router;
