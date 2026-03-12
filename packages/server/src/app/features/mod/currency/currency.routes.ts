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

// POST /api/currency/login — issue a short-lived mod JWT
router.post(
  "/login",
  ...customRoute([verifyServerIP], CurrencyController.login),
);

// ============================================================================
// BALANCE & TRANSACTIONS (server IP + mod JWT)
// ============================================================================

// GET /api/currency/balance — current balance for the authenticated player
router.get(
  "/balance",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.getBalance),
);

// POST /api/currency/pay — transfer currency between two players
router.post(
  "/pay",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.pay),
);

// POST /api/currency/deposit — add currency to the authenticated player
router.post(
  "/deposit",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.deposit),
);

// POST /api/currency/withdraw — remove currency from the authenticated player
router.post(
  "/withdraw",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.withdraw),
);

// GET /api/currency/top — leaderboard of top 10 balances
router.get(
  "/top",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.getTop),
);

// ============================================================================
// DAILY REWARD
// ============================================================================

// POST /api/currency/daily — claim the daily reward
router.post(
  "/daily",
  ...customRoute([verifyServerIP, verifyModJWT], CurrencyController.claimDaily),
);

// ============================================================================
// LOTTERY & VOTE (placeholder stubs)
// ============================================================================

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
