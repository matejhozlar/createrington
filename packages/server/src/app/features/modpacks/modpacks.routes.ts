import { route, validate } from "@/app/middleware";
import { Router } from "express";
import { ModpacksController } from "./modpacks.controller";
import {
  ChangelogRowParamsSchema,
  ProjectVersionParamsSchema,
} from "./modpacks.schemas";

const router = Router();

const projectVersion = validate({ params: ProjectVersionParamsSchema });

router.get(
  "/:project/changelog.md",
  ...route("public", projectVersion, ModpacksController.getChangelog),
);

router.get(
  "/:project/changelog/:version.md",
  ...route("public", projectVersion, ModpacksController.getChangelog),
);

router.get(
  "/:project/version/:version.json",
  ...route("public", projectVersion, ModpacksController.getVersionStatus),
);

router.get(
  "/:project/changelog/rows/:release/:mod.png",
  ...route(
    "public",
    validate({ params: ChangelogRowParamsSchema }),
    ModpacksController.getChangelogRow,
  ),
);

export default router;
