import { route } from "@/app/middleware";
import { Router } from "express";
import { ServersController } from "./servers.controller";

const router = Router();

router.get("/status", ...route("public", ServersController.getStatus));

export default router;
