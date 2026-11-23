import { route, validate } from "@/app/middleware";
import { Router } from "express";
import { ServersController } from "./servers.controller";
import { ServerStatusQuerySchema } from "./servers.schemas";

const router = Router();

router.get(
  "/status",
  ...route(
    "public",
    validate({ query: ServerStatusQuerySchema }),
    ServersController.getStatus,
  ),
);

export default router;
