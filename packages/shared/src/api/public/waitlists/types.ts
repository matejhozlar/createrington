/**
 * Public Waitlist API Types
 *
 * Types for public waitlist endpoints (no auth required)
 */

import type { WaitlistEntry } from "../../../db";

/**
 * POST /api/waitlists response
 *
 * Returns different data based on whether user was auto-invited
 */
export interface CreateWaitlistEntryResponse {
  success: true;
  data: {
    entry: WaitlistEntry;
    autoInvited: boolean;
    token?: string;
    redirectUrl?: string;
  };
  message: string;
}

/**
 * Error response for waitlist endpoints
 */
export interface WaitlistErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    details?: any;
    stack?: string;
  };
}
