import { AuthController } from "./auth.controller";
import { route } from "@/app/middleware";
import { Router } from "express";
import {
  optionalAuth,
  requireTrustedOrigin,
} from "@/app/middleware/auth.middleware";
import { asyncHandler } from "@/app/middleware/async-handler";
import config from "@/config";

const router = Router();

/**
 * Auth routes
 * Base path: /api/auth
 */
// GET /api/auth/discord - Get redirect URI for user
router.get("/discord", ...route("public", AuthController.getAuthUrl));
// POST /api/auth/discord/callback - Code exchange with Discord API
router.post(
  "/discord/callback",
  ...route("public", AuthController.handleDiscordCallback),
);
// SSO routes are only registered when SSO_CALLBACK_URL is configured.
// Without it, the server-driven flow can't function: leaving the routes
// unregistered surfaces "feature off" as a 404 instead of a runtime 400,
// and keeps dev deployments quiet (no env vars set ⇒ no SSO surface).
if (config.app.auth.sso.callbackUrl) {
  // GET /api/auth/sso/start - Server-driven SSO entry for cross-subdomain consumers
  router.get("/sso/start", ...route("public", AuthController.ssoStart));
  // GET /api/auth/sso/callback - Server-side SSO completion (Discord redirects here)
  router.get("/sso/callback", ...route("public", AuthController.ssoCallback));
}
// POST /api/auth/refresh - Rotate refresh token (cookie-based, no Bearer needed)
router.post(
  "/refresh",
  requireTrustedOrigin,
  ...route("public", AuthController.refreshToken),
);
// POST /api/auth/logout - Revoke session via cookie + clear cookie
router.post(
  "/logout",
  requireTrustedOrigin,
  asyncHandler(optionalAuth),
  asyncHandler(AuthController.logout),
);

// GET /api/auth/me - Returns current user information from JWT
router.get("/me", ...route("user", AuthController.getCurrentUser));

// POST /api/auth/logout-all - Revoke all sessions for user
router.post(
  "/logout-all",
  requireTrustedOrigin,
  ...route("user", AuthController.logoutAll),
);

// GET /api/auth/status - Check authentication status
router.get("/status", ...route("user", AuthController.checkStatus));

// GET /api/auth/dev-set-refresh - Dev-only auto-login helper for `pnpm mint-session --open`
if (config.envMode.isDev) {
  router.get(
    "/dev-set-refresh",
    ...route("public", AuthController.devSetRefresh),
  );
}

export default router;
