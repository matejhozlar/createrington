import {
  route,
  validate,
  verifyModJWT,
  verifyServerIP,
} from "@/app/middleware";
import { Router } from "express";
import { TrainsController } from "./trains.controller";
import { TrainCrashBodySchema } from "./trains.schemas";

const router = Router();

router.post(
  "/crash",
  ...route(
    "public",
    verifyServerIP,
    verifyModJWT,
    validate({ body: TrainCrashBodySchema }),
    TrainsController.reportCrash,
  ),
);

export default router;
