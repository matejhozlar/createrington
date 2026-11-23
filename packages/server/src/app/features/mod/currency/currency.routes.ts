import {
  route,
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
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    requireKnownPlayer,
    CurrencyController.getBalance,
  ),
);

router.post(
  "/pay",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    requireKnownPlayer,
    modCurrencyMutationLimiter,
    CurrencyController.pay,
  ),
);

router.post(
  "/deposit",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    requireKnownPlayer,
    modCurrencyMutationLimiter,
    CurrencyController.deposit,
  ),
);

router.post(
  "/withdraw",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    requireKnownPlayer,
    modCurrencyMutationLimiter,
    CurrencyController.withdraw,
  ),
);

router.get(
  "/history",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    requireKnownPlayer,
    CurrencyController.getHistory,
  ),
);

router.get(
  "/top",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    requireKnownPlayer,
    CurrencyController.getTop,
  ),
);

router.post(
  "/daily",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    requireKnownPlayer,
    CurrencyController.claimDaily,
  ),
);

export default router;
