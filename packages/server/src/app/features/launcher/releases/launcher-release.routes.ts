import { Router } from "express";
import { route } from "@/app/middleware/compose";
import {
  requireDirectRequest,
  verifyLauncherPublishToken,
} from "@/app/middleware/launcher-publish.middleware";
import { launcherUpdateCheckLimiter } from "@/app/middleware/rate-limit.middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { LauncherReleaseController } from "./launcher-release.controller";
import {
  AvailableReleasesBodySchema,
  PublishReleaseBodySchema,
  UpdateCheckParamsSchema,
} from "./launcher-release.schemas";

export const launcherUpdateCheckRoutes = Router();

launcherUpdateCheckRoutes.get(
  "/updates/:platform/:currentVersion",
  ...route(
    "public",
    launcherUpdateCheckLimiter,
    validate({ params: UpdateCheckParamsSchema }),
    LauncherReleaseController.checkForUpdate,
  ),
);

export const launcherPublishRoutes = Router();

launcherPublishRoutes.post(
  "/releases",
  ...route(
    "public",
    requireDirectRequest,
    verifyLauncherPublishToken,
    validate({ body: PublishReleaseBodySchema }),
    LauncherReleaseController.publish,
  ),
);

launcherPublishRoutes.put(
  "/releases/available",
  ...route(
    "public",
    requireDirectRequest,
    verifyLauncherPublishToken,
    validate({ body: AvailableReleasesBodySchema }),
    LauncherReleaseController.setAvailable,
  ),
);
