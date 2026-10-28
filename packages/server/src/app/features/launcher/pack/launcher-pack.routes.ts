import { Router } from "express";
import { customRoute } from "@/app/middleware/compose";
import { authenticateLauncher } from "@/app/middleware/launcher-auth.middleware";
import { launcherPackLimiter } from "@/app/middleware/rate-limit.middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { LauncherPackController } from "./launcher-pack.controller";
import {
  ListReleasesQuerySchema,
  PackParamsSchema,
  ResolveFilesBodySchema,
  StorageFileParamsSchema,
  StorageSnapshotParamsSchema,
} from "./launcher-pack.schemas";

const router = Router();

router.use(authenticateLauncher, launcherPackLimiter);

router.get("/", ...customRoute([], LauncherPackController.list));
router.post(
  "/files/resolve",
  ...customRoute(
    [validate({ body: ResolveFilesBodySchema })],
    LauncherPackController.resolveFiles,
  ),
);
router.get(
  "/files/snapshot/:id",
  ...customRoute(
    [validate({ params: StorageSnapshotParamsSchema })],
    LauncherPackController.storageSnapshot,
  ),
);
router.get(
  "/files/:fileId",
  ...customRoute(
    [validate({ params: StorageFileParamsSchema })],
    LauncherPackController.storageFile,
  ),
);
router.get(
  "/:slug/latest",
  ...customRoute(
    [validate({ params: PackParamsSchema })],
    LauncherPackController.latest,
  ),
);
router.get(
  "/:slug/releases",
  ...customRoute(
    [validate({ params: PackParamsSchema, query: ListReleasesQuerySchema })],
    LauncherPackController.releases,
  ),
);

export default router;
