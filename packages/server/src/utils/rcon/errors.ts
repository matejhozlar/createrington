import type { ServerId } from "./types";

/**
 * Rcon command error with additional context
 */
export class RconCommandError extends Error {
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
export class ServerNotFoundError extends Error {
  constructor(public readonly serverId: ServerId) {
    super(`Server with ID ${serverId} not found in configuration`);
    this.name = "ServerNotFoundError";
  }
}
