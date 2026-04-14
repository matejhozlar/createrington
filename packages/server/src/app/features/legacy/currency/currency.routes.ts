import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { LegacyCurrencyController } from "./currency.controller";

const router = Router();

/**
 * Legacy currency routes
 * Base path: /api/legacy/currency
 *
 * Pre-envelope response shapes for mod builds that haven't migrated to the
 * ApiResponse envelope yet. Same paths as /api/currency so the mod only
 * needs its base URL flipped via config.
 */

router.post(
  "/login",
  ...customRoute([verifyServerIP], LegacyCurrencyController.login),
);

router.get(
  "/balance",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.getBalance,
  ),
);

router.post(
  "/pay",
  ...customRoute([verifyServerIP, verifyModJWT], LegacyCurrencyController.pay),
);

router.post(
  "/deposit",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.deposit,
  ),
);

router.post(
  "/withdraw",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.withdraw,
  ),
);

router.get(
  "/history",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.getHistory,
  ),
);

router.get(
  "/top",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.getTop,
  ),
);

router.post(
  "/daily",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.claimDaily,
  ),
);

router.post(
  "/lottery/start",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.startLottery,
  ),
);

router.post(
  "/lottery/join",
  ...customRoute(
    [verifyServerIP, verifyModJWT],
    LegacyCurrencyController.joinLottery,
  ),
);

export default router;
