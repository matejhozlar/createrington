import { RoomType, SubscriptionType } from "./types";

/**
 * Utility class for WebSocket room management
 *
 * Provides consistent room naming and helps organize clients
 * into appropriate groups for targeted broadcasting
 */
export class RoomManager {
  /**
   * Get the global room name
   * All clients can join this room to receive all updates
   */
  static getGlobalRoom(): string {
    return RoomType.GLOBAL;
  }

  /**
   * Get room name for a specific server
   *
   * @param serverId - Minecraft server ID
   */
  static getServerRoom(serverId: number): string {
    return `${RoomType.SERVER}:${serverId}`;
  }

  /**
   * Get room name for server status subscription
   *
   * @param serverId - Optional server ID for server-specific status
   */
  static getServerStatusRoom(serverId?: number): string {
    if (serverId !== undefined) {
      return `${SubscriptionType.SERVER_STATUS}:${serverId}`;
    }
    return SubscriptionType.SERVER_STATUS;
  }

  /**
   * Get room name for players subscription
   *
   * @param serverId - Optional server ID for server-specific players
   */
  static getPlayersRoom(serverId?: number): string {
    if (serverId !== undefined) {
      return `${SubscriptionType.PLAYERS}:${serverId}`;
    }
    return SubscriptionType.PLAYERS;
  }

  /**
   * Get room name for messages subscription
   *
   * @param serverId - Optional server ID for server-specific messages
   */
  static getMessagesRoom(serverId?: number): string {
    if (serverId !== undefined) {
      return `${SubscriptionType.MESSAGES}:${serverId}`;
    }
    return SubscriptionType.MESSAGES;
  }

  /**
   * Get room name for crypto market subscription
   */
  static getCryptoMarketRoom(): string {
    return SubscriptionType.CRYPTO_MARKET;
  }

  /**
   * Get the owner-only room for a user; joined from the verified JWT at
   * connection time, never reachable via subscribe requests
   */
  static getUserRoom(minecraftUuid: string): string {
    return `${RoomType.USER}:${minecraftUuid}`;
  }

  /**
   * Get appropriate room based on subscription type and server ID
   *
   * @param type - Subscription type
   * @param serverId - Optional server ID
   */
  static getRoomForSubscription(
    type: SubscriptionType,
    serverId?: number,
  ): string {
    switch (type) {
      case SubscriptionType.ALL:
        return serverId !== undefined
          ? this.getServerRoom(serverId)
          : this.getGlobalRoom();
      case SubscriptionType.SERVER_STATUS:
        return this.getServerStatusRoom(serverId);
      case SubscriptionType.PLAYERS:
        return this.getPlayersRoom(serverId);
      case SubscriptionType.MESSAGES:
        return this.getMessagesRoom(serverId);
      case SubscriptionType.CRYPTO_MARKET:
        return this.getCryptoMarketRoom();
      default:
        throw new Error(`Unknown subscription type: ${type}`);
    }
  }

  /**
   * Parse room name to extract subscription type and server ID
   *
   * @param room - Room name
   */
  static parseRoom(room: string): {
    type: string;
    serverId?: number;
  } {
    if (room === RoomType.GLOBAL) {
      return { type: SubscriptionType.ALL };
    }

    const parts = room.split(":");
    if (parts.length === 1) {
      return { type: parts[0] };
    }

    const serverId = parseInt(parts[1]);
    return {
      type: parts[0],
      serverId: isNaN(serverId) ? undefined : serverId,
    };
  }

  /**
   * Check if room is server-specific
   *
   * @param room - Room name
   */
  static isServerSpecific(room: string): boolean {
    const parsed = this.parseRoom(room);
    return parsed.serverId !== undefined;
  }

  /**
   * Get all rooms a client should join for a subscription
   *
   * This handles cases where subscribing to one thing might require
   * joining multiple rooms (e.g., subscribing to ALL might join
   * status, players, and messages rooms)
   *
   * @param type - Subscription type
   * @param serverId - Optional server ID
   */
  static getRoomsForSubscription(
    type: SubscriptionType,
    serverId?: number,
  ): string[] {
    if (type === SubscriptionType.ALL) {
      if (serverId !== undefined) {
        return [
          this.getServerRoom(serverId),
          this.getServerStatusRoom(serverId),
          this.getPlayersRoom(serverId),
          this.getMessagesRoom(serverId),
        ];
      }
      return [
        this.getGlobalRoom(),
        this.getServerStatusRoom(),
        this.getPlayersRoom(),
        this.getMessagesRoom(),
      ];
    }

    return [this.getRoomForSubscription(type, serverId)];
  }
}
