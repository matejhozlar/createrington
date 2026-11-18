import {
  route,
  validate,
  verifyModJWT,
  verifyServerIP,
} from "@/app/middleware";
import { Router } from "express";
import { PartiesController } from "./parties.controller";
import { PartyClaimsBodySchema, PartySyncBodySchema } from "./parties.schemas";

const router = Router();

router.post(
  "/sync",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    validate({ body: PartySyncBodySchema }),
    PartiesController.sync,
  ),
);

router.post(
  "/claims",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    validate({ body: PartyClaimsBodySchema }),
    PartiesController.claims,
  ),
);

export default router;
