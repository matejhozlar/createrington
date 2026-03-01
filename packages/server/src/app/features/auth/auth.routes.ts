import { AuthController } from "./auth.controller";
import { route } from "@/app/middleware";
import { Router } from "express";
import { optionalAuth } from "@/app/middleware/auth.middleware";
import { asyncHandler } from "@/app/middleware/async-handler";

const router = Router();

/**
 * Auth routes
 * Base path: /api/auth
 */
// ============================================================================
// PUBLIC ROUTES
// ============================================================================
// GET /api/auth/discord - Get redirect URI for user
router.get("/discord", ...route("public", AuthController.getAuthUrl));
// POST /api/auth/discord/callback - Code exchange with Discord API
router.post(
  "/discord/callback",
  ...route("public", AuthController.handleDiscordCallback),
);
// POST /api/auth/refresh - Rotate refresh token (cookie-based, no Bearer needed)
router.post("/refresh", ...route("public", AuthController.refreshToken));
// POST /api/auth/logout - Revoke session via cookie + clear cookie
router.post(
  "/logout",
  asyncHandler(optionalAuth),
  asyncHandler(AuthController.logout),
);

// ============================================================================
// USER ROUTES
// ============================================================================
// GET /api/auth/me - Returns current user information from JWT
router.get("/me", ...route("user", AuthController.getCurrentUser));

// POST /api/auth/logout-all - Revoke all sessions for user
router.post("/logout-all", ...route("user", AuthController.logoutAll));

// GET /api/auth/status - Check authentication status
router.get("/status", ...route("user", AuthController.checkStatus));

export default router;
