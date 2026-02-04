/**
 * Server Status API Types
 *
 * Request schemas (Zod for validation) and response types for server status endpoints
 */
import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS (Zod - Validates User Input)
// ============================================================================

/**
 * Path parameters for GET /api/servers/:id
 */
export const GetServerParamsSchema = z.object({
  id: z.coerce.number().int().positive().min(1, "Server ID is required"),
});

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

export type GetServerParams = z.infer<typeof GetServerParamsSchema>;

// ============================================================================
// RESPONSE DATA TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

/**
 * Optional player metadata
 */
export interface PlayerMetadata {
  displayName?: string;
  gamemode?: string;
  dimension?: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  health?: number;
  experienceLevel?: number;
  ipAddress?: string;
}

/**
 * Basic player information for server status
 */
export interface PlayerInfo {
  uuid: string;
  username: string;
  sessionStart: string; // ISO 8601 timestamp
  secondsPlayed: number;
  metadata?: PlayerMetadata;
}

/**
 * Server status information
 */
export interface ServerStatus {
  serverId: number;
  serverName: string;
  ip: string;
  port: number;
  maxPlayers: number;
  status: "online" | "offline" | "unknown";
  playerCount: number;
  players: PlayerInfo[];
  lastChecked: string; // ISO 8601 timestamp
}

/**
 * Summary statistics for all servers
 */
export interface ServersSummary {
  totalServers: number;
  onlineServers: number;
  totalPlayers: number;
}

// ============================================================================
// RESPONSE TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

/**
 * Response for GET /api/servers
 */
export interface GetAllServersResponse {
  success: true;
  data: {
    servers: ServerStatus[];
    summary: ServersSummary;
  };
}

/**
 * Response for GET /api/servers/:id
 */
export interface GetServerResponse {
  success: true;
  data: {
    server: ServerStatus;
  };
}

/**
 * Error response for server status endpoints
 */
export interface ServerErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}
