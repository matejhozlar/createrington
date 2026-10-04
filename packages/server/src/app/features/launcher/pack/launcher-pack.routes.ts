import { Router } from "express";
import { customRoute } from "@/app/middleware/compose";
import { authenticateLauncher } from "@/app/middleware/launcher-auth.middleware";
import { launcherPackLimiter } from "@/app/middleware/rate-limit.middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { LauncherPackController } from "./launcher-pack.controller";
import {
  ListReleasesQuerySchema,
  ResolveFilesBodySchema,
} from "./launcher-pack.schemas";

const router = Router();

router.use(launcherPackLimiter);

router.get(
  "/latest",
  ...customRoute([authenticateLauncher], LauncherPackController.latest),
);
router.get(
  "/releases",
  ...customRoute(
    [authenticateLauncher, validate({ query: ListReleasesQuerySchema })],
    LauncherPackController.releases,
  ),
);
router.post(
  "/files/resolve",
  ...customRoute(
    [authenticateLauncher, validate({ body: ResolveFilesBodySchema })],
    LauncherPackController.resolveFiles,
  ),
);

export default router;
