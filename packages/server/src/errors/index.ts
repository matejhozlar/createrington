export class AppError extends Error {
  public playerMessage?: string;
  public code?: string;
  public headers?: Record<string, string>;

  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public details?: unknown,
    options?: {
      playerMessage?: string;
      code?: string;
      headers?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "AppError";
    if (options?.playerMessage) this.playerMessage = options.playerMessage;
    if (options?.code) this.code = options.code;
    if (options?.headers) this.headers = options.headers;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(
    message: string = "Bad Request",
    details?: unknown,
    options?: { playerMessage?: string },
  ) {
    super(message, 400, true, details, options);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", options?: { code?: string }) {
    super(message, 401, true, undefined, options);
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

export class TooManyRequestsError extends AppError {
  constructor(message: string = "Too Many Requests") {
    super(message, 429);
    this.name = "TooManyRequestsError";
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal Server Error") {
    super(message, 500);
    this.name = "InternalServerError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service Unavailable") {
    super(message, 503);
    this.name = "ServiceUnavailableError";
  }
}
