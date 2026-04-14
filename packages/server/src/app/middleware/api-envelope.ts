import type { Response } from "express";

/**
 * Standard success envelope for mod-facing API responses.
 *
 * - `message` is a system-level / developer-facing string for logs.
 * - `playerMessage` (optional) is a player-facing string intended for
 *   in-game chat. Only set when the endpoint has something to display
 *   to a player.
 * - `data` (optional) is the typed response payload.
 */
export interface ApiEnvelope<T> {
  success: true;
  message: string;
  playerMessage?: string;
  data?: T;
}

export interface RespondSuccessOptions<T> {
  message: string;
  playerMessage?: string;
  data?: T;
  status?: number;
}

/**
 * Sends a standardized success envelope: `{ success, message, playerMessage?, data? }`.
 *
 * Pair this with throwing `AppError`/`BadRequestError` (which carry an
 * optional `playerMessage`) so that both success and error responses share
 * the same envelope shape.
 */
export function respondSuccess<T>(
  res: Response,
  options: RespondSuccessOptions<T>,
): void {
  const { message, playerMessage, data, status = 200 } = options;

  const body: ApiEnvelope<T> = {
    success: true,
    message,
    ...(playerMessage ? { playerMessage } : {}),
    ...(data !== undefined ? { data } : {}),
  };

  res.status(status).json(body);
}
