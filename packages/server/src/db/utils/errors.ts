/**
 * Base error class for database-related errors
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when a database entry is not found
 */
export class NotFoundError extends DatabaseError {
  constructor(
    public readonly entityName: string,
    public readonly criteria: Record<string, unknown>,
  ) {
    const criteriaStr = formatCriteria(criteria);
    super(`${entityName} not found with ${criteriaStr}`);
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when database constraint is violated
 */
export class ConstraintViolationError extends DatabaseError {
  /** Postgres error code copied from the cause, so duck-typed `code === "23505"` checks keep working */
  public readonly code?: string;

  constructor(
    message: string,
    public readonly constraint?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "ConstraintViolationError";
    if (typeof cause === "object" && cause !== null && "code" in cause) {
      this.code = String((cause as { code: unknown }).code);
    }
  }
}

/**
 * Wraps pg unique-violation errors (code 23505) in ConstraintViolationError;
 * returns every other error unchanged.
 */
export function translateDbError(error: unknown): unknown {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  ) {
    const pgError = error as { message?: string; constraint?: string };
    return new ConstraintViolationError(
      pgError.message ?? "Unique constraint violation",
      pgError.constraint,
      error,
    );
  }
  return error;
}

/**
 * Error thrown when a database query fails
 */
export class QueryError extends DatabaseError {
  constructor(
    message: string,
    public readonly query?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "QueryError";
  }
}

/**
 * Formats criteria object into readable string for error messages
 */
function formatCriteria(criteria: Record<string, unknown>): string {
  return Object.entries(criteria)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}
