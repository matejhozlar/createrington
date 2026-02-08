/**
 * Playtime Metrics API Types
 */

import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

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
