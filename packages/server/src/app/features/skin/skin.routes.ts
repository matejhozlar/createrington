import { Router } from "express";
import { z } from "zod";
import { KNOWN_POSES, type KnownPose } from "createrington-skin-api";
import type { Request, Response } from "express";
import { route } from "@/app/middleware/compose";
import { BadRequestError, NotFoundError } from "@/app/middleware/error-handler";
import { skinPoseLimiter } from "@/app/middleware/rate-limit.middleware";
import { Q } from "@/db";
import {
  AVATAR_DEFAULT_SIZE,
  AVATAR_MAX_SIZE,
  AVATAR_MIN_SIZE,
  avatarService,
} from "@/services/skin-api/avatar.service";
import { poseRenderService } from "@/services/skin-api/pose-render.service";
import { mcHeadsAvatarUrl, mcHeadsBodyUrl } from "@/services/skin-api/urls";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";

const KNOWN_POSE_SET: ReadonlySet<string> = new Set(KNOWN_POSES);
const IMAGE_CACHE_SECONDS = 24 * 60 * 60;
const IMAGE_CACHE_CONTROL = `public, max-age=${IMAGE_CACHE_SECONDS}, stale-while-revalidate=${IMAGE_CACHE_SECONDS}`;

const avatarSizeSchema = z.coerce
  .number()
  .int()
  .min(AVATAR_MIN_SIZE)
  .max(AVATAR_MAX_SIZE)
  .optional();

const router = Router();

/**
 * Skin routes
 * Base path: /api/skin
 *
 * Serves heads and posed figures of registered players, rendered through the
 * skin API.
 */

async function registeredUuid(req: Request): Promise<string> {
  const uuid = (req.params.uuid as string).toLowerCase();
  if (!MC_UUID_REGEX.test(uuid)) {
    throw new BadRequestError("Invalid UUID format");
  }
  if (!(await Q.player.find({ minecraftUuid: uuid }))) {
    throw new NotFoundError("Player not found");
  }
  return uuid;
}

// GET /api/skin/:uuid/avatar?size= - Flat 2D head of a registered player
router.get(
  "/:uuid/avatar",
  ...route("public", async (req: Request, res: Response) => {
    const uuid = await registeredUuid(req);
    const parsedSize = avatarSizeSchema.safeParse(req.query.size);
    if (!parsedSize.success) {
      throw new BadRequestError(
        `size must be an integer between ${AVATAR_MIN_SIZE} and ${AVATAR_MAX_SIZE}`,
      );
    }
    const size = parsedSize.data ?? AVATAR_DEFAULT_SIZE;

    try {
      const { png, etag } = await avatarService.get(uuid, size);
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", IMAGE_CACHE_CONTROL);
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.send(png);
    } catch (error) {
      logger.warn(`Avatar fetch failed (uuid=${uuid} size=${size}):`, error);
      res.redirect(302, mcHeadsAvatarUrl(uuid, size));
    }
  }),
);

// GET /api/skin/:uuid/pose/:pose - Posed figure of a registered player
router.get(
  "/:uuid/pose/:pose",
  skinPoseLimiter,
  ...route("public", async (req: Request, res: Response) => {
    const pose = req.params.pose as string;
    if (!KNOWN_POSE_SET.has(pose)) {
      throw new BadRequestError("Unknown pose");
    }
    const uuid = await registeredUuid(req);

    try {
      const png = await poseRenderService.render(uuid, pose as KnownPose);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", IMAGE_CACHE_CONTROL);
      res.send(png);
    } catch (error) {
      logger.warn(
        `Posed skin render failed (uuid=${uuid} pose=${pose}):`,
        error,
      );
      res.redirect(302, mcHeadsBodyUrl(uuid));
    }
  }),
);

export default router;
