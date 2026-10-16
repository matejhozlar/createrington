import { Router } from "express";
import { KNOWN_POSES, type KnownPose } from "createrington-skin-api";
import type { Request, Response } from "express";
import {
  BadRequestError,
  NotFoundError,
  route,
  skinPoseLimiter,
} from "@/app/middleware";
import { Q } from "@/db";
import { poseRenderService } from "@/services/skin-api/pose-render.service";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";

const KNOWN_POSE_SET: ReadonlySet<string> = new Set(KNOWN_POSES);
const POSE_CACHE_SECONDS = 24 * 60 * 60;
const MC_HEADS_BODY_URL = "https://mc-heads.net/body";

const router = Router();

/**
 * Skin routes
 * Base path: /api/skin
 *
 * Serves posed figures of registered players, rendered through the skin API.
 */

// GET /api/skin/:uuid/pose/:pose - Posed figure of a registered player
router.get(
  "/:uuid/pose/:pose",
  skinPoseLimiter,
  ...route("public", async (req: Request, res: Response) => {
    const uuid = (req.params.uuid as string).toLowerCase();
    const pose = req.params.pose as string;

    if (!MC_UUID_REGEX.test(uuid)) {
      throw new BadRequestError("Invalid UUID format");
    }
    if (!KNOWN_POSE_SET.has(pose)) {
      throw new BadRequestError("Unknown pose");
    }
    if (!(await Q.player.find({ minecraftUuid: uuid }))) {
      throw new NotFoundError("Player not found");
    }

    try {
      const png = await poseRenderService.render(uuid, pose as KnownPose);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", `public, max-age=${POSE_CACHE_SECONDS}`);
      res.send(png);
    } catch (error) {
      logger.warn(
        `Posed skin render failed (uuid=${uuid} pose=${pose}):`,
        error,
      );
      res.redirect(302, `${MC_HEADS_BODY_URL}/${uuid}/600`);
    }
  }),
);

export default router;
