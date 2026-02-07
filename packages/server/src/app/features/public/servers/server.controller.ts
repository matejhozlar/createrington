import {
  BadRequestError,
  buildResponse,
  getValidated,
  TypedResponse,
} from "@/app/middleware";
import { getService, Services } from "@/services";
import {
  PlaytimeManagerService,
  type ActiveSession,
} from "@/services/playtime";
import { getServerById, MINECRAFT_SERVERS } from "@/services/playtime/config";
import {
  type ServerStatus,
  type PlayerInfo,
  type GetServersResponse,
  type GetServerParams,
  type GetServerResponse,
} from "@createrington/shared/api/public/servers";
import type { Request, Response } from "express";

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
  static async getAll(req: Request, res: Response): Promise<void> {
    const servers: ServerStatus[] = [];
    let totalPlayers = 0;
    let onlineServers = 0;

    for (const [serverId, serverConfig] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId, 10);

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
          lastChecked: new Date(),
        };
      } else {
        const activeSessions = service.getActiveSessions();
        const isOnline = service.getStatus().isInitialized;

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
          lastChecked: new Date(),
        };

        if (isOnline) {
          onlineServers++;
        }
        totalPlayers += players.length;
      }

      servers.sort((a, b) => a.serverId - b.serverId);

      const response = buildResponse<GetServersResponse>({
        success: true,
        data: {
          servers,
          summary: {
            totalServers: servers.length,
            onlineServers,
            totalPlayers,
          },
        },
      });

      return TypedResponse.ok<GetServersResponse>(res, response);
    }
  }

  /**
   * GET /api/servers/:id
   *
   * Returns status information for a specific server
   * Includes detailed player information and session data
   */
  static async get(req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{
      params: GetServerParams;
    }>(res);

    const serverConfig = getServerById(params.id);
    if (!serverConfig) {
      throw new BadRequestError(`Server with id ${params.id} not found`);
    }

    const manager = await getService<PlaytimeManagerService>(
      Services.PLAYTIME_MANAGER_SERVICE,
    );

    const service = manager.getService(params.id);

    let status: ServerStatus;

    if (!service) {
      status = {
        serverId: params.id,
        serverName: serverConfig.name,
        ip: serverConfig.ip,
        port: serverConfig.port,
        maxPlayers: serverConfig.maxPlayers,
        status: "unknown",
        playerCount: 0,
        players: [],
        lastChecked: new Date(),
      };
    } else {
      const activeSessions = service.getActiveSessions();
      const isOnline = service.getStatus().isInitialized;

      const players: PlayerInfo[] = activeSessions.map((session) =>
        ServerController.mapSessionToPlayerInfo(session, service),
      );

      status = {
        serverId: params.id,
        serverName: serverConfig.name,
        ip: serverConfig.ip,
        port: serverConfig.port,
        maxPlayers: serverConfig.maxPlayers,
        status: isOnline ? "online" : "offline",
        playerCount: players.length,
        players,
        lastChecked: new Date(),
      };
    }

    const response = buildResponse<GetServerResponse>({
      success: true,
      data: {
        server: status,
      },
    });

    return TypedResponse.ok<GetServerResponse>(res, response);
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
      sessionStart: session.sessionStart,
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
