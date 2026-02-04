/**
 * Player API Types
 *
 * Request schemas (Zod for validation) and response types for player-related API endpoints
 */
import { z } from "zod";
import type { PlayerApiData } from "../db";
import type { PaginationMeta } from "./common";

// ============================================================================
// REQUEST SCHEMAS (Zod - Validates User Input)
// ============================================================================

/**
 * Path parameters for GET /api/players/:id
 *
 * Validates the player ID from the URL path
 */
export const GetPlayerParamsSchema = z.object({
  /** Discord ID or Minecraft UUID */
  id: z.string().min(1, "Player ID is required"),
});

/**
 * Query parameters for GET /api/players
 *
 * Supports filtering, pagination, and sorting of players
 */
export const GetPlayersQuerySchema = z.object({
  // Filtering
  discordId: z.string().optional(),
  minecraftUuid: z.string().optional(),
  minecraftUsername: z.string().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),

  // Pagination
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Sorting
  orderBy: z
    .enum(["createdAt", "minecraftUsername", "updatedAt"])
    .default("createdAt"),
  orderDirection: z.enum(["ASC", "DESC"]).default("DESC"),
});

/**
 * Query parameters for GET /api/players/count
 *
 * Filters for counting players
 */
export const GetPlayersCountQuerySchema = z.object({
  // Filtering
  online: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  currentServerId: z.coerce.number().int().positive().optional(),
  createdAfter: z.iso.datetime().optional(),
  createdBefore: z.iso.datetime().optional(),
  lastSeenAfter: z.iso.datetime().optional(),
});

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

export type GetPlayerParams = z.infer<typeof GetPlayerParamsSchema>;
export type GetPlayersQuery = z.infer<typeof GetPlayersQuerySchema>;
export type GetPlayersCountQuery = z.infer<typeof GetPlayersCountQuerySchema>;

// ============================================================================
// RESPONSE TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

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
