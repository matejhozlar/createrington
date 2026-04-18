import { BadRequestError, route } from "@/app/middleware";
import { Router } from "express";
import multer from "multer";
import { MessageController } from "./message.controller";

const router = Router();

// Multer configuration
//
// - memoryStorage: files land in req.file.buffer — no disk writes.  We pass
//   the buffer straight into an AttachmentBuilder so there's nothing to clean up.
// - limits.fileSize: 10 MB hard cap enforced by multer before the body is fully
//   received, so oversized uploads are rejected early without buffering the
//   entire payload.
// - fileFilter: rejects non-image MIME types at the stream level.  The
//   controller does a second check against an allowlist because some clients
//   send inaccurate Content-Type headers.
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

// Base path: /api/messages

/**
 * POST /api/messages
 *
 * Send a message to a Minecraft server's linked Discord channel.
 *
 * Content-Type: multipart/form-data
 *
 * Fields:
 * - serverId (string, required) — target Minecraft server ID
 * - content  (string, optional) — text body of the message
 * - image    (file,  optional) — image attachment (png/jpeg/gif/webp, ≤ 10 MB)
 *
 * At least one of `content` or `image` must be provided.
 *
 * Authentication: USER level (verified Discord account required)
 *
 * Response: 201 on success with { messageId, serverId, channelId }
 * Errors:   400 (validation), 401 (not authenticated), 404 (server not monitored)
 */
router.post(
  "/",
  ...route("user", upload.single("image"), MessageController.sendMessage),
);

export default router;
