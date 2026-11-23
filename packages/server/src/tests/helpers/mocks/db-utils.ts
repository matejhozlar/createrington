class DatabaseError extends Error {}
class NotFoundError extends DatabaseError {}
class QueryError extends DatabaseError {}
class ConstraintViolationError extends DatabaseError {}
class UniqueViolationError extends ConstraintViolationError {}

export const dbUtilsMock = () => ({
  DatabaseError,
  NotFoundError,
  QueryError,
  ConstraintViolationError,
  UniqueViolationError,
});
