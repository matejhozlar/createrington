import { router, publicProcedure } from "@/trpc/trpc";
import { getService, Services } from "@/services";
import { PlaytimeService, type ActiveSession } from "@/services/playtime";
import { maintenanceService } from "@/services/maintenance";
import { getServerById, MINECRAFT_SERVERS } from "@/services/playtime/config";
import { z } from "zod";
import { trpcError } from "@/trpc/utils";

/** Basic player information included in server status responses. */
export interface PlayerInfo {
  uuid: string;
  username: string;
  sessionStart: Date;
  secondsPlayed: number;
  metadata?: {
    displayName?: string;
    gamemode?: string;
    dimension?: string;
    experienceLevel?: number;
  };
}

/** Server status with connection info, online state, and current player list. */
export interface ServerStatus {
  serverId: number;
  serverName: string;
  serverSlug: string;
  ip: string;
  port: number;
  maxPlayers: number;
  status: "online" | "offline" | "unknown";
  maintenance: boolean;
  playerCount: number;
  players: PlayerInfo[];
  lastChecked: Date;
}

/** @private Maps an active playtime session to the public PlayerInfo shape. */
function mapSessionToPlayerInfo(
  session: ActiveSession,
  service: PlaytimeService,
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
          experienceLevel: session.metadata.experienceLevel,
        }
      : undefined,
  };
}

/** Builds a ServerStatus object from config and an optional PlaytimeService instance. */
export function buildServerStatus(
  id: number,
  serverConfig: {
    name: string;
    identifier: string;
    ip: string;
    port: number;
    maxPlayers: number;
  },
  service: PlaytimeService | undefined,
): ServerStatus {
  if (!service) {
    return {
      serverId: id,
      serverName: serverConfig.name,
      serverSlug: serverConfig.identifier,
      ip: serverConfig.ip,
      port: serverConfig.port,
      maxPlayers: serverConfig.maxPlayers,
      status: "unknown",
      maintenance: maintenanceService.isInMaintenance(id),
      playerCount: 0,
      players: [],
      lastChecked: new Date(),
    };
  }

  const activeSessions = service.getActiveSessions();
  const isOnline = service.getStatus().isInitialized;

  const players: PlayerInfo[] = activeSessions.map((session: ActiveSession) =>
    mapSessionToPlayerInfo(session, service),
  );

  return {
    serverId: id,
    serverName: serverConfig.name,
    serverSlug: serverConfig.identifier,
    ip: serverConfig.ip,
    port: serverConfig.port,
    maxPlayers: serverConfig.maxPlayers,
    status: isOnline ? "online" : "offline",
    maintenance: maintenanceService.isInMaintenance(id),
    playerCount: players.length,
    players,
    lastChecked: new Date(),
  };
}

/** Public servers router: server list with status and individual server lookup. */
export const serversRouter = router({
  list: publicProcedure
    .meta({
      description:
        "Returns all Minecraft servers with their current status, online player list, and a summary of total/online counts. Used on the home page and server list",
    })
    .query(async () => {
      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const servers: ServerStatus[] = [];
      let totalPlayers = 0;
      let onlineServers = 0;

      for (const [serverId, serverConfig] of Object.entries(
        MINECRAFT_SERVERS,
      )) {
        const id = parseInt(serverId, 10);
        const service = manager.getService(id);
        const status = buildServerStatus(id, serverConfig, service);

        if (status.status === "online") {
          onlineServers++;
        }
        totalPlayers += status.playerCount;

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
        "Returns a single Minecraft server's status, player list, and connection info by server ID. Throws BAD_REQUEST if the server ID doesn't exist in config",
    })
    .input(
      z.object({
        id: z.coerce.number().int().positive().min(1, "Server ID is required"),
      }),
    )
    .query(async ({ input }) => {
      const serverConfig = getServerById(input.id);
      if (!serverConfig) {
        throw trpcError.badRequest(`Server with id ${input.id} not found`);
      }

      const manager = await getService(Services.PLAYTIME_MANAGER_SERVICE);

      const service = manager.getService(input.id);
      const status = buildServerStatus(input.id, serverConfig, service);

      return { server: status };
    }),
});
