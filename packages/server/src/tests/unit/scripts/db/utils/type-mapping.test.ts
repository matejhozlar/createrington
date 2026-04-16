import { describe, it, expect } from "vitest";
import {
  pgTypeToTsType,
  getNumericComment,
} from "@/scripts/db/utils/type-mapping";
import type { EnumTypeInfo } from "@/scripts/db/types";

describe("pgTypeToTsType", () => {
  describe("primitive types", () => {
    it.each([
      ["int2", "number"],
      ["int4", "number"],
      ["int8", "bigint"],
      ["float4", "number"],
      ["float8", "number"],
      ["text", "string"],
      ["varchar", "string"],
      ["bpchar", "string"],
      ["uuid", "string"],
      ["bool", "boolean"],
      ["timestamp", "Date"],
      ["timestamptz", "Date"],
      ["date", "Date"],
      ["json", "Record<string, any>"],
      ["jsonb", "Record<string, any>"],
    ])("maps non-nullable %s → %s", (udt, expected) => {
      expect(pgTypeToTsType(udt, false, null, null)).toBe(expected);
    });

    it("appends ' | null' for nullable columns", () => {
      expect(pgTypeToTsType("int4", true, null, null)).toBe("number | null");
      expect(pgTypeToTsType("text", true, null, null)).toBe("string | null");
    });

    it("falls back to 'any' for unknown PG types", () => {
      expect(pgTypeToTsType("mystery_type", false, null, null)).toBe("any");
      expect(pgTypeToTsType("mystery_type", true, null, null)).toBe(
        "any | null",
      );
    });
  });

  describe("numeric types", () => {
    it("uses 'string' when scale > 0 (decimals would lose precision)", () => {
      expect(pgTypeToTsType("numeric", false, 10, 2)).toBe("string");
      expect(pgTypeToTsType("numeric", false, 5, 1)).toBe("string");
    });

    it("uses 'string' when precision > 15 (exceeds JS safe integer range)", () => {
      expect(pgTypeToTsType("numeric", false, 18, 0)).toBe("string");
      expect(pgTypeToTsType("numeric", false, 20, 0)).toBe("string");
    });

    it("uses 'number' when precision is within safe range and scale is 0", () => {
      expect(pgTypeToTsType("numeric", false, 10, 0)).toBe("number");
      expect(pgTypeToTsType("numeric", false, 15, 0)).toBe("number");
    });

    it("defaults to 'number' when precision and scale are null", () => {
      expect(pgTypeToTsType("numeric", false, null, null)).toBe("number");
    });

    it("composes nullability with numeric precision rules", () => {
      expect(pgTypeToTsType("numeric", true, 10, 2)).toBe("string | null");
      expect(pgTypeToTsType("numeric", true, 10, 0)).toBe("number | null");
    });
  });

  describe("enum types", () => {
    const enums: EnumTypeInfo[] = [
      { typeName: "ticket_status", values: ["open", "closed"] },
      { typeName: "auth_role", values: ["admin", "user"] },
    ];

    it("maps to PascalCase TS name when udtName matches a known enum", () => {
      expect(pgTypeToTsType("ticket_status", false, null, null, enums)).toBe(
        "TicketStatus",
      );
      expect(pgTypeToTsType("auth_role", false, null, null, enums)).toBe(
        "AuthRole",
      );
    });

    it("appends nullability to enum mappings", () => {
      expect(pgTypeToTsType("ticket_status", true, null, null, enums)).toBe(
        "TicketStatus | null",
      );
    });

    it("falls back to standard mapping when udtName isn't in the enums list", () => {
      expect(pgTypeToTsType("int4", false, null, null, enums)).toBe("number");
    });
  });
});

describe("getNumericComment", () => {
  it("formats numeric precision/scale into a trailing comment", () => {
    expect(getNumericComment("numeric", 10, 2)).toBe(" // numeric(10, 2)");
    expect(getNumericComment("numeric", 18, 0)).toBe(" // numeric(18, 0)");
  });

  it("returns an empty string for non-numeric types", () => {
    expect(getNumericComment("int4", 10, 2)).toBe("");
    expect(getNumericComment("text", null, null)).toBe("");
  });

  it("returns an empty string when precision or scale is null", () => {
    expect(getNumericComment("numeric", null, 2)).toBe("");
    expect(getNumericComment("numeric", 10, null)).toBe("");
    expect(getNumericComment("numeric", null, null)).toBe("");
  });
});
