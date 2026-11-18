import {
  route,
  validate,
  verifyModJWT,
  verifyServerIP,
} from "@/app/middleware";
import { Router } from "express";
import { PresenceController } from "./presence.controller";
import { HeartbeatBodySchema, PresenceBodySchema } from "./presence.schemas";

const router = Router();

router.post(
  "/",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    validate({ body: PresenceBodySchema }),
    PresenceController.updatePresence,
  ),
);

router.post(
  "/heartbeat",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    validate({ body: HeartbeatBodySchema }),
    PresenceController.heartbeat,
  ),
);

export default router;
