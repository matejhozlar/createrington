import {
  customRoute,
  validate,
  verifyModJWT,
  verifyServerIP,
} from "@/app/middleware";
import { Router } from "express";
import { PartiesController } from "./parties.controller";
import { PartySyncBodySchema } from "./parties.schemas";

const router = Router();

router.post(
  "/sync",
  ...customRoute(
    [verifyServerIP, verifyModJWT, validate({ body: PartySyncBodySchema })],
    PartiesController.sync,
  ),
);

export default router;
