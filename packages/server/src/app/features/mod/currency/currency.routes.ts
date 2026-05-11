import {
  customRoute,
  requireKnownPlayer,
  verifyModJWT,
  verifyServerIP,
} from "@/app/middleware";
import { Router } from "express";
import { CurrencyController } from "./currency.controller";

const router = Router();

/**
 * Currency routes
 * Base path: /api/currency
 *
 * These endpoints are called by the Minecraft mod for in-game economy operations.
 * Mods mint their own short-lived JWTs (HS256 + aud="createrington.mod")
 * via CRNet's selfSignedJwt strategy: no login endpoint.
 */

// GET /api/currency/balance: current balance for the authenticated player
router.get(
  "/balance",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.getBalance,
  ),
);

// POST /api/currency/pay: transfer currency between two players
router.post(
  "/pay",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.pay,
  ),
);

// POST /api/currency/deposit: add currency to the authenticated player
router.post(
  "/deposit",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.deposit,
  ),
);

// POST /api/currency/withdraw: remove currency from the authenticated player
router.post(
  "/withdraw",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.withdraw,
  ),
);

// GET /api/currency/history: paginated transaction history
router.get(
  "/history",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.getHistory,
  ),
);

// GET /api/currency/top: leaderboard of top 10 balances
router.get(
  "/top",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.getTop,
  ),
);

// POST /api/currency/daily: claim the daily reward
router.post(
  "/daily",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.claimDaily,
  ),
);

router.post(
  "/lottery/start",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.startLottery,
  ),
);

router.post(
  "/lottery/join",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.joinLottery,
  ),
);

export default router;
