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
	PgVarchar: "character varying",
	PgReal: "real",
	PgDoublePrecision: "double precision",
	PgInet: "inet",
	PgNumeric: "numeric",
};

// ============================================================================
// Main export
// ============================================================================

export function readSchemaFromDrizzle(): DatabaseSchema {
	const enums = extractEnums();
	const tables = extractTables();
	return { tables, enums };
}

// ============================================================================
// Enum extraction
// ============================================================================

function extractEnums(): EnumTypeInfo[] {
	const enums: EnumTypeInfo[] = [];

	for (const value of Object.values(schema)) {
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

function extractTables(): TableInfo[] {
	const tables: TableInfo[] = [];

	for (const value of Object.values(schema)) {
		if (!is(value, PgTable)) continue;

		const config = getTableConfig(value as any);
		const columns: ColumnInfo[] = [];

		// Build sets of PK and unique columns from table-level constraints
		const pkColumnNames = new Set<string>();
		const uniqueColumnNames = new Set<string>();

		// Composite primary keys from primaryKey({...}) calls
		for (const pk of config.primaryKeys) {
			for (const col of pk.columns) {
				pkColumnNames.add(col.name);
			}
		}

		// Composite unique constraints from unique({...}) calls
		for (const uq of config.uniqueConstraints) {
			for (const col of uq.columns) {
				uniqueColumnNames.add(col.name);
			}
		}

		// Unique indexes from uniqueIndex() calls
		for (const idx of config.indexes) {
			if ((idx as any).config?.unique) {
				const idxColumns = (idx as any).config?.columns;
				if (Array.isArray(idxColumns)) {
					for (const col of idxColumns) {
						if (col?.name) {
							uniqueColumnNames.add(col.name);
						}
					}
				}
			}
		}

		// Process each column
		for (const col of config.columns) {
			const columnInfo = mapColumn(col, pkColumnNames, uniqueColumnNames);
			columns.push(columnInfo);
		}

		tables.push({ tableName: config.name, columns });
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
		dataType = COLUMN_TYPE_TO_DATA_TYPE[columnType] || columnType;
		udtName = COLUMN_TYPE_TO_UDT[columnType] || columnType;
	}

	// Determine isPrimaryKey:
	// - inline .primaryKey() sets col.primary
	// - composite primaryKey() is tracked in pkColumnNames
	const isPrimaryKey = col.primary || pkColumnNames.has(columnName);

	// Determine isUnique:
	// - inline .unique() sets col.isUnique
	// - composite unique constraints/indexes tracked in uniqueColumnNames
	const isUnique = col.isUnique || uniqueColumnNames.has(columnName);

	// Determine hasDefault:
	// - Drizzle sets hasDefault for serial, identity, defaults, and generated columns
	// - SQL parser treats generated stored columns (GENERATED ALWAYS AS ... STORED)
	//   as hasDefault: false — we match that behavior
	const isGeneratedStored = col.generated != null && col.generated.type === "stored";
	const hasDefault = isGeneratedStored ? false : col.hasDefault;

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
		numericPrecision,
		numericScale,
	};
}
