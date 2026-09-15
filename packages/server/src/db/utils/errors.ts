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
 * Error thrown when a database constraint is violated.
 * Subclasses identify the kind of constraint; catch this class to handle any of them.
 */
export class ConstraintViolationError extends DatabaseError {
  /** Postgres error code copied from the cause, so duck-typed `code === "23505"` checks keep working */
  public readonly code?: string;
  /** Column named by the cause, set for NOT NULL violations */
  public readonly column?: string;

  constructor(
    message: string,
    public readonly constraint?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "ConstraintViolationError";
    if (typeof cause === "object" && cause !== null) {
      if ("code" in cause)
        this.code = String((cause as { code: unknown }).code);
      if (
        "column" in cause &&
        typeof (cause as { column: unknown }).column === "string"
      ) {
        this.column = (cause as { column: string }).column;
      }
    }
  }
}

/** Unique index or primary key violation (pg 23505) */
export class UniqueViolationError extends ConstraintViolationError {
  constructor(message: string, constraint?: string, cause?: unknown) {
    super(message, constraint, cause);
    this.name = "UniqueViolationError";
  }
}

/** Foreign key violation (pg 23503), on insert, update, or delete */
export class ForeignKeyViolationError extends ConstraintViolationError {
  constructor(message: string, constraint?: string, cause?: unknown) {
    super(message, constraint, cause);
    this.name = "ForeignKeyViolationError";
  }
}

/** NOT NULL violation (pg 23502); the offending column is in `column` */
export class NotNullViolationError extends ConstraintViolationError {
  constructor(message: string, constraint?: string, cause?: unknown) {
    super(message, constraint, cause);
    this.name = "NotNullViolationError";
  }
}

/** CHECK constraint violation (pg 23514) */
export class CheckViolationError extends ConstraintViolationError {
  constructor(message: string, constraint?: string, cause?: unknown) {
    super(message, constraint, cause);
    this.name = "CheckViolationError";
  }
}

type ViolationClass = new (
  message: string,
  constraint?: string,
  cause?: unknown,
) => ConstraintViolationError;

const VIOLATION_CLASSES = new Map<string, ViolationClass>([
  ["23505", UniqueViolationError],
  ["23503", ForeignKeyViolationError],
  ["23502", NotNullViolationError],
  ["23514", CheckViolationError],
]);

/**
 * Wraps pg constraint errors (unique, foreign key, not null, check) in the
 * matching ConstraintViolationError subclass; returns every other error unchanged.
 */
export function translateDbError(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return error;
  }
  const Violation = VIOLATION_CLASSES.get(
    String((error as { code: unknown }).code),
  );
  if (!Violation) return error;
  const pgError = error as { message?: string; constraint?: string };
  return new Violation(
    pgError.message ?? "Constraint violation",
    pgError.constraint,
    error,
  );
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
