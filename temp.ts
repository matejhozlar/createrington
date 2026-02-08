/**
 * Server API Types
 */

// ============================================================================
// RESPONSE DATA TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

/**
 * Place response data types
 *
 * @example
 * // Tickets data for admin view
 * export interface AdminPlayerTickets {
 *  total: number;
 *  open: number;
 * };
 */

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
  sessionStart: Date;
  secondsPlayed: Date;
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
  lastChecked: Date;
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
 * Place response types including success state, etc.
 *
 * @example
 * // Response for GET /api/admin/players/:id/tickets/count
 * export const interface GetPlayerTicketsCount {
 *  success: true;
 *  data: {
 *  tickets: AdminPlayerTickets;
 *  };
 * };
 */

/**
 * Response for GET /api/servers
 */
export interface GetServersResponse {
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
