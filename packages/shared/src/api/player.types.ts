/**
 * Player API Response Types
 *
 * Type definitions for player-related API endpoints
 */
import type { PlayerApiData } from "../db";

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Query parameters for GET /api/players/:id
 */
export interface GetPlayerParams {
  id: string; // Discord ID or Minecraft UUID
}

/**
 * Query parameters for GET /api/players
 */
export interface GetPlayersQuery {
  // Filtering
  discordId?: string;
  minecraftUuid: string;
  minecraftUsername: string;
  isActive?: "true" | "false";

  // Pagination
  page?: string;
  limit?: string;

  sortBy?: "createdAt" | "minecraftUsername" | "updatedAt";
  sortOder?: "ASC" | "DESC";
}

/**
 * Query parameters for GET /api/players/count
 */
export interface GetPlayersCountQuery {
  // Filtering
  online?: "true" | "false";
  currentServerId?: string;
  createdAfter?: string; // ISO 8601 date string
  createdBefore?: string; // ISO 8601 date string
  lastSeenAfter?: string; // ISO 8601 date string
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Response for GET /api/players/:id
 */
export interface GetPlayerResponse {
  success: true;
  data: PlayerApiData;
}

/**
 * Response for GET /api/players
 */
export interface GetPlayersResponse {
  success: true;
  data: {
    players: PlayerApiData[];
    pagination: PaginationMeta;
  };
}

/**
 * Response for GET /api/players/count
 */
export interface GetPlayersCountResponse {
  success: true;
  data: {
    count: number;
  };
}

/**
 * Error response for player endpoints
 */
export interface PlayerErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}
