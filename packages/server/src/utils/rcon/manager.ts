import { getServerById, SERVER_IDS } from "@/services/mc-server/servers";
import { ServerRconConnection } from "./connection";
import { WhitelistAction } from "./enums";
import { RconCommandError, ServerNotFoundError } from "./errors";
import type { MultiServerResult, ServerId } from "./types";

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
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): MinecraftRconManager {
    if (!MinecraftRconManager.instance) {
      MinecraftRconManager.instance = new MinecraftRconManager();
    }
    return MinecraftRconManager.instance;
  }

  private getConnection(serverId: ServerId): ServerRconConnection {
    const server = getServerById(serverId);

    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    let connection = this.connections.get(serverId);

    if (!connection) {
      connection = new ServerRconConnection(serverId, server.name, server.rcon);
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

  async shutdown(): Promise<void> {
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

  getServerIds(): ServerId[] {
    return [...SERVER_IDS];
  }

  async send(serverId: ServerId, command: string): Promise<string> {
    return this.getConnection(serverId).send(command);
  }

  async sendAll(command: string): Promise<Map<ServerId, MultiServerResult>> {
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

  async whitelist(
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

  async banAll(
    playerName: string,
    reason?: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    requirePlayerName(playerName);
    const reasonArg = reason ? ` ${reason}` : "";
    const results = await this.sendAll(`ban ${playerName}${reasonArg}`);
    this.checkMultiServerResults(results, "ban", playerName);
    return results;
  }

  async pardonAll(
    playerName: string,
  ): Promise<Map<ServerId, MultiServerResult>> {
    requirePlayerName(playerName);
    const results = await this.sendAll(`pardon ${playerName}`);
    this.checkMultiServerResults(results, "pardon", playerName);
    return results;
  }

  async whitelistAll(
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
      const serverName = getServerById(serverId)?.name ?? `Server ${serverId}`;

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
