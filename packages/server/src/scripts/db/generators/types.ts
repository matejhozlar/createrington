import type { TableInfo, ColumnInfo, EnumTypeInfo } from "../types";
import { snakeToPascal, snakeToCamel } from "../utils/naming";
import { pgTypeToTsType, getNumericComment } from "../utils/type-mapping";

/**
 * TypeScript type definitions generator for database tables
 *
 * This module generates comprehensive TypeScript type definitions for each
 * database table, including multiple representations optimized for different
 * use cases (database operations, application logic, API serialization).
 * It provides complete type safety across the entire data flow.
 */

/**
 * Generates complete TypeScript type definitions for a database table
 *
 * Creates a comprehensive set of type definitions that cover all aspects of
 * working with a database table, from raw database representations to
 * application-level entities, API data transfer objects, and query types.
 *
 * @param table - Complete table metadata including all columns and constraints
 * @returns Complete TypeScript source code containing all type definitions
 *
 * @remarks
 * Generated types:
 * 1. Row interface: Snake_case database representation (as stored in PostgreSQL)
 * 2. Entity type: CamelCase application representation (for TypeScript code)
 * 3. ApiData interface: Dates as ISO strings (for JSON serialization/API responses)
 * 4. Create interface: Fields required/optional for INSERT operations
 * 5. Identifier type: Valid identifiers for queries (primary keys, unique columns)
 * 6. Filters type: Type-safe filtering with operator support
 *
 * Type flow through application layers:
 * ```
 * Database (Row) → Application (Entity) → API (ApiData)
 *     ↓                     ↓                    ↓
 * snake_case           camelCase            camelCase + string dates
 * ```
 *
 * Design principles:
 * - Separation of concerns: Different types for different contexts
 * - Type safety: Compile-time validation of field names and types
 * - Nullability: Explicitly typed (T | null) for nullable columns
 * - Precision handling: Numeric types mapped to prevent JavaScript precision loss
 * - Automatic timestamps: created_at/updated_at treated specially
 *
 * @example
 * ```typescript
 * const table = {
 *   tableName: 'users',
 *   columns: [
 *     { columnName: 'id', udtName: 'int4', isPrimaryKey: true, isNullable: false, ... },
 *     { columnName: 'email', udtName: 'varchar', isUnique: true, isNullable: false, ... },
 *     { columnName: 'created_at', udtName: 'timestamptz', hasDefault: true, ... }
 *   ]
 * };
 * const types = generateTypes(table);
 * // Generates all type definitions for the users table
 * ```
 */
export function generateTypes(
  table: TableInfo,
  enums: EnumTypeInfo[] = [],
): string {
  const className = snakeToPascal(table.tableName);

  // Determine which enum types are used in this table
  const usedEnums = getUsedEnums(table, enums);
  const enumImports = generateEnumImports(usedEnums);

  return `import type { CamelCaseKeys } from "../";
${enumImports}
/**
 * Database representation of ${table.tableName} table
 * 
 * Raw database row with snake_case field names matching the PostgreSQL schema.
 * Use this type when working directly with database query results before
 * transformation to application entities.
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 */
${generateRowInterface(table, className, enums)}

/**
 * Application representation with camelCase field names
 * 
 * Transformed version of ${className}Row with camelCase property names for
 * idiomatic TypeScript code. Use this type in application logic, business
 * rules, and internal processing.
 */
${generateEntityType(className)}

/**
 * API representation with dates as ISO strings
 * 
 * Optimized for JSON serialization with Date fields converted to ISO string
 * format. Use this type for API responses, client-side data, and anywhere
 * JSON serialization occurs (Date objects don't serialize well to JSON).
 */
${generateApiDataType(table, className, enums)}

/**
 * Data required to create a new ${table.tableName} record
 * 
 * Defines which fields are required vs optional when inserting a new row.
 * Fields with defaults, auto-generated values (e.g., id, timestamps), or
 * nullable columns are marked optional.
 */
${generateCreateInterface(table, className, enums)}

/**
 * Valid identifiers for querying ${table.tableName}
 * 
 * Union type of all valid ways to uniquely identify a row in this table.
 * Includes primary key combinations and individual unique column identifiers.
 * Use this type when fetching, updating, or deleting specific records.
 */
${generateIdentifierType(table, className, enums)}

/**
 * Type-safe filters for querying ${table.tableName}
 * 
 * Allows filtering on any field with support for comparison operators,
 * pattern matching, and null checks. Each field accepts FilterValue<T>
 * which includes direct values and operator objects.
 */
${generateFiltersType(table, className)}
`;
}

/**
 * Determines which enum types are actually used in the table's columns
 */
function getUsedEnums(table: TableInfo, enums: EnumTypeInfo[]): EnumTypeInfo[] {
  const usedEnumTypes = new Set<string>();

  for (const col of table.columns) {
    const enumType = enums.find((e) => e.typeName === col.udtName);
    if (enumType) {
      usedEnumTypes.add(enumType.typeName);
    }
  }

  return enums.filter((e) => usedEnumTypes.has(e.typeName));
}

/**
 * Generates import statement for used enum types
 */
function generateEnumImports(usedEnums: EnumTypeInfo[]): string {
  if (usedEnums.length === 0) {
    return "";
  }

  const enumTypeNames = usedEnums.map((e) => snakeToPascal(e.typeName)).sort(); // Sort for consistent output

  return `import type { ${enumTypeNames.join(", ")} } from "./database.types";\n`;
}
/**
 * Generates API data interface with dates as ISO string format
 *
 * Creates a type definition optimized for JSON serialization where Date
 * objects are represented as ISO 8601 strings. This prevents serialization
 * issues and provides a consistent API contract.
 *
 * @param table - Table metadata with column information
 * @param className - PascalCase class name for the table
 * @returns TypeScript interface definition for API data
 *
 * @remarks
 * Key transformations:
 * - Date → string (ISO 8601 format assumed)
 * - snake_case → camelCase (for API consistency)
 * - Nullability preserved (T | null for nullable columns)
 * - Numeric precision comments retained
 *
 * Use cases:
 * - API response payloads
 * - Client-side TypeScript/JavaScript
 * - JSON serialization contexts
 * - External system integrations
 *
 * @example
 * ```typescript
 * // For a users table with created_at timestamp:
 * export interface UserApiData {
 *   id: number;
 *   email: string;
 *   createdAt: string;  // Date converted to string
 *   deletedAt: string | null;  // Nullable date
 * }
 *
 * // Usage in API endpoint:
 * app.get('/users/:id', async (req, res) => {
 *   const user = await db.users.findById(req.params.id);
 *   const apiData: UserApiData = {
 *     ...user,
 *     createdAt: user.createdAt.toISOString()
 *   };
 *   res.json(apiData);
 * });
 * ```
 */
function generateApiDataType(
  table: TableInfo,
  className: string,
  enums: EnumTypeInfo[] = [],
): string {
  const fields = table.columns.map((col) => {
    const camelName = snakeToCamel(col.columnName);
    let type = pgTypeToTsType(
      col.udtName,
      false, // Get base type without null
      col.numericPrecision,
      col.numericScale,
      enums,
    );

    // Convert Date to string for JSON serialization compatibility
    if (type === "Date") {
      type = "string";
    }

    // Add null union type if column is nullable
    if (col.isNullable) {
      type = `${type} | null`;
    }

    const comment = getNumericComment(
      col.udtName,
      col.numericPrecision,
      col.numericScale,
    );

    return `  ${camelName}: ${type};${comment}`;
  });

  return `export interface ${className}ApiData {
${fields.join("\n")}
}`;
}

/**
 * Generates the Row interface for raw database representation
 *
 * Creates a TypeScript interface matching the exact structure of database
 * rows as returned by pg queries. Uses snake_case field names to match
 * PostgreSQL column names exactly.
 *
 * @param table - Table metadata with column information
 * @param className - PascalCase class name for the table
 * @returns TypeScript interface definition for database rows
 *
 * @remarks
 * Interface characteristics:
 * - snake_case field names (matches PostgreSQL)
 * - Types mapped from PostgreSQL to TypeScript
 * - Explicit null unions for nullable columns
 * - Numeric precision documented in comments
 * - No optional fields (all database columns present)
 *
 * When to use:
 * - Immediately after database queries (before transformation)
 * - When writing to database (before INSERT/UPDATE)
 * - Type definitions for raw query result handlers
 * - Database migration validation
 *
 * @example
 * ```typescript
 * // Generated for a users table:
 * export interface UserRow {
 *   id: number;
 *   email_address: string;
 *   display_name: string | null;
 *   created_at: Date;
 *   balance: string;  // numeric(10, 2)
 * }
 *
 * // Usage with pg:
 * const result = await pool.query<UserRow>(
 *   'SELECT * FROM users WHERE id = $1',
 *   [userId]
 * );
 * const row: UserRow = result.rows[0];
 * ```
 */
function generateRowInterface(
  table: TableInfo,
  className: string,
  enums: EnumTypeInfo[] = [],
): string {
  const fields = table.columns.map((col) => {
    const type = pgTypeToTsType(
      col.udtName,
      col.isNullable,
      col.numericPrecision,
      col.numericScale,
      enums,
    );
    const comment = getNumericComment(
      col.udtName,
      col.numericPrecision,
      col.numericScale,
    );
    return `  ${col.columnName}: ${type};${comment}`;
  });

  return `export interface ${className}Row {
${fields.join("\n")}
}`;
}

/**
 * Generates the Entity type with camelCase field names
 *
 * Creates a type alias that transforms the Row interface to use camelCase
 * property names for idiomatic TypeScript code. This is the primary type
 * used in application logic.
 *
 * @param className - PascalCase class name for the table
 * @returns TypeScript type alias for the entity
 *
 * @remarks
 * Uses CamelCaseKeys utility type to automatically transform all field names
 * from snake_case to camelCase. This provides type safety while maintaining
 * clean, idiomatic TypeScript code.
 *
 * Transformation examples:
 * - user_id → userId
 * - created_at → createdAt
 * - email_address → emailAddress
 *
 * When to use:
 * - Application business logic
 * - Service layer operations
 * - Internal function parameters/returns
 * - State management (Redux, Zustand, etc.)
 *
 * @example
 * ```typescript
 * // Generated type:
 * export type User = CamelCaseKeys<UserRow>;
 *
 * // Results in:
 * // {
 * //   id: number;
 * //   emailAddress: string;
 * //   displayName: string | null;
 * //   createdAt: Date;
 * // }
 *
 * // Usage in application code:
 * function processUser(user: User) {
 *   console.log(user.emailAddress);  // camelCase!
 *   return user.createdAt.toISOString();
 * }
 * ```
 */
function generateEntityType(className: string): string {
  return `export type ${className} = CamelCaseKeys<${className}Row>;`;
}

/**
 * Generates the Create interface for INSERT operations
 *
 * Creates a TypeScript interface defining which fields are required versus
 * optional when creating a new database record. Intelligently determines
 * optionality based on database constraints and conventions.
 *
 * @param table - Table metadata with column information
 * @param className - PascalCase class name for the table
 * @returns TypeScript interface definition for create operations
 *
 * @remarks
 * Field optionality rules:
 * - Required: NOT NULL columns without defaults
 * - Optional: Nullable columns, columns with defaults, primary keys, timestamps
 *
 * Special handling:
 * - Primary keys: Optional (usually auto-generated)
 * - created_at/updated_at: Optional (database defaults)
 * - Columns with DEFAULT: Optional (database provides value)
 * - Nullable columns: Optional (can be omitted)
 *
 * Benefits:
 * - Compile-time validation of required fields
 * - IDE autocomplete for available fields
 * - Type-safe INSERT operations
 * - Prevents missing required data
 *
 * @example
 * ```typescript
 * // For a users table:
 * export interface UserCreate {
 *   // Required fields (NOT NULL, no default)
 *   email: string;
 *   username: string;
 *
 *   // Optional fields
 *   id?: number;              // Primary key (auto-generated)
 *   displayName?: string | null;  // Nullable
 *   role?: string;            // Has default value
 *   createdAt?: Date;         // Timestamp with default
 * }
 *
 * // Usage:
 * const newUser: UserCreate = {
 *   email: 'user@example.com',
 *   username: 'johndoe'
 *   // Other fields optional
 * };
 * await db.users.create(newUser);
 * ```
 */
function generateCreateInterface(
  table: TableInfo,
  className: string,
  enums: EnumTypeInfo[] = [],
): string {
  const { required, optional } = partitionCreateFields(table);

  const requiredFields = required.map((col) => {
    const type = pgTypeToTsType(
      col.udtName,
      false,
      col.numericPrecision,
      col.numericScale,
      enums,
    );
    return `  ${snakeToCamel(col.columnName)}: ${type};`;
  });

  const optionalFields = optional.map((col) => {
    const type = pgTypeToTsType(
      col.udtName,
      col.isNullable,
      col.numericPrecision,
      col.numericScale,
      enums,
    );
    return `  ${snakeToCamel(col.columnName)}?: ${type};`;
  });

  const allFields = [...requiredFields, ...optionalFields];

  return `export interface ${className}Create {
${allFields.join("\n")}
}`;
}

/**
 * Partitions table columns into required and optional for CREATE operations
 *
 * Analyzes column metadata to determine which fields should be required versus
 * optional when creating new records. Applies intelligent rules based on
 * database constraints and common conventions.
 *
 * @param table - Table metadata with all column information
 * @returns Object with separate arrays of required and optional columns
 *
 * @remarks
 * Required field criteria (all must be true):
 * - NOT NULL constraint
 * - NOT a primary key (usually auto-generated)
 * - NO DEFAULT value defined
 * - NOT a standard timestamp (created_at, updated_at)
 *
 * Optional field criteria (any must be true):
 * - Nullable (can be NULL)
 * - Primary key (auto-generated by database)
 * - Has DEFAULT value
 * - Standard timestamp field (auto-populated)
 *
 * @example
 * ```typescript
 * const table = {
 *   columns: [
 *     { columnName: 'id', isPrimaryKey: true, hasDefault: true },        // optional
 *     { columnName: 'email', isNullable: false, hasDefault: false },     // required
 *     { columnName: 'name', isNullable: true },                          // optional
 *     { columnName: 'created_at', hasDefault: true },                    // optional
 *   ]
 * };
 * const { required, optional } = partitionCreateFields(table);
 * // required: [email]
 * // optional: [id, name, created_at]
 * ```
 */
function partitionCreateFields(table: TableInfo) {
  const required = table.columns.filter(
    (col) =>
      !col.isNullable &&
      !col.isPrimaryKey &&
      !col.hasDefault &&
      !["created_at", "updated_at"].includes(col.columnName),
  );

  const optional = table.columns.filter(
    (col) =>
      col.isNullable ||
      col.isPrimaryKey ||
      col.hasDefault ||
      ["created_at", "updated_at"].includes(col.columnName),
  );

  return { required, optional };
}

/**
 * Extracts identifier field groups in camelCase from table metadata
 *
 * Each group is a set of fields that uniquely identifies a row only when
 * ALL of them are provided together. Mirrors the members of the generated
 * Identifier union type.
 *
 * @param table - Table metadata with column information
 * @returns Array of camelCase field-name groups that are valid identifiers
 *
 * @remarks
 * Group sources (in order):
 * 1. Primary key columns as one group (may be composite)
 * 2. Composite unique index/constraint groups
 * 3. Single-column uniques, one group each (excluding PKs)
 * 4. Fallback to [['id']] if no identifiers found
 *
 * Used by:
 * - Base query class IDENTIFIER_GROUPS
 * - extractIdentifier() method validation
 *
 * @example
 * ```typescript
 * const table = {
 *   columns: [
 *     { columnName: 'id', isPrimaryKey: true },
 *     { columnName: 'email', isUnique: true },
 *   ],
 *   compositeUniques: [['channel_id', 'message_id']],
 * };
 * const groups = extractIdentifierGroups(table);
 * // Returns: [['id'], ['channelId', 'messageId'], ['email']]
 *
 * // Used in generated code:
 * // protected readonly IDENTIFIER_GROUPS = [['id'], ['channelId', 'messageId'], ['email']];
 * ```
 */
export function extractIdentifierGroups(table: TableInfo): string[][] {
  const groups: string[][] = [];

  // Primary key columns form a single group (may be composite)
  const pkColumns = table.columns.filter((c) => c.isPrimaryKey);
  if (pkColumns.length > 0) {
    groups.push(pkColumns.map((col) => snakeToCamel(col.columnName)));
  }

  // Composite unique groups
  for (const group of table.compositeUniques) {
    groups.push(group.map((name) => snakeToCamel(name)));
  }

  // Single-column uniques (excluding those already in PK)
  const uniqueColumns = table.columns.filter(
    (c) => c.isUnique && !c.isPrimaryKey,
  );
  for (const col of uniqueColumns) {
    groups.push([snakeToCamel(col.columnName)]);
  }

  // Fallback to 'id' if no identifiers found (shouldn't happen in well-designed schemas)
  return groups.length > 0 ? groups : [["id"]];
}

/**
 * Generates the Identifier type for query operations
 *
 * Creates a union type representing all valid ways to uniquely identify
 * a row in the table. Includes primary key combinations and individual
 * unique column identifiers as separate union members.
 *
 * @param table - Table metadata with column information
 * @param className - PascalCase class name for the table
 * @returns TypeScript type definition for identifiers
 *
 * @remarks
 * Union structure:
 * - Primary key object (may contain multiple fields for composite keys)
 * - Composite unique index/constraint objects (all columns of the group together)
 * - Individual single-column unique objects
 * - Fallback to { id: number } if no constraints defined
 *
 * Query flexibility:
 * - Supports composite primary keys: { userId: 1, roleId: 2 }
 * - Supports composite uniques: { channelId: '1', messageId: '2' }
 * - Supports unique columns: { email: 'user@example.com' }
 * - Type-safe: Only valid identifier combinations accepted
 *
 * @example
 * ```typescript
 * // Table with id (PK) and email (unique):
 * export type UserIdentifier =
 *   | { id: number }
 *   | { email: string };
 *
 * // Composite PK table (user_id, role_id):
 * export type UserRoleIdentifier =
 *   | { userId: number; roleId: number }
 *   | { assignmentId: string };  // unique column
 *
 * // Usage:
 * await db.users.findOne({ id: 123 });              // ✓ Valid
 * await db.users.findOne({ email: 'test@ex.com' }); // ✓ Valid
 * await db.users.findOne({ name: 'John' });         // ✗ Compile error
 * ```
 */
function generateIdentifierType(
  table: TableInfo,
  className: string,
  enums: EnumTypeInfo[] = [],
): string {
  const identifiers: string[] = [];

  const renderGroup = (columns: ColumnInfo[]): string => {
    const fields = columns.map((col) => {
      const type = pgTypeToTsType(
        col.udtName,
        false,
        col.numericPrecision,
        col.numericScale,
        enums,
      );
      return `${snakeToCamel(col.columnName)}: ${type}`;
    });
    return `{ ${fields.join("; ")} }`;
  };

  // Add primary key combination as a single object type
  const pkColumns = table.columns.filter((c) => c.isPrimaryKey);
  if (pkColumns.length > 0) {
    identifiers.push(renderGroup(pkColumns));
  }

  // Add each composite unique group as a single object type
  const columnsByName = new Map(table.columns.map((c) => [c.columnName, c]));
  for (const group of table.compositeUniques) {
    const groupColumns = group
      .map((name) => columnsByName.get(name))
      .filter((col): col is ColumnInfo => col !== undefined);
    if (groupColumns.length !== group.length) continue;
    identifiers.push(renderGroup(groupColumns));
  }

  // Add each single-column unique as a separate identifier option
  const uniqueColumns = table.columns.filter(
    (c) => c.isUnique && !c.isPrimaryKey,
  );
  for (const col of uniqueColumns) {
    identifiers.push(renderGroup([col]));
  }

  // Fallback if no identifiers found (shouldn't happen in practice)
  const unionType =
    identifiers.length > 0 ? identifiers.join(" | ") : "{ id: number }";

  return `export type ${className}Identifier = ${unionType};`;
}

/**
 * Generates the Filters type for query filtering operations
 *
 * Creates a type that allows filtering on any field in the entity with
 * support for comparison operators, pattern matching, and null checks
 * through the FilterValue wrapper type.
 *
 * @param table - Table metadata (not directly used, but kept for consistency)
 * @param className - PascalCase class name for the table
 * @returns TypeScript type definition for filters
 *
 * @remarks
 * Filter type structure:
 * - Mapped type over all Entity fields
 * - Each field wrapped in FilterValue<T>
 * - All fields optional (partial filtering)
 * - Supports operator objects or direct values
 *
 * FilterValue capabilities:
 * - Direct value: { id: 123 } (implicit equals)
 * - Operators: { age: { $gte: 18, $lt: 65 } }
 * - Pattern matching: { email: { $like: '%@company.com' } }
 * - Null checks: { deletedAt: { $exists: false } }
 * - Array operations: { status: { $in: ['active', 'pending'] } }
 *
 * @example
 * ```typescript
 * // Generated type:
 * export type UserFilters = {
 *   [K in keyof User]?: FilterValue<User[K]>;
 * };
 *
 * // Usage examples:
 * const filters1: UserFilters = {
 *   id: 123,                           // Direct value (equals)
 *   email: { $like: '%@example.com' }  // Pattern match
 * };
 *
 * const filters2: UserFilters = {
 *   age: { $gte: 18, $lte: 65 },      // Range query
 *   deletedAt: null                    // IS NULL check
 * };
 *
 * const filters3: UserFilters = {
 *   status: { $in: ['active', 'pending'] },  // Array membership
 *   createdAt: { $between: [startDate, endDate] }
 * };
 *
 * await db.users.findAll(filters1);
 * ```
 */
function generateFiltersType(table: TableInfo, className: string): string {
  return `import type { FilterValue } from "./base.types";

export type ${className}Filters = {
  [K in keyof ${className}]?: FilterValue<${className}[K]>;
};`;
}
