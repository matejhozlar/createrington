/**
 * Template API Types
 */

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

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

/**
 * Place zod inferred schemas here
 *
 * @example
 * export type GetPlayersSchema = z.infer<typeof GetPlayerParamsSchema>;
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
