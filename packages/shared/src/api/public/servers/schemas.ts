/**
 * Public Servers API - Request Schemas
 *
 * Zod validation schemas for request parameters, query, and body
 */

import { z } from "zod";

/**
 * Path parameters got GET /api/servers/:id
 */
export const GetServerParamsSchema = z.object({
  id: z.coerce.number().int().positive().min(1, "Server ID is required"),
});

/**
 * Inferred types from schemas
 */
export type GetServerParams = z.infer<typeof GetServerParamsSchema>;
