import { BadRequestError, messageSendLimiter, route } from "@/app/middleware";
import { Router } from "express";
import multer from "multer";
import { MessageController } from "./message.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 10,
    fieldSize: 100 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
    } else {
      callback(new BadRequestError("Only image files are allowed"));
    }
  },
});

router.post(
  "/",
  ...route(
    "user",
    messageSendLimiter,
    upload.single("image"),
    MessageController.sendMessage,
  ),
);

export default router;
