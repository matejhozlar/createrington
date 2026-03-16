import config from "@/config";
import { Rcon } from "rcon-client";

/**
 * Configuration for RCON connection
 */
interface RconConfig {
  host: string;
  port: number;
  password: string;
}

/**
 * Server identifier type (numeric ID that maps to config)
 */
export type ServerId = number;

/**
 * Server info from config
 */
interface ServerInfo {
  id: number;
  name: string;
  rcon: RconConfig;
}

/**
 * Minecraft time values
 */
export enum MinecraftTime {
  DAY = "day",
  NIGHT = "night",
  NOON = "noon",
}

/**
 * Minecraft weather values
 */
export enum MinecraftWeather {
  CLEAR = "clear",
  RAIN = "rain",
  THUNDER = "thunder",
}

/**
 * Minecraft difficulty values
 */
export enum MinecraftDifficulty {
  PEACEFUL = "peaceful",
  EASY = "easy",
  NORMAL = "normal",
  HARD = "hard",
}

/**
 * Custom time in ticks (0-24000)
 */
export class MinecraftCustomTime {
  private constructor(public readonly ticks: number) {
    if (ticks < 0 || ticks > 24000) {
      throw new Error("Time ticks must be between 0 and 24000");
    }
  }

  static from(ticks: number): MinecraftCustomTime {
    return new MinecraftCustomTime(ticks);
  }

  toString(): string {
    return this.ticks.toString();
  }
}

/**
 * Combined time type for convenience
 */
export type TimeValue = MinecraftTime | MinecraftCustomTime | number;

/**
 * Minecraft game modes
 */
export enum MinecraftGameMode {
  SURVIVAL = "survival",
  CREATIVE = "creative",
  ADVENTURE = "adventure",
  SPECTATOR = "spectator",
}

/**
 * Whitelist actions
 */
export enum WhitelistAction {
  ADD = "add",
  REMOVE = "remove",
  LIST = "list",
  ON = "on",
  OFF = "off",
  RELOAD = "reload",
}

/**
 * Minecraft Items
 */
export enum MinecraftItem {
  DIAMOND = "minecraft:diamond",
  IRON_INGOT = "minecraft:iron_ingot",
  GOLD_INGOT = "minecraft:gold_ingot",
  EMERALD = "minecraft:emerald",
  DIRT = "minecraft:dirt",
}

/**
 * Rcon command error with additional context
 */
class RconCommandError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly serverId: ServerId,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RconCommandError";
  }
}

/**
 * Server not found error
 */
class ServerNotFoundError extends Error {
  constructor(public readonly serverId: ServerId) {
    super(`Server with ID ${serverId} not found in configuration`);
    this.name = "ServerNotFoundError";
  }
}

/**
 * Single server RCON connection manager
 * Handles connection lifecycle for one server
 *
 * @private - Not expected, only used internally by MinecraftRconManager
 */
class ServerRconConnection {
  private connection: Rcon | null = null;
  private isConnecting = false;
  private lastUsed = Date.now();

  constructor(
    private readonly serverId: ServerId,
    private readonly serverName: string,
    private readonly cfg: RconConfig,
  ) {}

  /**
   * Establishes connection to the RCON server
   */
  private async connect(): Promise<Rcon> {
    if (this.connection) {
      this.lastUsed = Date.now();
      return this.connection;
    }

    if (this.isConnecting) {
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.connection) {
        this.lastUsed = Date.now();
        return this.connection;
      }

      throw new RconCommandError(
        "Previous connection attempt failed",
        "connect",
        this.serverId,
      );
    }

    this.isConnecting = true;

    try {
      logger.info(
        `[Server ${this.serverId} - ${this.serverName}] Connecting to RCON at ${this.cfg.host}:${this.cfg.port}`,
      );

      this.connection = await Rcon.connect({
        host: this.cfg.host,
        port: this.cfg.port,
        password: this.cfg.password,
        timeout: 10000,
      });

      this.lastUsed = Date.now();
      logger.info(
        `[Server ${this.serverId} - ${this.serverName}] RCON connection established`,
      );
      return this.connection;
    } catch (error) {
      logger.error(
        `[Server ${this.serverId} - ${this.serverName}] Failed to connect to RCON:`,
        error,
      );
      throw new RconCommandError(
        "Failed to establish RCON connection",
        "connect",
        this.serverId,
        error,
      );
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnects from the RCON server
   */
  public async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        logger.debug(
          `[Server ${this.serverId} - ${this.serverName}] RCON connection closed`,
        );
      } catch (error) {
        logger.warn(
          `[Server ${this.serverId} - ${this.serverName}] Failed to close RCON:`,
          error,
        );
      } finally {
        this.connection = null;
      }
    }
  }

  /**
   * Sends a command to the server
   */
  public async send(command: string): Promise<string> {
    if (!command || command.trim().length === 0) {
      throw new RconCommandError(
        "Command cannot be empty",
        command,
        this.serverId,
      );
    }

    const trimmedCommand = command.trim();

    try {
      const rcon = await this.connect();
      logger.info(
        `[Server ${this.serverId} - ${this.serverName}] Sending RCON: ${trimmedCommand}`,
      );

      const response = await rcon.send(trimmedCommand);
      logger.debug(
        `[Server ${this.serverId} - ${this.serverName}] RCON response: ${response}`,
      );

      this.lastUsed = Date.now();
      return response;
    } catch (error) {
      logger.error(
        `[Server ${this.serverId} - ${this.serverName}] RCON command failed: "${trimmedCommand}":`,
        error,
      );
      throw new RconCommandError(
        `Failed to execute RCON command: ${trimmedCommand}`,
        trimmedCommand,
        this.serverId,
        error,
      );
    }
  }

  /**
   * Gets the last time this connection was used
   */
  public getLastUsed(): number {
    return this.lastUsed;
  }

  /**
   * Checks if a connection is currently active
   */
  public isConnected(): boolean {
    return this.connection !== null;
  }
}

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

    // Load Test server
    if (config.servers?.test?.rcon && config.servers.test.id) {
      this.serverConfigs.set(config.servers.test.id, {
        id: config.servers.test.id,
        name: config.servers.test.name,
        rcon: {
          host: config.servers.test.rcon.host,
          port: config.servers.test.rcon.port,
          password: config.servers.test.rcon.password,
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
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    const results = new Map<
      ServerId,
      { success: boolean; response?: string; error?: Error }
    >();

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
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
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

  public async time(serverId: ServerId, time: TimeValue): Promise<string> {
    return this.send(serverId, `time set ${this.timeToString(time)}`);
  }

  public async weather(
    serverId: ServerId,
    weather: MinecraftWeather,
    duration?: number,
  ): Promise<string> {
    const durationArg = duration ? ` ${duration}` : "";
    return this.send(serverId, `weather ${weather}${durationArg}`);
  }

  public async difficulty(
    serverId: ServerId,
    difficulty: MinecraftDifficulty,
  ): Promise<string> {
    return this.send(serverId, `difficulty ${difficulty}`);
  }

  public async list(serverId: ServerId): Promise<string> {
    return this.send(serverId, "list");
  }

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

  public async saveAll(serverId: ServerId): Promise<string> {
    return this.send(serverId, "save-all");
  }

  public async stop(serverId: ServerId): Promise<string> {
    return this.send(serverId, "stop");
  }

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
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
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
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    if (!message || message.trim().length === 0) {
      throw new Error("Broadcast message cannot be empty");
    }
    return this.sendAll(`say ${message}`);
  }

  /**
   * Bans a player on multiple servers
   * Logs failures on test server but throws for production servers
   */
  public async banMultiple(
    serverIds: ServerId[],
    playerName: string,
    reason?: string,
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const reasonArg = reason ? ` ${reason}` : "";
    const results = await this.sendToMultiple(
      serverIds,
      `ban ${playerName}${reasonArg}`,
    );

    // Check results and handle failures
    const failures: Array<{
      serverId: ServerId;
      serverName: string;
      error: Error;
    }> = [];

    for (const [serverId, result] of results.entries()) {
      const serverInfo = this.serverConfigs.get(serverId);
      const serverName = serverInfo?.name || `Server ${serverId}`;

      if (!result.success) {
        // Test server (id: 2) - just log the error
        if (serverId === 2) {
          logger.warn(
            `[${serverName}] Failed to ban ${playerName} (ignored):`,
            result.error,
          );
        } else {
          // Production servers - collect failure to throw
          logger.error(
            `[${serverName}] Failed to ban ${playerName}:`,
            result.error,
          );
          failures.push({
            serverId,
            serverName,
            error: result.error!,
          });
        }
      } else {
        logger.info(`[${serverName}] Successfully banned ${playerName}`);
      }
    }

    // Throw if any non-test servers failed
    if (failures.length > 0) {
      const failureDetails = failures
        .map((f) => `${f.serverName} (ID: ${f.serverId})`)
        .join(", ");
      throw new Error(`Ban failed for ${playerName} on: ${failureDetails}`);
    }

    return results;
  }

  /**
   * Bans a player on all servers
   * Logs failures on test server but throws for production servers
   */
  public async banAll(
    playerName: string,
    reason?: string,
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const reasonArg = reason ? ` ${reason}` : "";
    const results = await this.sendAll(`ban ${playerName}${reasonArg}`);

    // Check results and handle failures
    const failures: Array<{
      serverId: ServerId;
      serverName: string;
      error: Error;
    }> = [];

    for (const [serverId, result] of results.entries()) {
      const serverInfo = this.serverConfigs.get(serverId);
      const serverName = serverInfo?.name || `Server ${serverId}`;

      if (!result.success) {
        // Test server (id: 2) - just log the error
        if (serverId === 2) {
          logger.warn(
            `[${serverName}] Failed to ban ${playerName} (ignored):`,
            result.error,
          );
        } else {
          // Production servers - collect failure to throw
          logger.error(
            `[${serverName}] Failed to ban ${playerName}:`,
            result.error,
          );
          failures.push({
            serverId,
            serverName,
            error: result.error!,
          });
        }
      } else {
        logger.info(`[${serverName}] Successfully banned ${playerName}`);
      }
    }

    // Throw if any non-test servers failed
    if (failures.length > 0) {
      const failureDetails = failures
        .map((f) => `${f.serverName} (ID: ${f.serverId})`)
        .join(", ");
      throw new Error(`Ban failed for ${playerName} on: ${failureDetails}`);
    }

    return results;
  }

  /**
   * Pardons (unbans) a player on multiple servers
   * Logs failures on test server but throws for production servers
   */
  public async pardonMultiple(
    serverIds: ServerId[],
    playerName: string,
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendToMultiple(
      serverIds,
      `pardon ${playerName}`,
    );

    // Check results and handle failures
    const failures: Array<{
      serverId: ServerId;
      serverName: string;
      error: Error;
    }> = [];

    for (const [serverId, result] of results.entries()) {
      const serverInfo = this.serverConfigs.get(serverId);
      const serverName = serverInfo?.name || `Server ${serverId}`;

      if (!result.success) {
        // Test server (id: 2) - just log the error
        if (serverId === 2) {
          logger.warn(
            `[${serverName}] Failed to pardon ${playerName} (ignored):`,
            result.error,
          );
        } else {
          // Production servers - collect failure to throw
          logger.error(
            `[${serverName}] Failed to pardon ${playerName}:`,
            result.error,
          );
          failures.push({
            serverId,
            serverName,
            error: result.error!,
          });
        }
      } else {
        logger.info(`[${serverName}] Successfully pardoned ${playerName}`);
      }
    }

    // Throw if any non-test servers failed
    if (failures.length > 0) {
      const failureDetails = failures
        .map((f) => `${f.serverName} (ID: ${f.serverId})`)
        .join(", ");
      throw new Error(`Pardon failed for ${playerName} on: ${failureDetails}`);
    }

    return results;
  }

  /**
   * Pardons (unbans) a player on all servers
   * Logs failures on test server but throws for production servers
   */
  public async pardonAll(
    playerName: string,
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendAll(`pardon ${playerName}`);

    // Check results and handle failures
    const failures: Array<{
      serverId: ServerId;
      serverName: string;
      error: Error;
    }> = [];

    for (const [serverId, result] of results.entries()) {
      const serverInfo = this.serverConfigs.get(serverId);
      const serverName = serverInfo?.name || `Server ${serverId}`;

      if (!result.success) {
        // Test server (id: 2) - just log the error
        if (serverId === 2) {
          logger.warn(
            `[${serverName}] Failed to pardon ${playerName} (ignored):`,
            result.error,
          );
        } else {
          // Production servers - collect failure to throw
          logger.error(
            `[${serverName}] Failed to pardon ${playerName}:`,
            result.error,
          );
          failures.push({
            serverId,
            serverName,
            error: result.error!,
          });
        }
      } else {
        logger.info(`[${serverName}] Successfully pardoned ${playerName}`);
      }
    }

    // Throw if any non-test servers failed
    if (failures.length > 0) {
      const failureDetails = failures
        .map((f) => `${f.serverName} (ID: ${f.serverId})`)
        .join(", ");
      throw new Error(`Pardon failed for ${playerName} on: ${failureDetails}`);
    }

    return results;
  }

  /**
   * Whitelists a player on multiple servers
   * Logs failures on test server but throws for production servers
   */
  public async whitelistMultiple(
    serverIds: ServerId[],
    action: WhitelistAction.ADD | WhitelistAction.REMOVE,
    playerName: string,
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendToMultiple(
      serverIds,
      `whitelist ${action} ${playerName}`,
    );

    // Check results and handle failures
    const failures: Array<{
      serverId: ServerId;
      serverName: string;
      error: Error;
    }> = [];

    for (const [serverId, result] of results.entries()) {
      const serverInfo = this.serverConfigs.get(serverId);
      const serverName = serverInfo?.name || `Server ${serverId}`;

      if (!result.success) {
        // Test server (id: 2) - just log the error
        if (serverId === 2) {
          logger.warn(
            `[${serverName}] Failed to whitelist ${action} ${playerName} (ignored):`,
            result.error,
          );
        } else {
          // Production servers - collect failure to throw
          logger.error(
            `[${serverName}] Failed to whitelist ${action} ${playerName}:`,
            result.error,
          );
          failures.push({
            serverId,
            serverName,
            error: result.error!,
          });
        }
      } else {
        logger.info(
          `[${serverName}] Successfully whitelisted ${action} ${playerName}`,
        );
      }
    }

    // Throw if any non-test servers failed
    if (failures.length > 0) {
      const failureDetails = failures
        .map((f) => `${f.serverName} (ID: ${f.serverId})`)
        .join(", ");
      throw new Error(
        `Whitelist ${action} failed for ${playerName} on: ${failureDetails}`,
      );
    }

    return results;
  }

  /**
   * Whitelists a player on all servers
   * Logs failures on test server but throws for production servers
   */
  public async whitelistAll(
    action: WhitelistAction.ADD | WhitelistAction.REMOVE,
    playerName: string,
  ): Promise<
    Map<ServerId, { success: boolean; response?: string; error?: Error }>
  > {
    if (!playerName || playerName.trim().length === 0) {
      throw new Error("Player name cannot be empty");
    }

    const results = await this.sendAll(`whitelist ${action} ${playerName}`);

    // Check results and handle failures
    const failures: Array<{
      serverId: ServerId;
      serverName: string;
      error: Error;
    }> = [];

    for (const [serverId, result] of results.entries()) {
      const serverInfo = this.serverConfigs.get(serverId);
      const serverName = serverInfo?.name || `Server ${serverId}`;

      if (!result.success) {
        // Test server (id: 2) - just log the error
        if (serverId === 2) {
          logger.warn(
            `[${serverName}] Failed to whitelist ${action} ${playerName} (ignored):`,
            result.error,
          );
        } else {
          // Production servers - collect failure to throw
          logger.error(
            `[${serverName}] Failed to whitelist ${action} ${playerName}:`,
            result.error,
          );
          failures.push({
            serverId,
            serverName,
            error: result.error!,
          });
        }
      } else {
        logger.info(
          `[${serverName}] Successfully whitelisted ${action} ${playerName}`,
        );
      }
    }

    // Throw if any non-test servers failed
    if (failures.length > 0) {
      const failureDetails = failures
        .map((f) => `${f.serverName} (ID: ${f.serverId})`)
        .join(", ");
      throw new Error(
        `Whitelist ${action} failed for ${playerName} on: ${failureDetails}`,
      );
    }

    return results;
  }
}

export const minecraftRcon = MinecraftRconManager.getInstance();
