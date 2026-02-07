/**
 * Public Waitlist API - Request Schemas
 *
 * Zod validation schemas for request body
 */

import { z } from "zod";

/**
 * Body for POST /api/waitlists
 *
 * Validates email format and required fields
 */
export const CreateWaitlistEntryBodySchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  discordName: z
    .string()
    .min(1, "Discord name is required")
    .max(100, "Discord name too long"),
});

/**
 * Inferred type from schema
 */
export type CreateWaitlistEntryBody = z.infer<
  typeof CreateWaitlistEntryBodySchema
>;
