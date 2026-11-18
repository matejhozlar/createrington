import {
  customRoute,
  modCurrencyMutationLimiter,
  requireKnownPlayer,
  verifyModJWT,
  verifyServerIP,
} from "@/app/middleware";
import { Router } from "express";
import { CurrencyController } from "./currency.controller";

const router = Router();

router.get(
  "/balance",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.getBalance,
  ),
);

router.post(
  "/pay",
  ...customRoute(
    [
      verifyServerIP,
      verifyModJWT,
      requireKnownPlayer,
      modCurrencyMutationLimiter,
    ],
    CurrencyController.pay,
  ),
);

router.post(
  "/deposit",
  ...customRoute(
    [
      verifyServerIP,
      verifyModJWT,
      requireKnownPlayer,
      modCurrencyMutationLimiter,
    ],
    CurrencyController.deposit,
  ),
);

router.post(
  "/withdraw",
  ...customRoute(
    [
      verifyServerIP,
      verifyModJWT,
      requireKnownPlayer,
      modCurrencyMutationLimiter,
    ],
    CurrencyController.withdraw,
  ),
);

router.get(
  "/history",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.getHistory,
  ),
);

router.get(
  "/top",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.getTop,
  ),
);

router.post(
  "/daily",
  ...customRoute(
    [verifyServerIP, verifyModJWT, requireKnownPlayer],
    CurrencyController.claimDaily,
  ),
);

export default router;
