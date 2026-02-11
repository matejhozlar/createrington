import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { CurrencyController } from "./currency.controller";

const router = Router();

/**
 * Currency routes
 * Base path: /api/currency
 *
 * These endpoints are called by the Minecraft mod for in-game economy operations.
 */

// ============================================================================
// LOGIN (server IP only — creates the mod JWT)
// ============================================================================

router.post(
  "/login",
  ...customRoute([verifyServerIP], CurrencyController.login),
);

// ============================================================================
// BALANCE & TRANSACTIONS (server IP + mod JWT)
// ============================================================================

router.get(
  "/balance",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.getBalance),
);

router.post(
  "/pay",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.pay),
);

router.post(
  "/deposit",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.deposit),
);

router.post(
  "/withdraw",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.withdraw),
);

router.get(
  "/top",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.getTop),
);

// ============================================================================
// DAILY REWARD
// ============================================================================

router.post(
  "/daily",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.claimDaily),
);

// ============================================================================
// PLACEHOLDERS
// ============================================================================

router.get(
  "/mob-limit",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    CurrencyController.checkMobLimit,
  ),
);

router.post(
  "/mob-limit",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    CurrencyController.markMobLimit,
  ),
);

router.post(
  "/lottery/start",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    CurrencyController.startLottery,
  ),
);

router.post(
  "/lottery/join",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    CurrencyController.joinLottery,
  ),
);

router.post(
  "/vote/start",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.startVote),
);

export default router;
