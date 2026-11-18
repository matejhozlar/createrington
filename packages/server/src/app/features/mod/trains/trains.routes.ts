import { customRoute, verifyModJWT, verifyServerIP } from "@/app/middleware";
import { Router } from "express";
import { TrainsController } from "./trains.controller";

const router = Router();

router.post(
  "/crash",
  ...customRoute([verifyServerIP, verifyModJWT], TrainsController.reportCrash),
);

export default router;
