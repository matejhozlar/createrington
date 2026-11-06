import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

const GRANTS_SQL = fs.readFileSync(
  fileURLToPath(
    new URL(
      "../../../../../../docker/db/claude-readonly-role.sql",
      import.meta.url,
    ),
  ),
  "utf-8",
);

const SENSITIVE_COLUMN = /token|secret|password|ip_address|user_agent|^stripe_/;

const tables = new Map(
  Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => {
      const config = getTableConfig(table as PgTable);
      return [config.name, config.columns.map((column) => column.name)];
    }),
);

const statements = GRANTS_SQL.replace(/--.*$/gm, "")
  .split(";")
  .map((statement) => statement.replace(/\s+/g, " ").trim())
  .filter(Boolean);

const revokedTables = new Set(
  statements.flatMap((statement) => {
    const match = /^REVOKE SELECT ON (\w+) FROM claude_readonly$/.exec(
      statement,
    );
    return match ? [match[1]] : [];
  }),
);

const columnGrants = new Map(
  statements.flatMap((statement) => {
    const match = /^GRANT SELECT \(([^)]+)\) ON (\w+) TO claude_readonly$/.exec(
      statement,
    );
    return match
      ? [[match[2], match[1].split(",").map((column) => column.trim())]]
      : [];
  }),
);

function visibleColumns(table: string, columns: string[]): string[] {
  if (!revokedTables.has(table)) return columns;
  return columnGrants.get(table) ?? [];
}

describe("claude_readonly grants", () => {
  it("parses the grants file", () => {
    expect(tables.size).toBeGreaterThan(0);
    expect(revokedTables.has("auth_session")).toBe(true);
  });

  it("hides every token, secret, IP, user agent and Stripe column", () => {
    const exposed = [...tables].flatMap(([table, columns]) =>
      visibleColumns(table, columns)
        .filter((column) => SENSITIVE_COLUMN.test(column))
        .map((column) => `${table}.${column}`),
    );

    expect(exposed).toEqual([]);
  });

  it("only revokes tables that exist in the schema", () => {
    const unknown = [...revokedTables].filter((table) => !tables.has(table));

    expect(unknown).toEqual([]);
  });

  it("only grants columns that exist on revoked tables", () => {
    const invalid = [...columnGrants].flatMap(([table, columns]) => {
      if (!revokedTables.has(table)) return [`${table} (not revoked)`];
      const known = tables.get(table) ?? [];
      return columns
        .filter((column) => !known.includes(column))
        .map((column) => `${table}.${column}`);
    });

    expect(invalid).toEqual([]);
  });
});
