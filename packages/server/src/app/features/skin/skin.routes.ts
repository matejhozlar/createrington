import { Router } from "express";
import { route } from "@/app/middleware/compose";
import { validate } from "@/app/middleware/validation.middleware";
import { skinPoseLimiter } from "@/app/middleware/rate-limit.middleware";
import { SkinController } from "./skin.controller";
import {
  AvatarParamsSchema,
  AvatarQuerySchema,
  PoseParamsSchema,
} from "./skin.schemas";

const router = Router();

router.get(
  "/:player/avatar",
  ...route(
    "public",
    validate({ params: AvatarParamsSchema, query: AvatarQuerySchema }),
    SkinController.avatar,
  ),
);

router.get(
  "/:player/pose/:pose",
  ...route(
    "public",
    skinPoseLimiter,
    validate({ params: PoseParamsSchema }),
    SkinController.pose,
  ),
);

export default router;
