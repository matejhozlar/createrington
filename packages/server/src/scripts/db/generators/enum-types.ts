import { EnumTypeInfo } from "../types";
import { snakeToPascal } from "../utils";

/**
 * Generates TypeScript type definitions for PostgreSQL enum types
 *
 * Creates TypeScript union types from PostgreSQL ENUM types, enabling
 * type-safe usage of database enums throughout the application.
 *
 * @param enums - Array of enum type metadata from the database
 * @returns Complete TypeScript source code with all enum type definitions
 *
 * @remarks
 * Generated types:
 * - Union types with all enum values as string literals
 * - PascalCase naming for TypeScript conventions
 * - Preserves exact enum value strings from database
 * - Organized alphabetically by type name
 *
 * @example
 * ```typescript
 * const enums = [
 *   { typeName: 'user_status', values: ['active', 'inactive', 'suspended'] }
 * ];
 * const types = generateEnumTypes(enums);
 * // Generates:
 * // export type UserStatus = "active" | "inactive" | "suspended";
 * ```
 */
export function generateEnumTypes(enums: EnumTypeInfo[]): string {
  if (enums.length === 0) {
    return `/**
 * Database enum types
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate
 * 
 * No enum types found in database.
 */
`;
  }

  const timestamp = new Date().toISOString();
  const enumDefinitions = enums
    .map((enumInfo) => generateSingleEnumType(enumInfo))
    .join("\n\n");

  return `/**
 * Database enum types
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate
 * Generated: ${timestamp}
 */

${enumDefinitions}
`;
}

/**
 * Generates a single TypeScript enum type definition
 *
 * @param enumInfo - Enum type metadata from database
 * @returns TypeScript type definition for this enum
 */
function generateSingleEnumType(enumInfo: EnumTypeInfo): string {
  const typeName = snakeToPascal(enumInfo.typeName);
  const values = enumInfo.values.map((value) => `  | "${value}"`).join("\n");

  return `/**
 * ${enumInfo.typeName} enum type
 * 
 * Possible values: ${enumInfo.values.join(", ")}
 */
export type ${typeName} =
${values};`;
}
