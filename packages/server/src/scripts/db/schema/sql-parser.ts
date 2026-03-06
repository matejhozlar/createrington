import fs from "node:fs";
import path from "node:path";
import type {
  TableInfo,
  ColumnInfo,
  EnumTypeInfo,
  DatabaseSchema,
} from "../types";

// --- Constants ---

const SQL_TYPE_TO_UDT: Record<string, string> = {
  integer: "int4",
  smallint: "int2",
  bigint: "int8",
  text: "text",
  boolean: "bool",
  uuid: "uuid",
  "timestamp with time zone": "timestamptz",
  "timestamp without time zone": "timestamp",
  jsonb: "jsonb",
  json: "json",
  date: "date",
  "character varying": "varchar",
  "double precision": "float8",
  real: "float4",
  inet: "inet",
};

// Ordered longest-first for matching
const MULTI_WORD_TYPES = [
  "timestamp with time zone",
  "timestamp without time zone",
  "character varying",
  "double precision",
];

// --- Main export ---

export function readSchemaFromSqlFiles(dbDir: string): DatabaseSchema {
  const typesDir = path.join(dbDir, "types");
  const tablesDir = path.join(dbDir, "tables");

  const enums = parseEnumFiles(typesDir);
  const enumTypeNames = new Set(enums.map((e) => e.typeName));
  const tables = parseTableFiles(tablesDir, enumTypeNames);

  return { tables, enums };
}

// --- Enum parsing ---

function parseEnumFiles(typesDir: string): EnumTypeInfo[] {
  const files = fs
    .readdirSync(typesDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const enums: EnumTypeInfo[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(typesDir, file), "utf-8");
    const match = content.match(
      /CREATE TYPE public\.(\w+) AS ENUM \(\s*([\s\S]*?)\)/,
    );
    if (!match) continue;

    const typeName = match[1];
    const valuesStr = match[2];
    const values = [...valuesStr.matchAll(/'([^']+)'/g)].map((m) => m[1]);

    enums.push({ typeName, values });
  }

  return enums;
}

// --- Table parsing ---

function parseTableFiles(
  tablesDir: string,
  enumTypeNames: Set<string>,
): TableInfo[] {
  const files = fs
    .readdirSync(tablesDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const tables: TableInfo[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(tablesDir, file), "utf-8");
    const table = parseTableFile(content, enumTypeNames);
    if (table) tables.push(table);
  }

  return tables;
}

function parseTableFile(
  content: string,
  enumTypeNames: Set<string>,
): TableInfo | null {
  // Match CREATE TABLE (handle both \n and \r\n line endings)
  const tableMatch = content.match(
    /CREATE TABLE public\.(\w+) \(\r?\n([\s\S]*?)\r?\n\);/,
  );
  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const body = tableMatch[2];

  // Split body into definitions using parenthesis-aware splitting
  const definitions = splitDefinitions(body);

  // Parse columns (skip CONSTRAINT lines)
  const columns: ColumnInfo[] = [];
  for (const def of definitions) {
    const col = parseColumnDefinition(def, enumTypeNames);
    if (col) columns.push(col);
  }

  // Parse constraints from ALTER TABLE statements
  const primaryKeys = parsePrimaryKeys(content);
  const uniqueKeys = parseUniqueKeys(content);
  const alterDefaults = parseAlterDefaults(content, tableName);
  const identityColumns = parseIdentityColumns(content, tableName);

  // Apply constraint flags to columns
  for (const col of columns) {
    if (primaryKeys.has(col.columnName)) col.isPrimaryKey = true;
    if (uniqueKeys.has(col.columnName)) col.isUnique = true;
    if (alterDefaults.has(col.columnName)) col.hasDefault = true;
    if (identityColumns.has(col.columnName)) col.hasDefault = true;
  }

  return { tableName, columns };
}

// --- Column definition splitting ---

function splitDefinitions(body: string): string[] {
  const definitions: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of body) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      definitions.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    definitions.push(current.trim());
  }

  return definitions;
}

// --- Column parsing ---

function parseColumnDefinition(
  def: string,
  enumTypeNames: Set<string>,
): ColumnInfo | null {
  // Normalize whitespace
  const normalized = def.replace(/\s+/g, " ").trim();

  // Skip CONSTRAINT lines
  if (normalized.toUpperCase().startsWith("CONSTRAINT")) return null;

  // Extract column name (first word)
  const nameMatch = normalized.match(/^(\w+)\s+(.+)/);
  if (!nameMatch) return null;

  const columnName = nameMatch[1];
  let rest = nameMatch[2];

  // Check for GENERATED ALWAYS AS
  const isGenerated = /GENERATED ALWAYS AS/i.test(rest);

  let sqlType: string;
  let udtName: string;
  let numericPrecision: number | null = null;
  let numericScale: number | null = null;
  let dataType: string;

  if (isGenerated) {
    // For generated columns, extract the base type before GENERATED
    const genMatch = rest.match(/^(.+?)\s+GENERATED ALWAYS AS/i);
    if (!genMatch) return null;
    const typeStr = genMatch[1].trim();
    const extracted = extractColumnType(typeStr, enumTypeNames);
    sqlType = extracted.sqlType;
    udtName = extracted.udtName;
    numericPrecision = extracted.numericPrecision;
    numericScale = extracted.numericScale;
    dataType = extracted.dataType;
  } else {
    const extracted = extractColumnType(rest, enumTypeNames);
    sqlType = extracted.sqlType;
    udtName = extracted.udtName;
    rest = extracted.remainder;
    numericPrecision = extracted.numericPrecision;
    numericScale = extracted.numericScale;
    dataType = extracted.dataType;
  }

  // Detect NOT NULL and DEFAULT
  // For generated columns, only check the part before GENERATED to avoid
  // false positives from NOT NULL inside CASE expressions
  let checkStr: string;
  if (isGenerated) {
    const genIdx = rest.toUpperCase().indexOf("GENERATED ALWAYS AS");
    checkStr = rest.slice(0, genIdx);
  } else {
    checkStr = rest;
  }
  const isNullable = !checkStr.toUpperCase().includes("NOT NULL");
  const hasDefault = !isGenerated && /DEFAULT\s/i.test(checkStr);

  return {
    columnName,
    dataType,
    udtName,
    isNullable,
    isPrimaryKey: false,
    isUnique: false,
    hasDefault: isGenerated ? false : hasDefault,
    numericPrecision,
    numericScale,
  };
}

// --- Type extraction ---

function extractColumnType(
  rest: string,
  enumTypeNames: Set<string>,
): {
  sqlType: string;
  udtName: string;
  dataType: string;
  remainder: string;
  numericPrecision: number | null;
  numericScale: number | null;
} {
  const restLower = rest.toLowerCase();

  // 1. Try multi-word types (longest first)
  for (const multiType of MULTI_WORD_TYPES) {
    if (restLower.startsWith(multiType)) {
      let consumed = multiType.length;
      // Consume optional (N) suffix for character varying
      if (multiType === "character varying") {
        const afterType = rest.slice(consumed);
        const lenMatch = afterType.match(/^\(\d+\)/);
        if (lenMatch) consumed += lenMatch[0].length;
      }
      return {
        sqlType: multiType,
        udtName: SQL_TYPE_TO_UDT[multiType],
        dataType: multiType,
        remainder: rest.slice(consumed),
        numericPrecision: null,
        numericScale: null,
      };
    }
  }

  // 2. Try public.enum_name
  const enumMatch = rest.match(/^public\.(\w+)/);
  if (enumMatch && enumTypeNames.has(enumMatch[1])) {
    return {
      sqlType: `public.${enumMatch[1]}`,
      udtName: enumMatch[1],
      dataType: "USER-DEFINED",
      remainder: rest.slice(enumMatch[0].length),
      numericPrecision: null,
      numericScale: null,
    };
  }

  // 3. Single-word type
  const singleMatch = rest.match(/^(\w+)(\([^)]+\))?\s*/);
  if (!singleMatch) {
    return {
      sqlType: rest,
      udtName: rest.toLowerCase(),
      dataType: rest,
      remainder: "",
      numericPrecision: null,
      numericScale: null,
    };
  }

  const typeName = singleMatch[1].toLowerCase();
  const suffix = singleMatch[2] || "";
  let precision: number | null = null;
  let scale: number | null = null;

  // Handle numeric(P,S)
  if (typeName === "numeric" && suffix) {
    const psMatch = suffix.match(/^\((\d+),\s*(\d+)\)/);
    if (psMatch) {
      precision = parseInt(psMatch[1], 10);
      scale = parseInt(psMatch[2], 10);
    }
  }

  const udtName = SQL_TYPE_TO_UDT[typeName] || typeName;
  const dataType = SQL_TYPE_TO_UDT[typeName] ? typeName : typeName;

  return {
    sqlType: typeName,
    udtName,
    dataType,
    remainder: rest.slice(singleMatch[0].length),
    numericPrecision: precision,
    numericScale: scale,
  };
}

// --- Constraint parsing ---

function parsePrimaryKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const matches = content.matchAll(
    /ADD CONSTRAINT \w+ PRIMARY KEY \(([^)]+)\)/g,
  );
  for (const match of matches) {
    for (const col of match[1].split(",")) {
      keys.add(col.trim());
    }
  }
  return keys;
}

function parseUniqueKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const matches = content.matchAll(/ADD CONSTRAINT \w+ UNIQUE \(([^)]+)\)/g);
  for (const match of matches) {
    for (const col of match[1].split(",")) {
      keys.add(col.trim());
    }
  }
  return keys;
}

function parseAlterDefaults(content: string, tableName: string): Set<string> {
  const cols = new Set<string>();
  const regex = new RegExp(
    `ALTER TABLE ONLY public\\.${tableName} ALTER COLUMN (\\w+) SET DEFAULT`,
    "g",
  );
  for (const match of content.matchAll(regex)) {
    cols.add(match[1]);
  }
  return cols;
}

function parseIdentityColumns(
  content: string,
  tableName: string,
): Set<string> {
  const cols = new Set<string>();
  const regex = new RegExp(
    `ALTER TABLE public\\.${tableName} ALTER COLUMN (\\w+) ADD GENERATED ALWAYS AS IDENTITY`,
    "g",
  );
  for (const match of content.matchAll(regex)) {
    cols.add(match[1]);
  }
  return cols;
}
