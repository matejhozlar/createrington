import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getService, Services } from "@/services";
import {
  ModPlayerJoinData,
  ModPlayerLeaveData,
  PlaytimeManagerService,
} from "@/services/playtime";
import { getServerByIp } from "@/services/playtime/config";
import { Request, Response } from "express";

/**
 * Presence Controller
 *
 * Handles Minecraft player presence updates from presenceAPI
 * Integrates with playtime service to track player sessions
 */
export class PresenceController {
  /**
   * POST /api/presence
   * Body: { minecraftUsername: string, uuid: string, state: "joined" | "left", timestamp: number, serverId?: string }
   *
   * Receives player presence data from Minecraft server
   * Requires mod JWT authentication and IP verification
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
      const playtimeManager = await getService<PlaytimeManagerService>(
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
        const leaveData: ModPlayerLeaveData = {
          uuid,
          username: minecraftUsername,
          timestamp: eventTimestamp,
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
}
