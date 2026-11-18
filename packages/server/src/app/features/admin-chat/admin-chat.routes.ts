import { Router } from "express";
import { route } from "@/app/middleware/compose";
import { validate } from "@/app/middleware/validation.middleware";
import { AdminChatController } from "./admin-chat.controller";
import {
  EndBodySchema,
  MessagesQuerySchema,
  SendBodySchema,
  SessionsQuerySchema,
  StartBodySchema,
  StreamQuerySchema,
} from "./admin-chat.schemas";

const router = Router();

router.get("/enabled", ...route("admin", AdminChatController.enabled));

router.get("/repos", ...route("admin", AdminChatController.repos));

router.get("/session", ...route("admin", AdminChatController.session));

router.get(
  "/sessions",
  ...route(
    "admin",
    validate({ query: SessionsQuerySchema }),
    AdminChatController.sessions,
  ),
);

router.get(
  "/messages",
  ...route(
    "admin",
    validate({ query: MessagesQuerySchema }),
    AdminChatController.messages,
  ),
);

router.post(
  "/start",
  ...route(
    "admin",
    validate({ body: StartBodySchema }),
    AdminChatController.start,
  ),
);

router.post(
  "/send",
  ...route(
    "admin",
    validate({ body: SendBodySchema }),
    AdminChatController.send,
  ),
);

router.post(
  "/end",
  ...route("admin", validate({ body: EndBodySchema }), AdminChatController.end),
);

router.get(
  "/stream",
  ...route(
    "admin",
    validate({ query: StreamQuerySchema }),
    AdminChatController.stream,
  ),
);

export default router;
