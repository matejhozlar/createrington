import { route } from "@/app/middleware";
import { Router } from "express";
import { ModpacksController } from "./modpacks.controller";

const router = Router();

router.get(
  "/:project/changelog.md",
  ...route("public", ModpacksController.getChangelog),
);

router.get(
  "/:project/changelog/:version.md",
  ...route("public", ModpacksController.getChangelog),
);

router.get(
  "/:project/version/:version.json",
  ...route("public", ModpacksController.getVersionStatus),
);

router.get(
  "/:project/changelog/rows/:release/:mod.png",
  ...route("public", ModpacksController.getChangelogRow),
);

export default router;
