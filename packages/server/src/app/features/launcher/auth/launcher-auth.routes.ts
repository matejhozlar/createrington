import { Router } from "express";
import { customRoute, route } from "@/app/middleware/compose";
import { authenticateLauncher } from "@/app/middleware/launcher-auth.middleware";
import { launcherAuthLimiter } from "@/app/middleware/rate-limit.middleware";
import { validate } from "@/app/middleware/validation.middleware";
import { LauncherAuthController } from "./launcher-auth.controller";
import {
  RefreshTokenBodySchema,
  VerifyBodySchema,
} from "./launcher-auth.schemas";

const router = Router();

router.use(launcherAuthLimiter);

router.post("/challenge", ...route("public", LauncherAuthController.challenge));
router.post(
  "/verify",
  ...route(
    "public",
    validate({ body: VerifyBodySchema }),
    LauncherAuthController.verify,
  ),
);
router.post(
  "/refresh",
  ...route(
    "public",
    validate({ body: RefreshTokenBodySchema }),
    LauncherAuthController.refresh,
  ),
);
router.post(
  "/logout",
  ...route(
    "public",
    validate({ body: RefreshTokenBodySchema }),
    LauncherAuthController.logout,
  ),
);
router.get(
  "/me",
  ...customRoute([authenticateLauncher], LauncherAuthController.me),
);

export default router;
