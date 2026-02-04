import { Request, Response } from "express";
import { BadRequestError, NotFoundError } from "@/app/middleware";
import { MINECRAFT_SERVERS, getServerById } from "@/services/playtime/config";
import {
  GetAllServersResponse,
  GetServerResponse,
  PlayerInfo,
  ServerStatus,
} from "@createrington/shared/api";
import { ActiveSession, PlaytimeManagerService } from "@/services/playtime";
import { getService, Services } from "@/services";

/**
 * Server controller
 *
 * Handles server status and player information endpoints
 */
export class ServerController {
  /**
   * GET /api/servers
   *
   * Returns status information for all configured servers
   * Includes online/offline status, player counts, and active player lists
   */
  static async getAllServers(req: Request, res: Response): Promise<void> {
    const servers: ServerStatus[] = [];
    let totalPlayers = 0;
    let onlineServers = 0;

    // Iterate through all configured servers
    for (const [serverId, serverConfig] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId, 10);

      // Get the playtime service for this server
      const manager = await getService<PlaytimeManagerService>(
        Services.PLAYTIME_MANAGER_SERVICE,
      );

      const service = manager.getService(id);

      let status: ServerStatus;

      if (!service) {
        // Service not initialized for this server
        status = {
          serverId: id,
          serverName: serverConfig.name,
          ip: serverConfig.ip,
          port: serverConfig.port,
          maxPlayers: serverConfig.maxPlayers,
          status: "unknown",
          playerCount: 0,
          players: [],
          lastChecked: new Date().toISOString(),
        };
      } else {
        // Get active sessions from the service
        const activeSessions = service.getActiveSessions();
        const isOnline = service.getStatus().isInitialized;

        // Map active sessions to player info
        const players: PlayerInfo[] = activeSessions.map((session) =>
          ServerController.mapSessionToPlayerInfo(session, service),
        );

        status = {
          serverId: id,
          serverName: serverConfig.name,
          ip: serverConfig.ip,
          port: serverConfig.port,
          maxPlayers: serverConfig.maxPlayers,
          status: isOnline ? "online" : "offline",
          playerCount: players.length,
          players,
          lastChecked: new Date().toISOString(),
        };

        if (isOnline) {
          onlineServers++;
        }
        totalPlayers += players.length;
      }

      servers.push(status);
    }

    // Sort servers by ID for consistent ordering
    servers.sort((a, b) => a.serverId - b.serverId);

    const response: GetAllServersResponse = {
      success: true,
      data: {
        servers,
        totalServers: servers.length,
        onlineServers,
        totalPlayers,
      },
    };

    res.json(response);
  }

  /**
   * GET /api/servers/:id
   *
   * Returns status information for a specific server
   * Includes detailed player information and session data
   */
  static async getServer(req: Request, res: Response): Promise<void> {
    const idParam = req.params.id;

    if (Array.isArray(idParam)) {
      throw new BadRequestError("Invalid server ID");
    }

    const serverId = parseInt(idParam, 10);

    if (isNaN(serverId)) {
      throw new BadRequestError("Invalid server ID format");
    }

    // Check if server exists in configuration
    const serverConfig = getServerById(serverId);
    if (!serverConfig) {
      throw new NotFoundError(`Server with ID ${serverId} not found`);
    }

    // Get the playtime service for this server
    const manager = await getService<PlaytimeManagerService>(
      Services.PLAYTIME_MANAGER_SERVICE,
    );

    const service = manager.getService(serverId);

    let status: ServerStatus;

    if (!service) {
      // Service not initialized for this server
      status = {
        serverId,
        serverName: serverConfig.name,
        ip: serverConfig.ip,
        port: serverConfig.port,
        maxPlayers: serverConfig.maxPlayers,
        status: "unknown",
        playerCount: 0,
        players: [],
        lastChecked: new Date().toISOString(),
      };
    } else {
      // Get active sessions from the service
      const activeSessions = service.getActiveSessions();
      const isOnline = service.getStatus().isInitialized;

      // Map active sessions to player info with detailed metadata
      const players: PlayerInfo[] = activeSessions.map((session) =>
        ServerController.mapSessionToPlayerInfo(session, service),
      );

      status = {
        serverId,
        serverName: serverConfig.name,
        ip: serverConfig.ip,
        port: serverConfig.port,
        maxPlayers: serverConfig.maxPlayers,
        status: isOnline ? "online" : "offline",
        playerCount: players.length,
        players,
        lastChecked: new Date().toISOString(),
      };
    }

    const response: GetServerResponse = {
      success: true,
      data: {
        server: status,
      },
    };

    res.json(response);
  }

  /**
   * Helper method to map ActiveSession to PlayerInfo
   * Calculates session duration and includes metadata
   *
   * @param session - Active session from playtime service
   * @param service - Playtime service instance for duration calculation
   * @returns PlayerInfo object
   */
  private static mapSessionToPlayerInfo(
    session: ActiveSession,
    service: any,
  ): PlayerInfo {
    const sessionDuration = service.getSessionDuration(session) || 0;

    return {
      uuid: session.uuid,
      username: session.username,
      sessionStart: session.sessionStart.toISOString(),
      secondsPlayed: sessionDuration,
      metadata: session.metadata
        ? {
            displayName: session.metadata.displayName,
            gamemode: session.metadata.gamemode,
            dimension: session.metadata.dimension,
            position: session.metadata.position,
            health: session.metadata.health,
            experienceLevel: session.metadata.experienceLevel,
            ipAddress: session.metadata.ipAddress,
          }
        : undefined,
    };
  }
}
