import { Rcon } from "rcon-client";
import { RconCommandError } from "./errors";
import type { RconConfig, ServerId } from "./types";

function wasSent(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.startsWith("Timeout for packet") ||
      error.message === "Connection closed")
  );
}

export class ServerRconConnection {
  private connection: Rcon | null = null;
  private isConnecting = false;
  private lastUsed = Date.now();

  constructor(
    private readonly serverId: ServerId,
    private readonly serverName: string,
    private readonly cfg: RconConfig,
    private readonly timeoutMs = 10_000,
  ) {}

  private drop(rcon: Rcon): void {
    if (this.connection === rcon) this.connection = null;
    rcon.socket?.destroy();
  }

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

      const rcon = new Rcon({
        host: this.cfg.host,
        port: this.cfg.port,
        password: this.cfg.password,
        timeout: this.timeoutMs,
      });
      rcon.on("error", (error) => {
        logger.warn(
          `[Server ${this.serverId} - ${this.serverName}] RCON connection error:`,
          error,
        );
        this.drop(rcon);
      });
      rcon.on("end", () => {
        if (this.connection === rcon) this.connection = null;
      });

      try {
        await rcon.connect();
      } catch (error) {
        this.drop(rcon);
        throw error;
      }

      this.connection = rcon;
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

  async disconnect(): Promise<void> {
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

  async send(command: string): Promise<string> {
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
          wasSent(error),
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
          wasSent(retryError),
        );
      }
    }
  }

  private async trySend(command: string): Promise<string> {
    const rcon = await this.connect();
    logger.info(
      `[Server ${this.serverId} - ${this.serverName}] Sending RCON: ${command}`,
    );

    let response: string;
    try {
      response = await rcon.send(command);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Timeout")) {
        this.drop(rcon);
      }
      throw error;
    }
    logger.debug(
      `[Server ${this.serverId} - ${this.serverName}] RCON response: ${response}`,
    );

    this.lastUsed = Date.now();
    return response;
  }

  getLastUsed(): number {
    return this.lastUsed;
  }

  isConnected(): boolean {
    return this.connection !== null;
  }
}
