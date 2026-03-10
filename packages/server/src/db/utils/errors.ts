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
  constructor(
    message: string,
    public readonly constraint?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "ConstraintViolationError";
  }
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
