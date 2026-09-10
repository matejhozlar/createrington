import { route } from "@/app/middleware";
import { Router } from "express";
import { ServersController } from "./servers.controller";

const router = Router();

// GET /api/servers/status - Current status and player counts of every configured server; `?server=<slug>` narrows to one (404 when unknown). Cacheable for 10 seconds
router.get("/status", ...route("public", ServersController.getStatus));

export default router;
