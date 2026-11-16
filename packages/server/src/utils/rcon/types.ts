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
 * Result of a command sent to a single server within a multi-server operation.
 */
export interface MultiServerResult {
  success: boolean;
  response?: string;
  error?: Error;
}
