import { describe, it, expect } from "vitest";
import {
  DatabaseError,
  NotFoundError,
  ConstraintViolationError,
  UniqueViolationError,
  ForeignKeyViolationError,
  NotNullViolationError,
  CheckViolationError,
  QueryError,
  translateDbError,
} from "@/db/utils/errors";

describe("DatabaseError", () => {
  it("sets the message and name", () => {
    const err = new DatabaseError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
    expect(err.name).toBe("DatabaseError");
  });

  it("preserves the optional cause", () => {
    const cause = new Error("inner");
    const err = new DatabaseError("wrapper", cause);
    expect(err.cause).toBe(cause);
  });

  it("defaults cause to undefined when not provided", () => {
    expect(new DatabaseError("boom").cause).toBeUndefined();
  });

  it("captures a stack trace", () => {
    const err = new DatabaseError("boom");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("DatabaseError");
  });
});

describe("NotFoundError", () => {
  it("formats a single-key criteria object", () => {
    const err = new NotFoundError("Player", { id: 42 });
    expect(err.message).toBe("Player not found with id: 42");
    expect(err.name).toBe("NotFoundError");
  });

  it("formats multi-key criteria objects with comma separation", () => {
    const err = new NotFoundError("Player", {
      discordId: "123",
      minecraftUuid: "abc",
    });
    expect(err.message).toBe(
      "Player not found with discordId: 123, minecraftUuid: abc",
    );
  });

  it("preserves the entityName and criteria fields", () => {
    const criteria = { id: 1 };
    const err = new NotFoundError("Ticket", criteria);
    expect(err.entityName).toBe("Ticket");
    expect(err.criteria).toBe(criteria);
  });

  it("is a DatabaseError subclass", () => {
    const err = new NotFoundError("X", { id: 1 });
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err).toBeInstanceOf(Error);
  });

  it("formats null and undefined values verbatim", () => {
    const err = new NotFoundError("Row", { foo: null, bar: undefined });
    expect(err.message).toBe("Row not found with foo: null, bar: undefined");
  });
});

describe("ConstraintViolationError", () => {
  it("sets the message and name", () => {
    const err = new ConstraintViolationError("unique violation");
    expect(err.message).toBe("unique violation");
    expect(err.name).toBe("ConstraintViolationError");
  });

  it("preserves the optional constraint name", () => {
    const err = new ConstraintViolationError(
      "duplicate key",
      "players_pkey",
      new Error("pg error"),
    );
    expect(err.constraint).toBe("players_pkey");
    expect(err.cause).toBeInstanceOf(Error);
  });

  it("is a DatabaseError subclass", () => {
    expect(new ConstraintViolationError("x")).toBeInstanceOf(DatabaseError);
  });

  it("copies the pg error code from the cause", () => {
    const pgError = Object.assign(new Error("duplicate key"), {
      code: "23505",
    });
    const err = new ConstraintViolationError("dup", undefined, pgError);
    expect(err.code).toBe("23505");
  });
});

describe("translateDbError", () => {
  it("wraps pg unique violations in UniqueViolationError", () => {
    const pgError = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "workshop_slug"',
      ),
      { code: "23505", constraint: "workshop_slug" },
    );
    const result = translateDbError(pgError);
    expect(result).toBeInstanceOf(UniqueViolationError);
    expect(result).toBeInstanceOf(ConstraintViolationError);
    const wrapped = result as UniqueViolationError;
    expect(wrapped.name).toBe("UniqueViolationError");
    expect(wrapped.constraint).toBe("workshop_slug");
    expect(wrapped.code).toBe("23505");
    expect(wrapped.cause).toBe(pgError);
  });

  it("wraps pg foreign key violations in ForeignKeyViolationError", () => {
    const pgError = Object.assign(new Error("fk violation"), {
      code: "23503",
      constraint: "modpack_server_id_server_id_fk",
    });
    const result = translateDbError(pgError);
    expect(result).toBeInstanceOf(ForeignKeyViolationError);
    expect(result).toBeInstanceOf(ConstraintViolationError);
    expect(result).not.toBeInstanceOf(UniqueViolationError);
    expect((result as ForeignKeyViolationError).constraint).toBe(
      "modpack_server_id_server_id_fk",
    );
  });

  it("wraps pg not-null violations in NotNullViolationError with the column", () => {
    const pgError = Object.assign(new Error("null value in column"), {
      code: "23502",
      column: "name",
    });
    const result = translateDbError(pgError);
    expect(result).toBeInstanceOf(NotNullViolationError);
    expect((result as NotNullViolationError).column).toBe("name");
    expect((result as NotNullViolationError).constraint).toBeUndefined();
  });

  it("wraps pg check violations in CheckViolationError", () => {
    const pgError = Object.assign(new Error("check violation"), {
      code: "23514",
      constraint: "chk_session_end_after_start",
    });
    expect(translateDbError(pgError)).toBeInstanceOf(CheckViolationError);
  });

  it("returns other pg errors unchanged", () => {
    const syntaxError = Object.assign(new Error("syntax error"), {
      code: "42601",
    });
    expect(translateDbError(syntaxError)).toBe(syntaxError);
  });

  it("does not resolve codes through the object prototype", () => {
    for (const code of ["constructor", "toString", "__proto__"]) {
      const err = Object.assign(new Error("odd code"), { code });
      expect(translateDbError(err)).toBe(err);
    }
  });

  it("returns non-object errors unchanged", () => {
    expect(translateDbError("boom")).toBe("boom");
    expect(translateDbError(null)).toBe(null);
  });
});

describe("QueryError", () => {
  it("sets the message and name", () => {
    const err = new QueryError("syntax error");
    expect(err.message).toBe("syntax error");
    expect(err.name).toBe("QueryError");
  });

  it("preserves the optional query text and cause", () => {
    const cause = new Error("pg error");
    const err = new QueryError("bad query", "SELECT 1", cause);
    expect(err.query).toBe("SELECT 1");
    expect(err.cause).toBe(cause);
  });

  it("is a DatabaseError subclass", () => {
    expect(new QueryError("x")).toBeInstanceOf(DatabaseError);
  });
});
