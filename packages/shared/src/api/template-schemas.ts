/**
 * Public Servers API - Request Schemas
 *
 * Zod validation schemas for request parameters, query, and body
 */

import { z } from "zod";

/**
 * @example
 *
 * // Path parameters for GET /api/servers/:id
 * export const GetServerParamsSchema = z.object({
 *   id: z.coerce.number().int().positive().min(1, "Server ID is required"),
 * });
 *
 */

/**
 * @example
 *
 * // Inferred types from schemas
 *  export type GetServerParams = z.infer<typeof GetServerParamsSchema>;
 */
