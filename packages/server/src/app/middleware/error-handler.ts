import config from "@/config";
import { DatabaseError } from "@/db/utils";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

/**
 * Custom app error class with HTTP status code
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public details?: any,
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common HTTP error constructors
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", details?: any) {
    super(message, 400, true, details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal Server Error") {
    super(message, 500);
    this.name = "InternalServerError";
  }
}

/**
 * Validation error from Zod with field-level details
 */
export class ValidationError extends BadRequestError {
  constructor(
    message: string,
    public fieldErrors: Array<{ field: string; message: string }>,
  ) {
    super(message, fieldErrors);
    this.name = "ValidationError";
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  message: string;
  error: {
    message: string;
    statusCode: number;
    details?: any;
    stack?: string;
  };
}

/**
 * Format Zod validation errors into a readable structure
 */
export function formatZodError(error: ZodError<unknown>): {
  message: string;
  fieldErrors: Array<{ field: string; message: string }>;
} {
  // Zod v3 uses `issues` (not `errors`)
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

/**
 * Centralized error handling middleware
 *
 * Automatically handles:
 * - Zod validation errors
 * - App errors (custom errors)
 * - Database errors
 * - Unknown errors
 *
 * @param err - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
export function errorHandler(
  err: Error | AppError | DatabaseError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  let statusCode = 500;
  let message = "Internal Server Error";
  let isOperational = false;
  let details: any = undefined;

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
  } else if (err instanceof DatabaseError) {
    statusCode = 500;
    message = config.envMode.isDev ? err.message : "Database error occurred";

    if (err.name === "NotFoundError") {
      statusCode = 404;
      message = err.message;
    }
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
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
      body: req.body,
      params: req.params,
      query: req.query,
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
    error: {
      message,
      statusCode,
      ...(details && { details }),
      ...(config.envMode.isDev && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found error handler for undefined routes
 * Should be registered after all other routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}
