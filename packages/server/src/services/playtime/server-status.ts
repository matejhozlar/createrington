import { maintenanceService } from "@/services/maintenance";
import type { PlaytimeService } from "./playtime.service";
import { ServerState, type ActiveSession } from "./types";

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

/** Online state, maintenance flag and player count of a server, without the player list. */
export interface ServerStatusSummary {
  serverId: number;
  serverName: string;
  serverSlug: string;
  maxPlayers: number;
  status: "online" | "offline" | "unknown";
  maintenance: boolean;
  playerCount: number;
}

/** Server status with connection info, online state, and current player list. */
export interface ServerStatus extends ServerStatusSummary {
  ip: string;
  port: number;
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

const STATE_TO_STATUS: Record<ServerState, ServerStatusSummary["status"]> = {
  [ServerState.ONLINE]: "online",
  [ServerState.OFFLINE]: "offline",
  [ServerState.UNKNOWN]: "unknown",
};

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

/**
 * Builds the player-list-free status summary. `status` mirrors the tracked
 * ServerState (relay messages, heartbeats, join events); `playerCount` is the
 * number of tracked sessions and may lag `status` for a few seconds while a
 * transition settles. A missing service reports "unknown" with zero players.
 */
export function buildServerStatusSummary(
  id: number,
  serverConfig: ServerStatusConfig,
  service: PlaytimeService | undefined,
): ServerStatusSummary {
  return {
    serverId: id,
    serverName: serverConfig.name,
    serverSlug: serverConfig.slug,
    maxPlayers: serverConfig.maxPlayers,
    status: service ? STATE_TO_STATUS[service.getServerState()] : "unknown",
    maintenance: maintenanceService.isInMaintenance(id),
    playerCount: service ? service.getStatus().activeSessions : 0,
  };
}

/** Builds the full status snapshot: the summary plus connection info and the current player list. */
export function buildServerStatus(
  id: number,
  serverConfig: ServerStatusConfig,
  service: PlaytimeService | undefined,
): ServerStatus {
  const players: PlayerInfo[] = service
    ? service
        .getActiveSessions()
        .map((session) => mapSessionToPlayerInfo(session, service))
    : [];

  return {
    ...buildServerStatusSummary(id, serverConfig, service),
    ip: serverConfig.ip,
    port: serverConfig.port,
    players,
    lastChecked: new Date(),
  };
}
