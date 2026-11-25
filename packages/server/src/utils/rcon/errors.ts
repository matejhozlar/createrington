import type { ServerId } from "./types";

export class RconCommandError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly serverId: ServerId,
    public readonly cause?: unknown,
    public readonly mayHaveRun = false,
  ) {
    super(message);
    this.name = "RconCommandError";
  }
}

export class ServerNotFoundError extends Error {
  constructor(public readonly serverId: ServerId) {
    super(`Server with ID ${serverId} not found in configuration`);
    this.name = "ServerNotFoundError";
  }
}
