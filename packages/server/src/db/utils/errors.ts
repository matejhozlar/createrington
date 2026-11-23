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

export function nullIfNotFound(error: unknown): null {
  if (error instanceof NotFoundError) return null;
  throw error;
}

export class ConstraintViolationError extends DatabaseError {
  readonly code?: string;
  readonly column?: string;

  constructor(
    message: string,
    public readonly constraint?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "ConstraintViolationError";
    if (typeof cause === "object" && cause !== null) {
      if ("code" in cause) this.code = String(cause.code);
      if ("column" in cause && typeof cause.column === "string") {
        this.column = (cause as { column: string }).column;
      }
    }
  }
}

export class UniqueViolationError extends ConstraintViolationError {
  constructor(message: string, constraint?: string, cause?: unknown) {
    super(message, constraint, cause);
    this.name = "UniqueViolationError";
  }
}

export class ForeignKeyViolationError extends ConstraintViolationError {
  constructor(message: string, constraint?: string, cause?: unknown) {
    super(message, constraint, cause);
    this.name = "ForeignKeyViolationError";
  }
}

export class NotNullViolationError extends ConstraintViolationError {
  constructor(message: string, constraint?: string, cause?: unknown) {
    super(message, constraint, cause);
    this.name = "NotNullViolationError";
  }
}

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

export function translateDbError(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return error;
  }
  const Violation = VIOLATION_CLASSES.get(String(error.code));
  if (!Violation) return error;
  const pgError = error as { message?: string; constraint?: string };
  return new Violation(
    pgError.message ?? "Constraint violation",
    pgError.constraint,
    error,
  );
}

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

function formatCriteria(criteria: Record<string, unknown>): string {
  return Object.entries(criteria)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}
