import { describe, it, expect } from "vitest";
import pg from "pg";
import { registerPgTypeParsers } from "@/db/utils/pg-types";

describe("registerPgTypeParsers", () => {
  it("parses int8 text values as BigInt", () => {
    registerPgTypeParsers();
    const parse = pg.types.getTypeParser(20, "text");
    expect(parse("9007199254740993")).toBe(9007199254740993n);
  });

  it("keeps date columns as the YYYY-MM-DD string Postgres sent", () => {
    registerPgTypeParsers();
    const parse = pg.types.getTypeParser(1082, "text");
    expect(parse("2026-07-18")).toBe("2026-07-18");
  });

  it("is idempotent", () => {
    registerPgTypeParsers();
    registerPgTypeParsers();
    expect(pg.types.getTypeParser(1082, "text")("2026-01-01")).toBe(
      "2026-01-01",
    );
  });
});
