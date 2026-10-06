import { Router } from "express";
import { customRoute } from "@/app/middleware/compose";
import { authenticateLauncher } from "@/app/middleware/launcher-auth.middleware";
import { launcherContentLimiter } from "@/app/middleware/rate-limit.middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { LauncherContentController } from "./launcher-content.controller";
import {
  ContentIdParamsSchema,
  GetProjectsBodySchema,
  IdentifyFingerprintsBodySchema,
  ListFilesQuerySchema,
  SearchContentQuerySchema,
} from "./launcher-content.schemas";

const router = Router();

router.use(authenticateLauncher, launcherContentLimiter);

router.get(
  "/search",
  ...customRoute(
    [validate({ query: SearchContentQuerySchema })],
    LauncherContentController.search,
  ),
);
router.post(
  "/projects",
  ...customRoute(
    [validate({ body: GetProjectsBodySchema })],
    LauncherContentController.projects,
  ),
);
router.post(
  "/fingerprints",
  ...customRoute(
    [validate({ body: IdentifyFingerprintsBodySchema })],
    LauncherContentController.fingerprints,
  ),
);
router.get(
  "/projects/:id/files",
  ...customRoute(
    [validate({ params: ContentIdParamsSchema, query: ListFilesQuerySchema })],
    LauncherContentController.files,
  ),
);
router.get(
  "/files/:id",
  ...customRoute(
    [validate({ params: ContentIdParamsSchema })],
    LauncherContentController.file,
  ),
);

export default router;
