import { Router } from "express";
import { route } from "@/app/middleware/compose";
import { validate } from "@/app/middleware/validation.middleware";
import { AdminChatController } from "./admin-chat.controller";
import { StreamQuerySchema } from "./admin-chat.schemas";

const router = Router();

router.get(
  "/stream",
  ...route(
    "admin",
    validate({ query: StreamQuerySchema }),
    AdminChatController.stream,
  ),
);

export default router;
