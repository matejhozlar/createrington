/**
 * Public Players API - Type Definitions
 *
 * Types for public player endpoints (no auth required)
 */

import type { Player } from "../../../db";
import type { PaginationMeta } from "../../common";

/**
 * Response for GET /api/players/:id
 */
export interface GetPlayerResponse {
  success: true;
  data: Player;
}

/**
 * Response for GET /api/players
 */
export interface GetPlayersResponse {
  success: true;
  data: {
    players: Player[];
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
    details?: any;
    stack?: string;
  };
}
