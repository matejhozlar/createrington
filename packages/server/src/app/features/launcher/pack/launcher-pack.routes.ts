import { Router } from "express";
import { route } from "@/app/middleware/compose";
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

router.get("/", ...route("public", LauncherPackController.list));
router.post(
  "/files/resolve",
  ...route(
    "public",
    validate({ body: ResolveFilesBodySchema }),
    LauncherPackController.resolveFiles,
  ),
);
router.get(
  "/files/snapshot/:id",
  ...route(
    "public",
    validate({ params: StorageSnapshotParamsSchema }),
    LauncherPackController.storageSnapshot,
  ),
);
router.get(
  "/files/:fileId",
  ...route(
    "public",
    validate({ params: StorageFileParamsSchema }),
    LauncherPackController.storageFile,
  ),
);
router.get(
  "/:slug/latest",
  ...route(
    "public",
    validate({ params: PackParamsSchema }),
    LauncherPackController.latest,
  ),
);
router.get(
  "/:slug/releases",
  ...route(
    "public",
    validate({ params: PackParamsSchema, query: ListReleasesQuerySchema }),
    LauncherPackController.releases,
  ),
);

export default router;
