import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getService, Services } from "@/services";
import type {
  MinecraftPlayer,
  ModPlayerJoinData,
  ModPlayerLeaveData,
} from "@/services/playtime";
import { PlaytimeForwarderService } from "@/services/playtime/forwarder.service";
import { getServerByIp } from "@/services/playtime/config";
import config from "@/config";
import type { Request, Response } from "express";

/**
 * Presence Controller
 *
 * Handles Minecraft player join/leave events reported by the presenceAPI mod:
 * - Validates and parses incoming presence payloads
 * - Resolves the originating server by IP or explicit serverId
 * - Delegates session tracking to the appropriate PlaytimeService instance
 */
export class PresenceController {
  /**
   * Records a player join or leave event from a Minecraft server.
   *
   * Resolves the target server from either the `serverId` field in the request
   * body or the verified server IP attached by the middleware. Dispatches to the
   * correct PlaytimeService instance and responds with the echoed event details.
   *
   * @param req - Express request containing presence payload in the body
   * @param res - Express response
   * @returns Promise that resolves when the event has been processed
   */
  static async updatePresence(req: Request, res: Response): Promise<void> {
    const { minecraftUsername, uuid, state, timestamp, serverId } = req.body;

    if (!minecraftUsername || !uuid || !state) {
      throw new BadRequestError(
        "minecraftUsername, uuid, and state are required",
      );
    }

    if (!["joined", "left"].includes(state)) {
      throw new BadRequestError('state must be either "joined" or "left"');
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new BadRequestError("Invalid UUID format");
    }

    // Resolve the target server: explicit serverId in body takes priority,
    // otherwise fall back to the IP that was verified by the middleware
    let targetServerId: number | undefined;

    if (serverId) {
      targetServerId = parseInt(serverId, 10);
      if (isNaN(targetServerId)) {
        throw new BadRequestError("Invalid serverId format");
      }
    } else {
      const serverIp = req.serverIp;
      if (!serverIp) {
        throw new InternalServerError(
          "Server IP not detected - IP verification middleware may not be properly configured",
        );
      }

      const serverInfo = getServerByIp(serverIp);
      if (!serverInfo) {
        logger.warn(`Unknown server IP: ${serverIp}`);
        throw new BadRequestError(
          `Server IP ${serverIp} is not configured. Please contact an administrator`,
        );
      }

      targetServerId = serverInfo.serverId;
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
      const eventTimestamp = timestamp ? new Date(timestamp) : new Date();

      if (state === "joined") {
        const joinData: ModPlayerJoinData = {
          uuid,
          username: minecraftUsername,
          timestamp: eventTimestamp,
        };

        await playtimeService.handlePlayerJoinFromMod(joinData);

        logger.info(
          `Player ${minecraftUsername} (${uuid}) joined server ${targetServerId}`,
        );
      } else if (state === "left") {
        const { dimension, position } = req.body;

        const leaveData: ModPlayerLeaveData = {
          uuid,
          username: minecraftUsername,
          timestamp: eventTimestamp,
          dimension,
          position,
        };

        await playtimeService.handlePlayerLeaveFromMod(leaveData);

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

  /**
   * Receives a heartbeat from the mod containing the full online player list.
   * Reconciles tracked sessions against reality to clean up stale sessions.
   *
   * @param req - Express request with heartbeat payload
   * @param res - Express response
   */
  static async heartbeat(req: Request, res: Response): Promise<void> {
    const { players, serverId } = req.body;

    if (!Array.isArray(players)) {
      throw new BadRequestError("players must be an array");
    }

    // Validate each player entry
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const onlinePlayers: MinecraftPlayer[] = [];
    for (const p of players) {
      if (!p.uuid || !p.username) continue;
      if (!uuidRegex.test(p.uuid)) continue;
      onlinePlayers.push({ uuid: p.uuid, username: p.username });
    }

    // Resolve target server
    let targetServerId: number | undefined;

    if (serverId) {
      targetServerId = parseInt(serverId, 10);
      if (isNaN(targetServerId)) {
        throw new BadRequestError("Invalid serverId format");
      }
    } else {
      const serverIp = req.serverIp;
      if (!serverIp) {
        throw new InternalServerError(
          "Server IP not detected - IP verification middleware may not be properly configured",
        );
      }

      const serverInfo = getServerByIp(serverIp);
      if (!serverInfo) {
        logger.warn(`Heartbeat from unknown server IP: ${serverIp}`);
        throw new BadRequestError(
          `Server IP ${serverIp} is not configured. Please contact an administrator`,
        );
      }

      targetServerId = serverInfo.serverId;
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

      playtimeService.reconcileWithHeartbeat(onlinePlayers);

      // Forward heartbeat to production if sync is configured
      if (config.sync.targetUrl && config.sync.secret) {
        const forwarder = new PlaytimeForwarderService(
          config.sync.targetUrl,
          config.sync.secret,
        );
        void forwarder.forwardHeartbeat(onlinePlayers);
      }

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
