import { maintenanceService } from "@/services/maintenance";
import type { PlaytimeService } from "./playtime.service";
import type { ActiveSession } from "./types";

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

/** Server config fields a status snapshot is built from. */
export interface ServerStatusConfig {
  name: string;
  slug: string;
  ip: string;
  port: number;
  maxPlayers: number;
}

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

/** Builds a status snapshot from config and an optional PlaytimeService instance. */
export function buildServerStatus(
  id: number,
  serverConfig: ServerStatusConfig,
  service: PlaytimeService | undefined,
): ServerStatus {
  if (!service) {
    return {
      serverId: id,
      serverName: serverConfig.name,
      serverSlug: serverConfig.slug,
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
    serverSlug: serverConfig.slug,
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
