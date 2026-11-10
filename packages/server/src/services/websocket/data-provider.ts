import type { MessageCacheService } from "../discord/message/cache";
import type { PlaytimeManagerService } from "../playtime/playtime-manager.service";
import { maintenanceService } from "../maintenance";
import { MINECRAFT_SERVERS } from "../playtime/config";
import type {
  InitialDataPayload,
  PlayerData,
  ServerInitialDataPayload,
  ServerStatus,
} from "./types";
import type { CachedMessage } from "../discord/message/cache";

/**
 * WebSocket Data Provider
 *
 * Aggregates current runtime state for WebSocket transmission:
 * - Server status (online/offline, player count) for all or a single server
 * - Active player lists from PlaytimeManagerService sessions
 * - Recent message history from MessageCacheService
 * - Combined initial-data payloads for newly connected clients
 */
export class WebSocketDataProvider {
  constructor(
    private messageCacheService: MessageCacheService,
    private playtimeManagerService: PlaytimeManagerService,
  ) {}

  /**
   * Get current status for all servers
   */
  getAllServerStatuses(): ServerStatus[] {
    const statuses: ServerStatus[] = [];

    for (const [serverId, _config] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId);
      const status = this.getServerStatus(id);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get current status for a specific server
   *
   * @param serverId - Server ID
   */
  getServerStatus(serverId: number): ServerStatus {
    const config = MINECRAFT_SERVERS[serverId];
    if (!config) {
      throw new Error(`Server ${serverId} not found`);
    }

    const playtimeService = this.playtimeManagerService.getService(serverId);
    const activeSessions = playtimeService?.getActiveSessions() ?? [];

    const isOnline = playtimeService?.isOnline() ?? false;

    const schedule = maintenanceService.getScheduledMaintenance(serverId);

    return {
      serverId,
      serverName: config.name,
      serverSlug: config.slug,
      online: isOnline,
      maintenance: maintenanceService.isInMaintenance(serverId),
      scheduledMaintenance: schedule
        ? {
            id: schedule.id,
            scheduledAt: schedule.scheduledAt.toISOString(),
            estimatedMinutes: schedule.estimatedMinutes,
            status: schedule.status as "scheduled" | "active",
          }
        : null,
      playerCount: activeSessions.length,
      maxPlayers: config.maxPlayers,
      lastUpdate: new Date(),
    };
  }

  /**
   * Get all online players across all servers
   */
  getAllPlayers(): PlayerData[] {
    const players: PlayerData[] = [];

    for (const [serverId] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId);
      const serverPlayers = this.getServerPlayers(id);
      players.push(...serverPlayers);
    }

    return players;
  }

  /**
   * Get online players for a specific server
   *
   * @param serverId - Server ID
   */
  getServerPlayers(serverId: number): PlayerData[] {
    const playtimeService = this.playtimeManagerService.getService(serverId);

    if (!playtimeService) {
      return [];
    }

    const activeSessions = playtimeService.getActiveSessions();

    return activeSessions.map((session) => ({
      uuid: session.uuid,
      username: session.username,
      serverId: session.serverId,
      sessionStart: session.sessionStart,
      sessionDuration: playtimeService.getSessionDuration(session) || 0,
    }));
  }

  /**
   * Get recent messages for all servers
   *
   * @param limit - Maximum messages per server
   */
  getAllMessages(limit: number = 50): Record<number, CachedMessage[]> {
    const messages: Record<number, CachedMessage[]> = {};

    for (const [serverId] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId);
      const serverMessages = this.getServerMessages(id, limit);
      messages[id] = serverMessages;
    }

    return messages;
  }

  /**
   * Get recent messages for a specific server
   *
   * @param serverId - Server ID
   * @param limit - Maximum messages to return
   */
  getServerMessages(serverId: number, limit: number = 50): CachedMessage[] {
    return this.messageCacheService.getRecentMessages(serverId, limit);
  }

  /**
   * Get complete initial data for all servers
   *
   * @param includeMessages - Whether to include message history
   * @param messageLimit - Maximum messages per server
   */
  getInitialData(
    includeMessages: boolean = true,
    messageLimit: number = 50,
  ): InitialDataPayload {
    const servers = this.getAllServerStatuses();
    const players = this.getAllPlayers();
    const messages = includeMessages ? this.getAllMessages(messageLimit) : {};

    return {
      servers,
      players,
      messages,
      timestamp: new Date(),
    };
  }

  /**
   * Get initial data for a specific server
   *
   * @param serverId - Server ID
   * @param includeMessages - Whether to include message history
   * @param messageLimit - Maximum messages to return
   */
  getServerInitialData(
    serverId: number,
    includeMessages: boolean = true,
    messageLimit: number = 50,
  ): ServerInitialDataPayload {
    const status = this.getServerStatus(serverId);
    const players = this.getServerPlayers(serverId);
    const messages = includeMessages
      ? this.getServerMessages(serverId, messageLimit)
      : [];

    return {
      serverId,
      status,
      players,
      messages,
      timestamp: new Date(),
    };
  }
}
