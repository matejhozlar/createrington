import config from "@/config";
import { ServerRconConnection } from "./connection";
import { WhitelistAction } from "./enums";
import { RconCommandError, ServerNotFoundError } from "./errors";
import type { MultiServerResult, ServerId, ServerInfo } from "./types";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

function requirePlayerName(playerName: string): void {
  if (!playerName || playerName.trim().length === 0) {
    throw new Error("Player name cannot be empty");
  }
}

export class MinecraftRconManager {
  private static instance: MinecraftRconManager | null = null;
  private readonly connections = new Map<ServerId, ServerRconConnection>();
  private readonly serverConfigs = new Map<ServerId, ServerInfo>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.loadServerConfigs();
    this.startCleanupInterval();
  }

  public static getInstance(): MinecraftRconManager {
    if (!MinecraftRconManager.instance) {
      MinecraftRconManager.instance = new MinecraftRconManager();
    }
    return MinecraftRconManager.instance;
  }

  private loadServerConfigs(): void {
    if (config.servers?.rails?.rcon && config.servers.rails.id) {
      this.serverConfigs.set(config.servers.rails.id, {
        id: config.servers.rails.id,
        name: config.servers.rails.name,
        rcon: {
          host: config.servers.rails.rcon.host,
          port: config.servers.rails.rcon.port,
          password: config.servers.rails.rcon.password,
        },
      });
    }

    logger.info(
      `Loaded RCON configs for ${this.serverConfigs.size} server(s):`,
      Array.from(this.serverConfigs.values()).map((s) => `${s.id} (${s.name})`),
    );
  }

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

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      for (const [serverId, connection] of this.connections.entries()) {
        if (
          connection.isConnected() &&
          now - connection.getLastUsed() > IDLE_TIMEOUT_MS
        ) {
          const idleSeconds = Math.floor(
            (now - connection.getLastUsed()) / 1000,
          );
          logger.debug(
            `[Server ${serverId}] Closing idle RCON connection (${idleSeconds}s idle)`,
          );
          void connection.disconnect();
          this.connections.delete(serverId);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    await Promise.all(
      Array.from(this.connections.values()).map((conn) => conn.disconnect()),
    );
    this.connections.clear();
    MinecraftRconManager.instance = null;
  }

  public getServerIds(): ServerId[] {
    return Array.from(this.serverConfigs.keys());
  }

  public async send(serverId: ServerId, command: string): Promise<string> {
    return this.getConnection(serverId).send(command);
  }

  public async sendAll(
    command: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    const results = new Map<ServerId, MultiServerResult>();

    await Promise.allSettled(
      this.getServerIds().map(async (serverId) => {
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

  public async banAll(
    playerName: string,
    reason?: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    requirePlayerName(playerName);
    const reasonArg = reason ? ` ${reason}` : "";
    const results = await this.sendAll(`ban ${playerName}${reasonArg}`);
    this.checkMultiServerResults(results, "ban", playerName);
    return results;
  }

  public async pardonAll(
    playerName: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    requirePlayerName(playerName);
    const results = await this.sendAll(`pardon ${playerName}`);
    this.checkMultiServerResults(results, "pardon", playerName);
    return results;
  }

  public async whitelistAll(
    action: WhitelistAction.ADD | WhitelistAction.REMOVE,
    playerName: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    requirePlayerName(playerName);
    const results = await this.sendAll(`whitelist ${action} ${playerName}`);
    this.checkMultiServerResults(results, `whitelist ${action}`, playerName);
    return results;
  }

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
