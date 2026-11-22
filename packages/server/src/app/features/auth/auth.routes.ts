import { AuthController } from "./auth.controller";
import { route } from "@/app/middleware";
import { Router } from "express";
import {
  optionalAuth,
  requireTrustedOrigin,
} from "@/app/middleware/auth.middleware";
import config from "@/config";

const router = Router();

router.get("/discord", ...route("public", AuthController.getAuthUrl));
router.post(
  "/discord/callback",
  ...route("public", AuthController.handleDiscordCallback),
);
if (config.app.auth.sso.callbackUrl) {
  router.get("/sso/start", ...route("public", AuthController.ssoStart));
  router.get("/sso/callback", ...route("public", AuthController.ssoCallback));
  router.get("/sso/consent", ...route("user", AuthController.ssoConsent));
  router.post(
    "/sso/authorize",
    requireTrustedOrigin,
    ...route("user", AuthController.ssoAuthorize),
  );
}
router.post(
  "/refresh",
  requireTrustedOrigin,
  ...route("public", AuthController.refreshToken),
);
router.post(
  "/logout",
  requireTrustedOrigin,
  ...route("public", optionalAuth, AuthController.logout),
);

router.get("/me", ...route("user", AuthController.getCurrentUser));

router.post(
  "/logout-all",
  requireTrustedOrigin,
  ...route("user", AuthController.logoutAll),
);

if (config.envMode.isDev) {
  router.get(
    "/dev-set-refresh",
    ...route("public", AuthController.devSetRefresh),
  );
}

export default router;
