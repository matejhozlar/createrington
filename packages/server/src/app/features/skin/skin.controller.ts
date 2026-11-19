import type { Request, Response } from "express";
import { getValidated } from "@/app/middleware/validation.middleware";
import { BadRequestError, NotFoundError } from "@/errors";
import { idToObject } from "@/utils/player-identifier";
import { Q } from "@/db";
import { avatarService } from "@/services/skin-api/avatar.service";
import { poseRenderService } from "@/services/skin-api/pose-render.service";
import { mcHeadsAvatarUrl, mcHeadsBodyUrl } from "@/services/skin-api/urls";
import { MC_UUID_REGEX } from "@/utils/zod-schemas";
import type { AvatarParams, AvatarQuery, PoseParams } from "./skin.schemas";

const IMAGE_CACHE_SECONDS = 24 * 60 * 60;
const IMAGE_CACHE_CONTROL = `public, max-age=${IMAGE_CACHE_SECONDS}, stale-while-revalidate=${IMAGE_CACHE_SECONDS}`;

async function registeredUuid(id: string): Promise<string> {
  const identifier = idToObject(MC_UUID_REGEX.test(id) ? id.toLowerCase() : id);
  if (!identifier || "discordId" in identifier) {
    throw new BadRequestError("Expected a Minecraft UUID or username");
  }
  const player = await Q.player.find(identifier);
  if (!player) {
    throw new NotFoundError("Player not found");
  }
  return player.minecraftUuid;
}

export class SkinController {
  static async avatar(req: Request, res: Response): Promise<void> {
    const { params, query } = getValidated<{
      params: AvatarParams;
      query: AvatarQuery;
    }>(res);
    const uuid = await registeredUuid(params.player);
    const { size } = query;

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
  }

  static async pose(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: PoseParams }>(res);
    const uuid = await registeredUuid(params.player);

    try {
      const png = await poseRenderService.render(uuid, params.pose);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", IMAGE_CACHE_CONTROL);
      res.send(png);
    } catch (error) {
      logger.warn(
        `Posed skin render failed (uuid=${uuid} pose=${params.pose}):`,
        error,
      );
      res.redirect(302, mcHeadsBodyUrl(uuid));
    }
  }
}
