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

/** Matches a Minecraft UUID (with/without dashes) or a valid username (3-16 alphanumeric/underscore) */
const MC_IDENTIFIER_RE =
  /^([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|[a-zA-Z0-9_]{3,16})$/;

/** External skin APIs tried in order until one succeeds */
const SKIN_SOURCES = [
  (uuid: string) => `https://crafatar.com/skins/${uuid}`,
  (uuid: string) => `https://mc-heads.net/skin/${uuid}`,
];

/**
 * Skin proxy routes
 * Base path: /api/skin
 *
 * Proxies Minecraft skin requests through the server to avoid
 * CORS issues with external skin APIs.
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

// GET /api/skin/:uuid - Fetch a player skin by Minecraft UUID
router.get(
  "/:uuid",
  ...route("public", async (req: Request, res: Response) => {
    const uuid = req.params.uuid as string;

    if (!MC_IDENTIFIER_RE.test(uuid)) {
      throw new BadRequestError("Invalid UUID format");
    }

    for (const buildUrl of SKIN_SOURCES) {
      try {
        const response = await fetch(buildUrl(uuid), {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.send(buffer);
          return;
        }
      } catch {
        // Try next source
      }
    }

    res.status(404).json({ error: "Skin not found" });
  }),
);

export default router;
