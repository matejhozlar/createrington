import { customRoute, verifyInternalSecret } from "@/app/middleware";
import { Router } from "express";
import { InternalSsoExchangeController } from "./sso-exchange.controller";

const router = Router();

/**
 * Internal SSO exchange route
 * Base path: /api/internal/sso-exchange
 *
 * Authentication: X-Internal-Secret header (shared secret with skin-api).
 */

/**
 * POST /api/internal/sso-exchange
 *
 * Redeem a one-time SSO code for the cross-service identity payload.
 *
 * Security:
 * - Requires valid X-Internal-Secret header
 *
 * Request body: { code: string }
 * Response data: { playerId, minecraftUsername, isMember, isOwner }
 */
router.post(
  "/",
  ...customRoute(
    [verifyInternalSecret],
    InternalSsoExchangeController.exchange,
  ),
);

export default router;
