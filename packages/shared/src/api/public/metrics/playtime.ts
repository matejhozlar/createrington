/**
 * Playtime Metrics API Types
 */

import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Place query and body schemas here
 *
 * @example
 * // Query parameters for GET /api/players/:id
 * //
 * // Validates the player ID from the URL path
 * export const GetPlayerParamsSchema = z.object({
 *  id: z.string().min(1, "Player ID is required"),
 * });
 */
export const GetPlaytimeHoursQuerySchema = z.object({
  serverId: z.coerce.number().int().positive().optional(),
});

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

/**
 * Place zod inferred schemas here
 *
 * @example
 * export type GetPlayersSchema = z.infer<typeof GetPlayerParamsSchema>;
 */
export type GetPlaytimeHoursQuery = z.infer<typeof GetPlaytimeHoursQuerySchema>;

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
 * Response for GET /api/metrics/playtime/hours
 */
export interface GetPlaytimeHoursResponse {
  success: true;
  data: {
    serverId: number | null;
    totalHours: number;
  };
}

/**
 * Response for GET /api/metrics/playtime/hours/breakdown
 */
export interface GetPlaytimeHoursBreakdownResponse {
  success: true;
  data: PlaytimeHoursBreakdown;
}

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
 * Response data for /api/metrics/playtime/hours/breakdown
 */
export interface PlaytimeHoursBreakdown {
  byServer: Array<{
    serverId: number;
    serverName: string;
    hours: number;
  }>;
  total: number;
}
