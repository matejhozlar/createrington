import { z } from "zod";
import { SubscriptionType } from "./types";
import type {
  InitialDataRequest,
  SubscriptionConfirmation,
  SubscriptionRequest,
} from "./types";

export const MAX_INITIAL_MESSAGE_LIMIT = 500;

const serverId = z.number().int().positive();

const subscriptionRequestSchema = z.object({
  type: z.enum(SubscriptionType),
  serverId: serverId.optional(),
});

const initialDataRequestSchema = z.object({
  serverId: serverId.optional(),
  includeMessages: z.boolean().optional(),
  messageLimit: z
    .number()
    .int()
    .min(1)
    .max(MAX_INITIAL_MESSAGE_LIMIT)
    .optional(),
});

export function parseSubscriptionRequest(
  raw: unknown,
): SubscriptionRequest | null {
  const result = subscriptionRequestSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseInitialDataRequest(
  raw: unknown,
): InitialDataRequest | null {
  const result = initialDataRequestSchema.safeParse(raw ?? {});
  return result.success ? result.data : null;
}

export function resolveAck<T>(
  rawRequest: unknown,
  rawCallback: unknown,
): ((response: T) => void) | undefined {
  if (typeof rawCallback === "function") {
    return rawCallback as (response: T) => void;
  }
  if (rawCallback === undefined && typeof rawRequest === "function") {
    return rawRequest as (response: T) => void;
  }
  return undefined;
}

export function rejectedSubscription(
  raw: unknown,
  error: string,
): SubscriptionConfirmation {
  const type =
    raw !== null &&
    typeof raw === "object" &&
    typeof (raw as { type?: unknown }).type === "string"
      ? (raw as { type: string }).type
      : "";
  return { type, room: "", success: false, error };
}
