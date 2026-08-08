import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

function buildJsonColumnMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const exported of Object.values(schema)) {
    if (!is(exported, PgTable)) continue;
    const columns = new Set<string>();
    for (const column of Object.values(getTableColumns(exported))) {
      const sqlType = column.getSQLType();
      if (sqlType === "json" || sqlType === "jsonb") columns.add(column.name);
    }
    if (columns.size > 0) map.set(getTableName(exported), columns);
  }
  return map;
}

const jsonColumns = buildJsonColumnMap();

export function isJsonColumn(table: string, column: string): boolean {
  return jsonColumns.get(table)?.has(column) ?? false;
}
