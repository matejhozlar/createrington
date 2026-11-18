import config from "@/config";
import { DatabaseError, NotFoundError as DbNotFoundError } from "@/db/utils";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, NotFoundError } from "@/errors";

interface RequestBodyError extends Error {
  status: number;
  type: string;
  expose: true;
}

const REQUEST_BODY_ERROR_MESSAGES: Record<string, string> = {
  "entity.parse.failed": "Malformed JSON request body",
  "entity.too.large": "Request body too large",
};

function isRequestBodyError(err: Error): err is RequestBodyError {
  const candidate = err as Partial<RequestBodyError>;
  return (
    typeof candidate.type === "string" &&
    typeof candidate.status === "number" &&
    candidate.status >= 400 &&
    candidate.status < 500 &&
    candidate.expose === true
  );
}

interface ErrorResponse {
  success: false;
  message: string;
  playerMessage?: string;
  error: {
    message: string;
    statusCode: number;
    code?: string;
    details?: unknown;
    stack?: string;
  };
}

export function formatZodError(error: ZodError<unknown>): {
  message: string;
  fieldErrors: Array<{ field: string; message: string }>;
} {
  const fieldErrors = error.issues.map((issue) => ({
    field: issue.path.map(String).join("."),
    message: issue.message,
  }));

  const message =
    fieldErrors.length === 1
      ? fieldErrors[0].message
      : `Validation failed: ${fieldErrors.map((fe) => fe.field).join(", ")}`;

  return { message, fieldErrors };
}

const SENSITIVE_KEYS =
  /(password|secret|token|api_?key|authorization|cookie|jwt)/i;

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.test(key)
      ? "[REDACTED]"
      : redactSensitive(inner);
  }
  return result;
}

export function errorHandler(
  err: Error | AppError | DatabaseError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = "Internal Server Error";
  let isOperational = false;
  let details: unknown = undefined;
  let playerMessage: string | undefined = undefined;
  let code: string | undefined = undefined;

  if (err instanceof ZodError) {
    const { message: ZodMessage, fieldErrors } = formatZodError(err);
    statusCode = 400;
    message = ZodMessage;
    details = config.envMode.isDev ? fieldErrors : undefined;
    isOperational = true;

    logger.warn("Validation error:", {
      message: ZodMessage,
      fields: fieldErrors,
      path: req.path,
      method: req.method,
    });
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    details = err.details;
    playerMessage = err.playerMessage;
    code = err.code;
    if (err.headers) res.set(err.headers);
  } else if (err instanceof DbNotFoundError) {
    statusCode = 404;
    message = err.message;
    isOperational = true;
  } else if (err instanceof DatabaseError) {
    statusCode = 500;
    message = config.envMode.isDev ? err.message : "Database error occurred";
  } else if (isRequestBodyError(err)) {
    statusCode = err.status;
    message = REQUEST_BODY_ERROR_MESSAGES[err.type] ?? err.message;
    isOperational = true;
  } else {
    message = config.envMode.isDev ? err.message : "Internal Server Error";
  }

  if (statusCode >= 500 || !isOperational) {
    logger.error("Error Handler:", {
      message: err.message,
      statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: redactSensitive(req.body),
      params: req.params,
      query: redactSensitive(req.query),
    });
  } else {
    logger.warn("Client Error:", {
      message: err.message,
      statusCode,
      path: req.path,
      method: req.method,
    });
  }

  const errorResponse: ErrorResponse = {
    success: false,
    message,
    ...(playerMessage ? { playerMessage } : {}),
    error: {
      message,
      statusCode,
      ...(code ? { code } : {}),
      ...(details !== undefined ? { details } : {}),
      ...(config.envMode.isDev && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(errorResponse);
}

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}
