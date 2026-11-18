import {
  customRoute,
  internalSsoLimiter,
  verifyInternalSecret,
} from "@/app/middleware";
import { Router } from "express";
import { InternalSsoExchangeController } from "./sso-exchange.controller";

const router = Router();

router.post(
  "/",
  ...customRoute(
    [internalSsoLimiter, verifyInternalSecret],
    InternalSsoExchangeController.exchange,
  ),
);

export default router;
