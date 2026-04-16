import { describe, it, expect } from "vitest";
import {
  DatabaseError,
  NotFoundError,
  ConstraintViolationError,
  QueryError,
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
