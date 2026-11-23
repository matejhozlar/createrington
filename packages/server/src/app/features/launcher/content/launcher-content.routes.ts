import { Router } from "express";
import { route } from "@/app/middleware/compose";
import { authenticateLauncher } from "@/app/middleware/launcher-auth.middleware";
import {
  launcherContentFileBatchLimiter,
  launcherContentLimiter,
} from "@/app/middleware/rate-limit.middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { LauncherContentController } from "./launcher-content.controller";
import {
  ContentIdParamsSchema,
  FileChangelogQuerySchema,
  GetFilesBodySchema,
  GetProjectsBodySchema,
  IdentifyFingerprintsBodySchema,
  ListCategoriesQuerySchema,
  ListFilesQuerySchema,
  SearchContentQuerySchema,
} from "./launcher-content.schemas";

const router = Router();

router.use(authenticateLauncher, launcherContentLimiter);

router.get(
  "/search",
  ...route(
    "public",
    validate({ query: SearchContentQuerySchema }),
    LauncherContentController.search,
  ),
);
router.get(
  "/categories",
  ...route(
    "public",
    validate({ query: ListCategoriesQuerySchema }),
    LauncherContentController.categories,
  ),
);
router.post(
  "/projects",
  ...route(
    "public",
    validate({ body: GetProjectsBodySchema }),
    LauncherContentController.projects,
  ),
);
router.get(
  "/projects/:id",
  ...route(
    "public",
    validate({ params: ContentIdParamsSchema }),
    LauncherContentController.project,
  ),
);
router.post(
  "/fingerprints",
  ...route(
    "public",
    validate({ body: IdentifyFingerprintsBodySchema }),
    LauncherContentController.fingerprints,
  ),
);
router.get(
  "/projects/:id/files",
  ...route(
    "public",
    validate({ params: ContentIdParamsSchema, query: ListFilesQuerySchema }),
    LauncherContentController.files,
  ),
);
router.post(
  "/files",
  ...route(
    "public",
    launcherContentFileBatchLimiter,
    validate({ body: GetFilesBodySchema }),
    LauncherContentController.filesById,
  ),
);
router.get(
  "/files/:id",
  ...route(
    "public",
    validate({ params: ContentIdParamsSchema }),
    LauncherContentController.file,
  ),
);
router.get(
  "/files/:id/changelog",
  ...route(
    "public",
    validate({
      params: ContentIdParamsSchema,
      query: FileChangelogQuerySchema,
    }),
    LauncherContentController.fileChangelog,
  ),
);

export default router;
