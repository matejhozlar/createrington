import { customRoute, validate, verifySyncSecret } from "@/app/middleware";
import {
  HeartbeatBodySchema,
  PresenceBodySchema,
} from "@/app/features/mod/presence/presence.schemas";
import { Router } from "express";
import { InternalPresenceController } from "./presence.controller";

const router = Router();

router.post(
  "/",
  ...customRoute(
    [verifySyncSecret, validate({ body: PresenceBodySchema })],
    InternalPresenceController.handleSyncedPresence,
  ),
);

router.post(
  "/heartbeat",
  ...customRoute(
    [verifySyncSecret, validate({ body: HeartbeatBodySchema })],
    InternalPresenceController.handleSyncedHeartbeat,
  ),
);

export default router;
