import { Rcon } from "rcon-client";
import { RconCommandError } from "./errors";
import type { RconConfig, ServerId } from "./types";

/**
 * Single server RCON connection manager
 * Handles connection lifecycle for one server
 *
 * @private - Not expected, only used internally by MinecraftRconManager
 */
export class ServerRconConnection {
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
   * Sends a command to the server.
   * Automatically reconnects and retries once if the connection is stale.
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
      return await this.trySend(trimmedCommand);
    } catch (error) {
      const isDisconnect =
        error instanceof Error &&
        (error.message.includes("Not connected") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("EPIPE") ||
          error.message.includes("socket has been ended"));

      if (!isDisconnect) {
        throw new RconCommandError(
          `Failed to execute RCON command: ${trimmedCommand}`,
          trimmedCommand,
          this.serverId,
          error,
        );
      }

      logger.warn(
        `[Server ${this.serverId} - ${this.serverName}] Stale RCON connection detected, reconnecting...`,
      );

      this.connection = null;

      try {
        return await this.trySend(trimmedCommand);
      } catch (retryError) {
        logger.error(
          `[Server ${this.serverId} - ${this.serverName}] RCON command failed after reconnect: "${trimmedCommand}":`,
          retryError,
        );
        throw new RconCommandError(
          `Failed to execute RCON command: ${trimmedCommand}`,
          trimmedCommand,
          this.serverId,
          retryError,
        );
      }
    }
  }

  private async trySend(command: string): Promise<string> {
    const rcon = await this.connect();
    logger.info(
      `[Server ${this.serverId} - ${this.serverName}] Sending RCON: ${command}`,
    );

    const response = await rcon.send(command);
    logger.debug(
      `[Server ${this.serverId} - ${this.serverName}] RCON response: ${response}`,
    );

    this.lastUsed = Date.now();
    return response;
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
