import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../../trpc";
import { getService, Services } from "@/services";
import {
  PlaytimeManagerService,
  type ActiveSession,
} from "@/services/playtime";
import { getServerById, MINECRAFT_SERVERS } from "@/services/playtime/config";
import { z } from "zod";

/**
 * Basic player information for server status
 */
export interface PlayerInfo {
  uuid: string;
  username: string;
  sessionStart: Date;
  secondsPlayed: number;
  metadata?: {
    displayName?: string;
    gamemode?: string;
    dimension?: string;
    position?: {
      x: number;
      y: number;
      z: number;
    };
    health?: number;
    experienceLevel?: number;
    ipAddress?: string;
  };
}

/**
 * Server status information
 */
export interface ServerStatus {
  serverId: number;
  serverName: string;
  ip: string;
  port: number;
  maxPlayers: number;
  status: "online" | "offline" | "unknown";
  playerCount: number;
  players: PlayerInfo[];
  lastChecked: Date;
}

function mapSessionToPlayerInfo(
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

export const serversRouter = router({
  getAll: publicProcedure
    .meta({
      description:
        "Returns all Minecraft servers with their current status, online player list, and a summary of total/online counts. Used on the home page and server list.",
    })
    .query(async () => {
      const servers: ServerStatus[] = [];
      let totalPlayers = 0;
      let onlineServers = 0;

      for (const [serverId, serverConfig] of Object.entries(
        MINECRAFT_SERVERS,
      )) {
        const id = parseInt(serverId, 10);

        const manager = await getService<PlaytimeManagerService>(
          Services.PLAYTIME_MANAGER_SERVICE,
        );

        const service = manager.getService(id);

        let status: ServerStatus;

        if (!service) {
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

          const players: PlayerInfo[] = activeSessions.map(
            (session: ActiveSession) =>
              mapSessionToPlayerInfo(session, service),
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

        servers.push(status);
      }

      servers.sort((a, b) => a.serverId - b.serverId);

      return {
        servers,
        summary: {
          totalServers: servers.length,
          onlineServers,
          totalPlayers,
        },
      };
    }),

  get: publicProcedure
    .meta({
      description:
        "Returns a single Minecraft server's status, player list, and connection info by server ID. Throws BAD_REQUEST if the server ID doesn't exist in config.",
    })
    .input(
      z.object({
        id: z.coerce.number().int().positive().min(1, "Server ID is required"),
      }),
    )
    .query(async ({ input }) => {
      const serverConfig = getServerById(input.id);
      if (!serverConfig) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Server with id ${input.id} not found`,
        });
      }

      const manager = await getService<PlaytimeManagerService>(
        Services.PLAYTIME_MANAGER_SERVICE,
      );

      const service = manager.getService(input.id);

      let status: ServerStatus;

      if (!service) {
        status = {
          serverId: input.id,
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

        const players: PlayerInfo[] = activeSessions.map(
          (session: ActiveSession) => mapSessionToPlayerInfo(session, service),
        );

        status = {
          serverId: input.id,
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

      return { server: status };
    }),
});
