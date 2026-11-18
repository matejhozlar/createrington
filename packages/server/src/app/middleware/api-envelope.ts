import type { Response } from "express";

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
