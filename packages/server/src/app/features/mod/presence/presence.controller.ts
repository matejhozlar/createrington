import { getValidated } from "@/app/middleware";
import { BadRequestError, ForbiddenError, InternalServerError } from "@/errors";
import { getService, Services } from "@/services";
import type {
  HeartbeatPlayer,
  ModPlayerJoinData,
  ModPlayerLeaveData,
} from "@/services/playtime";
import { parseEventTimestamp } from "@/services/playtime/credit";
import { getPlaytimeForwarder } from "@/services/playtime/forwarder.service";
import { resolveServerId } from "../shared/resolve-server-id";
import type { Request, Response } from "express";
import type { HeartbeatBody, PresenceBody } from "./presence.schemas";

export class PresenceController {
  static async updatePresence(req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: PresenceBody }>(res);
    const { minecraftUsername, uuid, state, timestamp, playTimeTicks } = body;

    const tokenUuid = req.modAuth?.uuid;
    if (tokenUuid && tokenUuid.toLowerCase() !== uuid.toLowerCase()) {
      logger.warn(
        `Presence update rejected: token player ${tokenUuid} does not match reported player ${uuid}`,
      );
      throw new ForbiddenError("Token player does not match reported player");
    }

    const targetServerId = resolveServerId(req, "Presence update");
    const eventTimestamp = parseEventTimestamp(timestamp);
    if (!eventTimestamp) {
      throw new BadRequestError("Invalid timestamp");
    }

    try {
      const playtimeManager = await getService(
        Services.PLAYTIME_MANAGER_SERVICE,
      );

      const playtimeService = playtimeManager.getService(targetServerId);

      if (!playtimeService) {
        throw new InternalServerError(
          `Playtime tracking not configured for server ${targetServerId}`,
        );
      }
      if (state === "joined") {
        const joinData: ModPlayerJoinData = {
          uuid,
          username: minecraftUsername,
          timestamp: eventTimestamp,
          playTimeTicks,
        };

        playtimeService.handlePlayerJoinFromMod(joinData);

        logger.info(
          `Player ${minecraftUsername} (${uuid}) joined server ${targetServerId}`,
        );
      } else if (state === "left") {
        const leaveData: ModPlayerLeaveData = {
          uuid,
          username: minecraftUsername,
          timestamp: eventTimestamp,
          playTimeTicks,
          dimension: body.dimension,
          position: body.position,
        };

        playtimeService.handlePlayerLeaveFromMod(leaveData);

        logger.info(
          `Player ${minecraftUsername} (${uuid}) left server ${targetServerId}`,
        );
      }

      res.json({
        success: true,
        message: "Presence updated successfully",
        data: {
          minecraftUsername,
          uuid,
          state,
          serverId: targetServerId,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Failed to process presence update:", error);
      throw new InternalServerError(
        "Failed to process presence update. Please try again.",
      );
    }
  }

  static async heartbeat(req: Request, res: Response): Promise<void> {
    if (req.modAuth?.uuid) {
      logger.warn(
        `Heartbeat rejected: per-player token (${req.modAuth.uuid}) used on a server-level endpoint`,
      );
      throw new ForbiddenError("Heartbeat requires a server-level token");
    }

    const {
      body: { players },
    } = getValidated<{ body: HeartbeatBody }>(res);
    const onlinePlayers: HeartbeatPlayer[] = players
      .filter((p) => p !== null)
      .map((p) => ({
        uuid: p.uuid,
        username: p.minecraftUsername,
        playTimeTicks: p.playTimeTicks,
      }));

    const targetServerId = resolveServerId(req, "Heartbeat");

    try {
      const playtimeManager = await getService(
        Services.PLAYTIME_MANAGER_SERVICE,
      );

      const playtimeService = playtimeManager.getService(targetServerId);

      if (!playtimeService) {
        throw new InternalServerError(
          `Playtime tracking not configured for server ${targetServerId}`,
        );
      }

      playtimeService.reconcileWithHeartbeat(onlinePlayers);

      void getPlaytimeForwarder()?.forwardHeartbeat(onlinePlayers);

      logger.info(
        `Heartbeat received for server ${targetServerId}: ${onlinePlayers.length} player(s) online`,
      );

      res.json({
        success: true,
        message: "Heartbeat processed",
        data: {
          serverId: targetServerId,
          playersReported: onlinePlayers.length,
          receivedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Failed to process heartbeat:", error);
      throw new InternalServerError(
        "Failed to process heartbeat. Please try again.",
      );
    }
  }
}
