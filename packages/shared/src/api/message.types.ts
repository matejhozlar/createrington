/**
 * Message API Types
 *
 * Request schemas (Zod for validation) and response types for message endpoints
 */
import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS (Zod - Validates User Input)
// ============================================================================

/**
 * Body for POST /api/messages
 *
 * Sent as multipart/form-data. The `image` field is a file upload handled
 * by multer and is not represented here, only the form fields that land
 * on req.body are typed.
 */
export const SendMessageBodySchema = z.object({
  /** Target Minecraft server ID */
  serverId: z.coerce.number().int().positive(),
  /** Text content of the message (optional if image is provided) */
  content: z.string().optional(),
});

// ============================================================================
// REQUEST TYPES (Auto-Inferred from Schemas)
// ============================================================================

export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;

// ============================================================================
// RESPONSE DATA TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

/**
 * Payload returned on successful message send (201)
 *
 * The `messageId` is the Discord message ID, useful for the client to
 * correlate with the eventual WebSocket broadcast once the bot's messageCreate
 * event fires and the message enters the cache.
 */
export interface SendMessageData {
  /** Discord message ID of the sent message */
  messageId: string;
  /** Minecraft server ID the message was sent to */
  serverId: number;
  /** Discord channel ID the message was sent to */
  channelId: string;
}

// ============================================================================
// RESPONSE TYPES (Plain TypeScript - No Validation Needed)
// ============================================================================

/**
 * Response for POST /api/messages (success)
 */
export interface SendMessageResponse {
  success: true;
  data: SendMessageData;
  message: string;
}

/**
 * Error response for message endpoints
 */
export interface MessageErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}
