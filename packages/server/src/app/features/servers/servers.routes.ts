import { route } from "@/app/middleware";
import { Router } from "express";
import { ServersController } from "./servers.controller";

const router = Router();

/**
 * Server status routes
 * Base path: /api/servers
 *
 * Public, cache-friendly status snapshots for launcher and in-game menu
 * integrations (e.g. FancyMenu) that fetch the URL directly.
 */

// GET /api/servers/status - Status and player counts of every configured server, optionally narrowed with ?server=<slug>
router.get("/status", ...route("public", ServersController.getStatus));

export default router;
