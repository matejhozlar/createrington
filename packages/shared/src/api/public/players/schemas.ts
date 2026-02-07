/**
 * Public Players API - Request Schemas
 *
 * Zod validation schemas for request parameters, query, and body
 */

import { z } from "zod";

/**
 * Path parameters for GET /api/players/:id
 */
export const GetPlayerParamsSchema = z.object({
  id: z.string().min(1, "Player ID is required"),
});

/**
 * Query parameters for GET /api/players
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
  orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Query parameters for GET /api/players/count
 */
export const GetPlayersCountQuerySchema = z.object({
  online: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  currentServerId: z.coerce.number().int().positive().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  lastSeenAfter: z.string().datetime().optional(),
});

/**
 * Inferred types from schemas
 */
export type GetPlayerParams = z.infer<typeof GetPlayerParamsSchema>;
export type GetPlayersQuery = z.infer<typeof GetPlayersQuerySchema>;
export type GetPlayersCountQuery = z.infer<typeof GetPlayersCountQuerySchema>;
