import {
  internalSsoLimiter,
  route,
  validate,
  verifyInternalSecret,
} from "@/app/middleware";
import { Router } from "express";
import { InternalSsoExchangeController } from "./sso-exchange.controller";
import { SsoExchangeBodySchema } from "./sso-exchange.schemas";

const router = Router();

router.post(
  "/",
  ...route(
    "public",
    internalSsoLimiter,
    verifyInternalSecret,
    validate({ body: SsoExchangeBodySchema }),
    InternalSsoExchangeController.exchange,
  ),
);

export default router;
