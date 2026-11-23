export type ServerId = number;

export interface RconConfig {
  host: string;
  port: number;
  password: string;
}

export interface MultiServerResult {
  success: boolean;
  response?: string;
  error?: Error;
}
