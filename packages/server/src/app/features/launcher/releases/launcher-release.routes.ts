import { Router } from "express";
import { customRoute } from "@/app/middleware/compose";
import {
  requireDirectRequest,
  verifyLauncherPublishToken,
} from "@/app/middleware/launcher-publish.middleware";
import { launcherUpdateCheckLimiter } from "@/app/middleware/rate-limit.middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { LauncherReleaseController } from "./launcher-release.controller";
import { PublishReleaseBodySchema } from "./launcher-release.schemas";

export const launcherUpdateCheckRoutes = Router();

launcherUpdateCheckRoutes.get(
  "/updates/:platform/:currentVersion",
  ...customRoute(
    [launcherUpdateCheckLimiter],
    LauncherReleaseController.checkForUpdate,
  ),
);

export const launcherPublishRoutes = Router();

launcherPublishRoutes.post(
  "/releases",
  ...customRoute(
    [
      requireDirectRequest,
      verifyLauncherPublishToken,
      validate({ body: PublishReleaseBodySchema }),
    ],
    LauncherReleaseController.publish,
  ),
);
