import type {
  DatabaseSchema,
  TableInfo,
  ColumnInfo,
  EnumTypeInfo,
} from "../types";
import * as schema from "@/db/schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import { PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";

// ============================================================================
// Column type → PostgreSQL UDT name mapping
// ============================================================================

const COLUMN_TYPE_TO_UDT: Record<string, string> = {
  PgSerial: "int4",
  PgInteger: "int4",
  PgSmallInt: "int2",
  PgBigInt53: "int8",
  PgBigInt64: "int8",
  PgText: "text",
  PgBoolean: "bool",
  PgUUID: "uuid",
  PgJsonb: "jsonb",
  PgJson: "json",
  PgDate: "date",
  PgDateString: "date",
  PgVarchar: "varchar",
  PgReal: "float4",
  PgDoublePrecision: "float8",
  PgInet: "inet",
  PgNumeric: "numeric",
  // PgTimestamp handled separately (withTimezone affects UDT name)
  // PgEnumColumn handled separately (uses enum type name as UDT)
};

const COLUMN_TYPE_TO_DATA_TYPE: Record<string, string> = {
  PgSerial: "integer",
  PgInteger: "integer",
  PgSmallInt: "smallint",
  PgBigInt53: "bigint",
  PgBigInt64: "bigint",
  PgText: "text",
  PgBoolean: "boolean",
  PgUUID: "uuid",
  PgJsonb: "jsonb",
  PgJson: "json",
  PgDate: "date",
  PgDateString: "date",
  PgVarchar: "character varying",
  PgReal: "real",
  PgDoublePrecision: "double precision",
  PgInet: "inet",
  PgNumeric: "numeric",
};

// ============================================================================
// Main export
// ============================================================================

export type SchemaModule = Record<string, unknown>;

export function readSchemaFromDrizzle(
  schemaModule: SchemaModule = schema,
): DatabaseSchema {
  const enums = extractEnums(schemaModule);
  const tables = extractTables(schemaModule);
  return { tables, enums };
}

// ============================================================================
// Enum extraction
// ============================================================================

function extractEnums(schemaModule: SchemaModule): EnumTypeInfo[] {
  const enums: EnumTypeInfo[] = [];

  for (const value of Object.values(schemaModule)) {
    // pgEnum returns a function with enumName and enumValues properties
    if (
      value &&
      typeof value === "function" &&
      "enumName" in value &&
      "enumValues" in value
    ) {
      enums.push({
        typeName: (value as any).enumName as string,
        values: [...((value as any).enumValues as readonly string[])],
      });
    }
  }

  return enums;
}

// ============================================================================
// Table extraction
// ============================================================================

function extractTables(schemaModule: SchemaModule): TableInfo[] {
  const tables: TableInfo[] = [];

  for (const value of Object.values(schemaModule)) {
    if (!is(value, PgTable)) continue;

    const config = getTableConfig(value as any);
    const columns: ColumnInfo[] = [];

    // Build sets of PK and unique columns from table-level constraints
    const pkColumnNames = new Set<string>();
    const uniqueColumnNames = new Set<string>();
    const compositeUniques: string[][] = [];

    // A unique group identifies a row only as a whole: single-column groups
    // mark the column unique, multi-column groups are kept together so they
    // never degrade into per-column identifiers.
    const seenCompositeKeys = new Set<string>();
    const addUniqueGroup = (groupColumns: string[]) => {
      if (groupColumns.length === 1) {
        uniqueColumnNames.add(groupColumns[0]);
        return;
      }
      if (groupColumns.length === 0) return;
      const key = [...groupColumns].sort().join(",");
      if (seenCompositeKeys.has(key)) return;
      seenCompositeKeys.add(key);
      compositeUniques.push(groupColumns);
    };

    // Composite primary keys from primaryKey({...}) calls
    for (const pk of config.primaryKeys) {
      for (const col of pk.columns) {
        pkColumnNames.add(col.name);
      }
    }

    // A unique group duplicating the composite PK adds no new identifier
    if (pkColumnNames.size > 0) {
      seenCompositeKeys.add([...pkColumnNames].sort().join(","));
    }

    // Composite unique constraints from unique({...}) calls
    for (const uq of config.uniqueConstraints) {
      addUniqueGroup(uq.columns.map((col) => col.name));
    }

    // Unique indexes from uniqueIndex() calls
    for (const idx of config.indexes) {
      const idxConfig = (idx as any).config;
      if (!idxConfig?.unique) continue;

      // Partial unique indexes only enforce uniqueness on a row subset,
      // so their columns cannot identify arbitrary rows
      if (idxConfig.where) continue;

      const idxColumns = idxConfig.columns;
      if (!Array.isArray(idxColumns)) continue;

      const names = idxColumns.map((col: any) => col?.name);
      // Indexes over SQL expressions have no plain column set to identify by
      if (names.some((name: unknown) => typeof name !== "string")) continue;

      addUniqueGroup(names as string[]);
    }

    // Process each column
    for (const col of config.columns) {
      const columnInfo = mapColumn(col, pkColumnNames, uniqueColumnNames);
      columns.push(columnInfo);
    }

    tables.push({ tableName: config.name, columns, compositeUniques });
  }

  return tables;
}

// ============================================================================
// Column mapping
// ============================================================================

function mapColumn(
  col: any,
  pkColumnNames: Set<string>,
  uniqueColumnNames: Set<string>,
): ColumnInfo {
  const columnType: string = col.columnType;
  const columnName: string = col.name;

  // Determine dataType and udtName
  let dataType: string;
  let udtName: string;

  if (columnType === "PgTimestamp") {
    const withTimezone = col.withTimezone ?? false;
    dataType = withTimezone
      ? "timestamp with time zone"
      : "timestamp without time zone";
    udtName = withTimezone ? "timestamptz" : "timestamp";
  } else if (columnType === "PgEnumColumn") {
    dataType = "USER-DEFINED";
    // Access the enum name through the column's enum reference
    udtName = col.enum?.enumName ?? "unknown";
  } else {
    const mappedDataType = COLUMN_TYPE_TO_DATA_TYPE[columnType];
    const mappedUdt = COLUMN_TYPE_TO_UDT[columnType];
    if (!mappedDataType || !mappedUdt) {
      throw new Error(
        `No PostgreSQL type mapping for Drizzle column type "${columnType}" (column "${columnName}"); add it to COLUMN_TYPE_TO_UDT and COLUMN_TYPE_TO_DATA_TYPE in scripts/db/schema/drizzle-reader.ts`,
      );
    }
    dataType = mappedDataType;
    udtName = mappedUdt;
  }

  // Determine isPrimaryKey:
  // - inline .primaryKey() sets col.primary
  // - composite primaryKey() is tracked in pkColumnNames
  const isPrimaryKey = col.primary || pkColumnNames.has(columnName);

  // Determine isUnique:
  // - inline .unique() sets col.isUnique
  // - composite unique constraints/indexes tracked in uniqueColumnNames
  const isUnique = col.isUnique || uniqueColumnNames.has(columnName);

  // Drizzle sets hasDefault for serial, identity, and .default() columns.
  // GENERATED ALWAYS columns (stored expressions, always-identity) reject
  // explicit values on insert and update, so they are excluded from Create
  // and Update instead of being treated as defaulted.
  const hasDefault: boolean = col.hasDefault;
  const isGenerated =
    col.generated != null || col.generatedIdentity?.type === "always";

  // Determine isNullable
  const isNullable = !col.notNull;

  // Numeric precision/scale (for numeric type columns)
  let numericPrecision: number | null = null;
  let numericScale: number | null = null;
  if (columnType === "PgNumeric") {
    numericPrecision = col.precision ?? null;
    numericScale = col.scale ?? null;
  }

  return {
    columnName,
    dataType,
    udtName,
    isNullable,
    isPrimaryKey,
    isUnique,
    hasDefault,
    isGenerated,
    numericPrecision,
    numericScale,
  };
}
