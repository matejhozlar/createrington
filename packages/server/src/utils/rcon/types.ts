export type ServerId = number;

export interface RconConfig {
  host: string;
  port: number;
  password: string;
}

export interface ServerInfo {
  id: number;
  name: string;
  rcon: RconConfig;
}

export interface MultiServerResult {
  success: boolean;
  response?: string;
  error?: Error;
}
