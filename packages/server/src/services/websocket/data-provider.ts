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
  async getAllServerStatuses(): Promise<ServerStatus[]> {
    const statuses: ServerStatus[] = [];

    for (const [serverId, _config] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId);
      const status = await this.getServerStatus(id);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get current status for a specific server
   *
   * @param serverId - Server ID
   */
  async getServerStatus(serverId: number): Promise<ServerStatus> {
    const config = MINECRAFT_SERVERS[serverId];
    if (!config) {
      throw new Error(`Server ${serverId} not found`);
    }

    const playtimeService = this.playtimeManagerService.getService(serverId);
    const activeSessions = playtimeService?.getActiveSessions() ?? [];

    const isOnline = playtimeService?.isOnline() ?? false;

    return {
      serverId,
      serverName: config.name,
      online: isOnline,
      maintenance: maintenanceService.isInMaintenance(serverId),
      playerCount: activeSessions.length,
      maxPlayers: config.maxPlayers,
      lastUpdate: new Date(),
    };
  }

  /**
   * Get all online players across all servers
   */
  async getAllPlayers(): Promise<PlayerData[]> {
    const players: PlayerData[] = [];

    for (const [serverId] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId);
      const serverPlayers = await this.getServerPlayers(id);
      players.push(...serverPlayers);
    }

    return players;
  }

  /**
   * Get online players for a specific server
   *
   * @param serverId - Server ID
   */
  async getServerPlayers(serverId: number): Promise<PlayerData[]> {
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
  async getAllMessages(
    limit: number = 50,
  ): Promise<Record<number, CachedMessage[]>> {
    const messages: Record<number, CachedMessage[]> = {};

    for (const [serverId] of Object.entries(MINECRAFT_SERVERS)) {
      const id = parseInt(serverId);
      const serverMessages = await this.getServerMessages(id, limit);
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
  async getServerMessages(
    serverId: number,
    limit: number = 50,
  ): Promise<CachedMessage[]> {
    return this.messageCacheService.getRecentMessages(serverId, limit);
  }

  /**
   * Get complete initial data for all servers
   *
   * @param includeMessages - Whether to include message history
   * @param messageLimit - Maximum messages per server
   */
  async getInitialData(
    includeMessages: boolean = true,
    messageLimit: number = 50,
  ): Promise<InitialDataPayload> {
    const [servers, players, messages] = await Promise.all([
      this.getAllServerStatuses(),
      this.getAllPlayers(),
      includeMessages ? this.getAllMessages(messageLimit) : Promise.resolve({}),
    ]);

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
  async getServerInitialData(
    serverId: number,
    includeMessages: boolean = true,
    messageLimit: number = 50,
  ): Promise<ServerInitialDataPayload> {
    const [status, players, messages] = await Promise.all([
      this.getServerStatus(serverId),
      this.getServerPlayers(serverId),
      includeMessages
        ? this.getServerMessages(serverId, messageLimit)
        : Promise.resolve([]),
    ]);

    return {
      serverId,
      status,
      players,
      messages,
      timestamp: new Date(),
    };
  }
}
