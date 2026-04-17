import config from "@/config";
import { ServerRconConnection } from "./connection";
import {
  MinecraftDifficulty,
  MinecraftGameMode,
  MinecraftItem,
  MinecraftWeather,
  WhitelistAction,
} from "./enums";
import { RconCommandError, ServerNotFoundError } from "./errors";
import {
  MinecraftCustomTime,
  type MultiServerResult,
  type RconConfig,
  type ServerId,
  type ServerInfo,
  type TimeValue,
} from "./types";

/**
 * Multi-server Minecraft RCON manager
 *
 * Manages RCON connections to multiple Minecraft servers
 * Provides connection pooling and automatic cleanup of idle connections
 */
export class MinecraftRconManager {
  private static instance: MinecraftRconManager | null = null;
  private readonly connections = new Map<ServerId, ServerRconConnection>();
  private readonly serverConfigs = new Map<ServerId, ServerInfo>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.loadServerConfigs();
    this.startCleanupInterval();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): MinecraftRconManager {
    if (!MinecraftRconManager.instance) {
      MinecraftRconManager.instance = new MinecraftRconManager();
    }
    return MinecraftRconManager.instance;
  }

  /**
   * Loads server configurations from config
   * Maps servers by their numeric ID
   */
  private loadServerConfigs(): void {
    // Load Cogs & Steam server
    if (config.servers?.cogs?.rcon && config.servers.cogs.id) {
      this.serverConfigs.set(config.servers.cogs.id, {
        id: config.servers.cogs.id,
        name: config.servers.cogs.name,
        rcon: {
          host: config.servers.cogs.rcon.host,
          port: config.servers.cogs.rcon.port,
          password: config.servers.cogs.rcon.password,
        },
      });
    }

    logger.info(
      `Loaded RCON configs for ${this.serverConfigs.size} server(s):`,
      Array.from(this.serverConfigs.values()).map((s) => `${s.id} (${s.name})`),
    );
  }

  /**
   * Dynamically registers a new server at runtime
   *
   * @param serverId - Unique numeric server identifier
   * @param name - Server name
   * @param rconConfig - RCON configuration
   */
  public registerServer(
    serverId: ServerId,
    name: string,
    rconConfig: RconConfig,
  ): void {
    if (this.serverConfigs.has(serverId)) {
      logger.warn(
        `[Server ${serverId}] Server already registered, updating config`,
      );
    }
    this.serverConfigs.set(serverId, {
      id: serverId,
      name,
      rcon: rconConfig,
    });
    logger.info(
      `[Server ${serverId} - ${name}] Server registered with RCON config`,
    );
  }

  /**
   * Removes a server from the manager
   *
   * @param serverId - Server to unregister
   */
  public async unregisterServer(serverId: ServerId): Promise<void> {
    await this.disconnect(serverId);
    this.serverConfigs.delete(serverId);
    logger.info(`[Server ${serverId}] Server unregistered`);
  }

  /**
   * Gets or creates a connection for a specific server
   *
   * @private
   */
  private getConnection(serverId: ServerId): ServerRconConnection {
    const serverInfo = this.serverConfigs.get(serverId);

    if (!serverInfo) {
      throw new ServerNotFoundError(serverId);
    }

    let connection = this.connections.get(serverId);

    if (!connection) {
      connection = new ServerRconConnection(
        serverId,
        serverInfo.name,
        serverInfo.rcon,
      );
      this.connections.set(serverId, connection);
    }

    return connection;
  }

  /**
   * Helper to convert TimeValue to string
   */
  private timeToString(time: TimeValue): string {
    if (typeof time === "number") {
      return time.toString();
    }
    if (time instanceof MinecraftCustomTime) {
      return time.toString();
    }
    return time as string;
  }

  /**
   * Sends a raw command to a specific server
   *
   * @param serverId - Server ID to send command to
   * @param command - Command to execute
   * @returns Promise resolving to the server's response
   */
  public async send(serverId: ServerId, command: string): Promise<string> {
    const connection = this.getConnection(serverId);
    return connection.send(command);
  }

  /**
   * Sends the same command to multiple servers in parallel
   *
   * @param serverIds - List of server IDs
   * @param command - Command to execute
   * @returns Promise resolving to the map of results per server
   */
  public async sendToMultiple(
    serverIds: ServerId[],
    command: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    const results = new Map<ServerId, MultiServerResult>();

    await Promise.allSettled(
      serverIds.map(async (serverId) => {
        try {
          const response = await this.send(serverId, command);
          results.set(serverId, { success: true, response });
        } catch (error) {
          results.set(serverId, {
            success: false,
            error: error as Error,
          });
        }
      }),
    );

    return results;
  }

  /**
   * Sends a command to all configured servers
   *
   * @param command - Command to execute
   * @returns Map of results per server
   */
  public async sendAll(
    command: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    const serverIds = Array.from(this.serverConfigs.keys());
    return this.sendToMultiple(serverIds, command);
  }

  /**
   * Disconnects from a specific server
   */
  public async disconnect(serverId: ServerId): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(serverId);
    }
  }

  /**
   * Disconnects from all servers
   */
  public async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.connections.values()).map((conn) => conn.disconnect()),
    );
    this.connections.clear();
    this.stopCleanup();
  }

  /**
   * Starts the cleanup interval to close idle connections
   */
  private startCleanupInterval(): void {
    const IDLE_TIMEOUT = 5 * 60 * 1000;
    const CHECK_INTERVAL = 60 * 1000;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [serverId, connection] of this.connections.entries()) {
        if (
          connection.isConnected() &&
          now - connection.getLastUsed() > IDLE_TIMEOUT
        ) {
          const idleSeconds = Math.floor(
            (now - connection.getLastUsed()) / 1000,
          );
          logger.debug(
            `[Server ${serverId}] Closing idle RCON connection (${idleSeconds}s idle)`,
          );
          connection.disconnect();
          this.connections.delete(serverId);
        }
      }
    }, CHECK_INTERVAL);
  }

  /**
   * Stops the cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Stops the cleanup interval, disconnects all servers, and resets the singleton */
  public async shutdown(): Promise<void> {
    this.stopCleanup();
    await this.disconnectAll();
    MinecraftRconManager.instance = null;
  }

  /**
   * Gets list of configured server IDs
   */
  public getServerIds(): ServerId[] {
    return Array.from(this.serverConfigs.keys());
  }

  /**
   * Checks if a server is configured
   */
  public hasServer(serverId: ServerId): boolean {
    return this.serverConfigs.has(serverId);
  }

  /**
   * Gets server info by ID
   */
  public getServerInfo(serverId: ServerId): ServerInfo | undefined {
    return this.serverConfigs.get(serverId);
  }

  /**
   * Gets all server info
   */
  public getAllServerInfo(): ServerInfo[] {
    return Array.from(this.serverConfigs.values());
  }

  /**
   * Gets connection statistics
   */
  public getStats(): {
    totalConfigured: number;
    activeConnections: number;
    servers: Array<{
      serverId: ServerId;
      serverName: string;
      connected: boolean;
      lastUsed?: number;
      idleSeconds?: number;
    }>;
  } {
    const servers = Array.from(this.serverConfigs.values()).map((info) => {
      const connection = this.connections.get(info.id);
      const lastUsed = connection?.getLastUsed();

      return {
        serverId: info.id,
        serverName: info.name,
        connected: connection?.isConnected() ?? false,
        lastUsed,
        idleSeconds: lastUsed
          ? Math.floor((Date.now() - lastUsed) / 1000)
          : undefined,
      };
    });

    return {
      totalConfigured: this.serverConfigs.size,
      activeConnections: Array.from(this.connections.values()).filter((c) =>
        c.isConnected(),
      ).length,
      servers,
    };
  }

  // ============================================================================
  // CONVENIENCE METHODS (single server operations)
  // ============================================================================

  /** Sets the in-game time on a server */
  public async time(serverId: ServerId, time: TimeValue): Promise<string> {
    return this.send(serverId, `time set ${this.timeToString(time)}`);
  }

  /**
   * Sets the weather on a server
   *
   * @param serverId - Target server
   * @param weather - Weather type to set
   * @param duration - Optional duration in seconds
   */
  public async weather(
    serverId: ServerId,
    weather: MinecraftWeather,
    duration?: number,
  ): Promise<string> {
    const durationArg = duration ? ` ${duration}` : "";
    return this.send(serverId, `weather ${weather}${durationArg}`);
  }

  /** Sets the difficulty on a server */
  public async difficulty(
    serverId: ServerId,
    difficulty: MinecraftDifficulty,
  ): Promise<string> {
    return this.send(serverId, `difficulty ${difficulty}`);
  }

  /** Returns the online player list from a server */
  public async list(serverId: ServerId): Promise<string> {
    return this.send(serverId, "list");
  }

  /**
   * Kicks a player from a server
   *
   * @param serverId - Target server
   * @param playerName - Player to kick
   * @param reason - Optional kick reason shown to the player
   */
  public async kick(
    serverId: ServerId,
    playerName: string,
    reason?: string,
  ): Promise<string> {
    if (!playerName || playerName.trim().length === 0) {
      throw new RconCommandError("Player cannot be empty", "kick", serverId);
    }
    const reasonArg = reason ? ` ${reason}` : "";
    return this.send(serverId, `kick ${playerName}${reasonArg}`);
  }

  /**
   * Bans a player on a single server
   *
   * @param serverId - Target server
   * @param playerName - Player to ban
   * @param reason - Optional ban reason
   */
  public async ban(
    serverId: ServerId,
    playerName: string,
    reason?: string,
  ): Promise<string> {
    if (!playerName || playerName.trim().length === 0) {
      throw new RconCommandError(
        "Player name cannot be empty",
        "ban",
        serverId,
      );
    }
    const reasonArg = reason ? ` ${reason}` : "";
    return this.send(serverId, `ban ${playerName}${reasonArg}`);
  }

  /** Pardons (unbans) a player on a single server */
  public async pardon(serverId: ServerId, playerName: string): Promise<string> {
    if (!playerName || playerName.trim().length === 0) {
      throw new RconCommandError(
        "Player name cannot be empty",
        "pardon",
        serverId,
      );
    }
    return this.send(serverId, `pardon ${playerName}`);
  }

  /** Sets a player's game mode on a server */
  public async gamemode(
    serverId: ServerId,
    playerName: string,
    gameMode: MinecraftGameMode,
  ): Promise<string> {
    if (!playerName || playerName.trim().length === 0) {
      throw new RconCommandError(
        "Player name cannot be empty",
        "gamemode",
        serverId,
      );
    }
    return this.send(serverId, `gamemode ${gameMode} ${playerName}`);
  }

  /**
   * Gives a player an item on a server
   *
   * @param serverId - Target server
   * @param playerName - Recipient player name
   * @param item - Item ID (namespaced, e.g. "minecraft:diamond")
   * @param amount - Quantity to give (default: 1)
   */
  public async give(
    serverId: ServerId,
    playerName: string,
    item: string | MinecraftItem,
    amount: number = 1,
  ): Promise<string> {
    if (!playerName || playerName.trim().length === 0) {
      throw new RconCommandError("Player cannot be empty", "give", serverId);
    }
    if (!item || (typeof item === "string" && item.trim().length === 0)) {
      throw new RconCommandError("Item cannot be empty", "give", serverId);
    }
    if (amount < 1) {
      throw new RconCommandError("Amount must be at least 1", "give", serverId);
    }

    return this.send(serverId, `give ${playerName} ${item} ${amount}`);
  }

  /**
   * Teleports a player to another player or coordinates on a server
   *
   * @param serverId - Target server
   * @param playerName - Player to teleport
   * @param destination - Target player name or {x, y, z} coordinates
   */
  public async tp(
    serverId: ServerId,
    playerName: string,
    destination: string | { x: number; y: number; z: number },
  ): Promise<string> {
    if (!playerName || playerName.trim().length === 0) {
      throw new RconCommandError("Player name cannot be empty", "tp", serverId);
    }

    let destinationStr: string;
    if (typeof destination === "string") {
      destinationStr = destination;
    } else {
      destinationStr = `${destination.x} ${destination.y} ${destination.z}`;
    }

    return this.send(serverId, `tp ${playerName} ${destinationStr}`);
  }

  /** Triggers a world save on a server (`save-all`) */
  public async saveAll(serverId: ServerId): Promise<string> {
    return this.send(serverId, "save-all");
  }

  /** Gracefully stops a server */
  public async stop(serverId: ServerId): Promise<string> {
    return this.send(serverId, "stop");
  }

  /**
   * Manages the whitelist on a server (add, remove, list, on, off, reload)
   *
   * @param serverId - Target server
   * @param action - Whitelist action to perform
   * @param playerName - Required for ADD and REMOVE actions
   */
  public async whitelist(
    serverId: ServerId,
    action: WhitelistAction,
    playerName?: string,
  ): Promise<string> {
    if (
      (action === WhitelistAction.ADD || action === WhitelistAction.REMOVE) &&
      !playerName
    ) {
      throw new RconCommandError(
        `Player name is required for whitelist ${action}`,
        "whitelist",
        serverId,
      );
    }
    const playerArg = playerName ? ` ${playerName}` : "";
    return this.send(serverId, `whitelist ${action}${playerArg}`);
  }

  // ============================================================================
  // BROADCAST METHODS (multiple server operations)
  // ============================================================================

  /**
   * Broadcasts to specific servers
   */
  public async broadcast(
    serverIds: ServerId[],
    message: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!message || message.trim().length === 0) {
      throw new Error("Broadcast message cannot be empty");
    }
    return this.sendToMultiple(serverIds, `say ${message}`);
  }

  /**
   * Broadcasts a message to all servers
   */
  public async broadcastAll(
    message: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!message || message.trim().length === 0) {
      throw new Error("Broadcast message cannot be empty");
    }
    return this.sendAll(`say ${message}`);
  }

  /**
   * Bans a player on multiple servers
   */
  public async banMultiple(
    serverIds: ServerId[],
    playerName: string,
    reason?: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const reasonArg = reason ? ` ${reason}` : "";
    const results = await this.sendToMultiple(
      serverIds,
      `ban ${playerName}${reasonArg}`,
    );

    this.checkMultiServerResults(results, "ban", playerName);
    return results;
  }

  /**
   * Bans a player on all servers
   */
  public async banAll(
    playerName: string,
    reason?: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const reasonArg = reason ? ` ${reason}` : "";
    const results = await this.sendAll(`ban ${playerName}${reasonArg}`);

    this.checkMultiServerResults(results, "ban", playerName);
    return results;
  }

  /**
   * Pardons (unbans) a player on multiple servers
   */
  public async pardonMultiple(
    serverIds: ServerId[],
    playerName: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendToMultiple(
      serverIds,
      `pardon ${playerName}`,
    );

    this.checkMultiServerResults(results, "pardon", playerName);
    return results;
  }

  /**
   * Pardons (unbans) a player on all servers
   */
  public async pardonAll(
    playerName: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendAll(`pardon ${playerName}`);

    this.checkMultiServerResults(results, "pardon", playerName);
    return results;
  }

  /**
   * Whitelists a player on multiple servers
   */
  public async whitelistMultiple(
    serverIds: ServerId[],
    action: WhitelistAction.ADD | WhitelistAction.REMOVE,
    playerName: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendToMultiple(
      serverIds,
      `whitelist ${action} ${playerName}`,
    );

    this.checkMultiServerResults(results, `whitelist ${action}`, playerName);
    return results;
  }

  /**
   * Whitelists a player on all servers
   */
  public async whitelistAll(
    action: WhitelistAction.ADD | WhitelistAction.REMOVE,
    playerName: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendAll(`whitelist ${action} ${playerName}`);

    this.checkMultiServerResults(results, `whitelist ${action}`, playerName);
    return results;
  }

  /**
   * Checks multi-server operation results and throws if any server failed
   */
  private checkMultiServerResults(
    results: Map<ServerId, MultiServerResult>,
    operation: string,
    playerName: string,
  ): void {
    const failures: Array<{
      serverId: ServerId;
      serverName: string;
      error: Error;
    }> = [];

    for (const [serverId, result] of results.entries()) {
      const serverInfo = this.serverConfigs.get(serverId);
      const serverName = serverInfo?.name || `Server ${serverId}`;

      if (!result.success) {
        logger.error(
          `[${serverName}] Failed to ${operation} ${playerName}:`,
          result.error,
        );
        failures.push({ serverId, serverName, error: result.error! });
      } else {
        logger.info(`[${serverName}] Successfully ${operation} ${playerName}`);
      }
    }

    if (failures.length > 0) {
      const failureDetails = failures
        .map((f) => `${f.serverName} (ID: ${f.serverId})`)
        .join(", ");
      throw new Error(
        `${operation} failed for ${playerName} on: ${failureDetails}`,
      );
    }
  }
}

export const minecraftRcon = MinecraftRconManager.getInstance();
