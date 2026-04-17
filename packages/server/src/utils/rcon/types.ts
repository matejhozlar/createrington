import type { MinecraftTime } from "./enums";

/**
 * Server identifier type (numeric ID that maps to config)
 */
export type ServerId = number;

/**
 * Configuration for RCON connection
 */
export interface RconConfig {
  host: string;
  port: number;
  password: string;
}

/**
 * Server info from config
 */
export interface ServerInfo {
  id: number;
  name: string;
  rcon: RconConfig;
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
 * Result of a command sent to a single server within a multi-server operation.
 */
export interface MultiServerResult {
  success: boolean;
  response?: string;
  error?: Error;
}
