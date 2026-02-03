/**
 * PostgreSQL to TypeScript type mapping utilities
 *
 * This module handles the conversion of PostgreSQL data types to their
 * appropriate TypeScript equivalents, with special handling for numeric
 * types to prevent precision loss and overflow issues in JavaScript.
 */

import { EnumTypeInfo } from "../types";
import { snakeToPascal } from "./naming";

/**
 * Converts a PostgreSQL column type to its TypeScript type equivalent
 *
 * Maps PostgreSQL data types to appropriate TypeScript types, accounting for
 * nullability and numeric precision/scale constraints. Ensures type safety
 * while avoiding JavaScript number precision limitations.
 *
 * @param udtName - PostgreSQL user-defined type name (e.g., 'int4', 'varchar', 'numeric')
 * @param isNullable - Whether the column accepts NULL values
 * @param numericPrecision - Total number of digits for numeric types (null for non-numeric)
 * @param numericScale - Number of decimal places for numeric types (null for non-numeric)
 * @returns TypeScript type string, with ' | null' appended if nullable
 *
 * @example
 * ```typescript
 * pgTypeToTsType('int4', false, null, null);        // Returns: 'number'
 * pgTypeToTsType('varchar', true, null, null);      // Returns: 'string | null'
 * pgTypeToTsType('numeric', false, 10, 2);          // Returns: 'string'
 * pgTypeToTsType('timestamptz', true, null, null);  // Returns: 'Date | null'
 * ```
 */
export function pgTypeToTsType(
  udtName: string,
  isNullable: boolean,
  numericPrecision: number | null,
  numericScale: number | null,
  enums: EnumTypeInfo[] = [],
): string {
  const baseType = getBaseType(udtName, numericPrecision, numericScale, enums);
  return isNullable ? `${baseType} | null` : baseType;
}

/**
 * Maps PostgreSQL type to base TypeScript type (without nullability)
 *
 * Performs the core type mapping logic, with special handling for numeric
 * types that may exceed JavaScript's safe integer range or require decimal
 * precision beyond what the number type can represent.
 *
 * @param udtName - PostgreSQL user-defined type name
 * @param numericPrecision - Total digits for numeric types
 * @param numericScale - Decimal places for numeric types
 * @returns Base TypeScript type string without nullability modifier
 *
 * @remarks
 * - int8 maps to bigint to safely represent PostgreSQL BIGINT values
 * - numeric types are evaluated for precision to avoid JavaScript overflow
 * - JSON/JSONB default to Record<string, any> for flexibility
 * - Unknown types safely default to 'any' rather than failing
 */
function getBaseType(
  udtName: string,
  numericPrecision: number | null,
  numericScale: number | null,
  enums: EnumTypeInfo[] = [],
): string {
  const enumType = enums.find((e) => e.typeName === udtName);
  if (enumType) {
    return snakeToPascal(enumType.typeName);
  }
  // Handle numeric type with precision/scale considerations
  if (udtName === "numeric") {
    return getNumericType(numericPrecision, numericScale);
  }

  // Standard PostgreSQL type mappings
  const typeMap: Record<string, string> = {
    int2: "number", // SMALLINT (-32,768 to 32,767)
    int4: "number", // INTEGER (-2,147,483,648 to 2,147,483,647)
    int8: "bigint", // BIGINT (exceeds safe integer range, use bigint)
    float4: "number", // REAL (4-byte floating point)
    float8: "number", // DOUBLE PRECISION (8-byte floating point)
    text: "string", // TEXT (unlimited length)
    varchar: "string", // VARCHAR (variable character)
    bpchar: "string", // CHAR (blank-padded character)
    uuid: "string", // UUID (represented as string in TypeScript)
    bool: "boolean", // BOOLEAN
    timestamp: "Date", // TIMESTAMP (without timezone)
    timestamptz: "Date", // TIMESTAMP WITH TIMEZONE
    date: "Date", // DATE
    json: "Record<string, any>", // JSON (flexible object type)
    jsonb: "Record<string, any>", // JSONB (binary JSON, same TS type)
  };

  return typeMap[udtName] || "any";
}

/**
 * Determines the appropriate TypeScript type for PostgreSQL NUMERIC columns
 *
 * Analyzes precision and scale to decide between 'number', 'bigint', or 'string'
 * to prevent data loss from JavaScript's numeric limitations:
 * - Numbers with decimals → string (to preserve exact decimal values)
 * - Very large integers (>15 digits) → string (to avoid overflow)
 * - Safe integers → number (for performance and convenience)
 *
 * @param precision - Total number of digits (both sides of decimal point)
 * @param scale - Number of digits after the decimal point
 * @returns TypeScript type that safely represents the numeric value
 *
 * @remarks
 * JavaScript's number type is IEEE 754 double-precision, which:
 * - Has ~15-17 significant decimal digits of precision
 * - Cannot exactly represent many decimal values (e.g., 0.1 + 0.2 ≠ 0.3)
 * - Has a safe integer range of -(2^53-1) to (2^53-1)
 *
 * @example
 * ```typescript
 * getNumericType(10, 2);   // Returns: 'string' (has decimals)
 * getNumericType(18, 0);   // Returns: 'string' (precision > 15)
 * getNumericType(10, 0);   // Returns: 'number' (safe integer)
 * getNumericType(null, null); // Returns: 'number' (default)
 * ```
 */
function getNumericType(
  precision: number | null,
  scale: number | null,
): string {
  // If has decimal places, use string to avoid precision loss
  // (JavaScript numbers cannot exactly represent many decimal values)
  if (scale !== null && scale > 0) {
    return "string";
  }

  // If precision is very large, use string to avoid overflow
  // (JavaScript's safe integer range is -(2^53-1) to (2^53-1), ~15-16 digits)
  if (precision !== null && precision > 15) {
    return "string";
  }

  // Safe to use number for integers within safe range
  return "number";
}

/**
 * Generates a TypeScript comment documenting numeric precision and scale
 *
 * Adds inline documentation for numeric columns to help developers understand
 * the original PostgreSQL constraints, which is especially important when the
 * TypeScript type is 'string' due to precision requirements.
 *
 * @param udtName - PostgreSQL user-defined type name
 * @param precision - Total number of digits
 * @param scale - Number of digits after decimal point
 * @returns Inline comment string, or empty string if not a numeric type
 *
 * @example
 * ```typescript
 * getNumericComment('numeric', 10, 2);  // Returns: ' // numeric(10, 2)'
 * getNumericComment('numeric', 18, 0);  // Returns: ' // numeric(18, 0)'
 * getNumericComment('int4', null, null); // Returns: ''
 *
 * // Used in generated code:
 * // amount: string; // numeric(10, 2)
 * ```
 */
export function getNumericComment(
  udtName: string,
  precision: number | null,
  scale: number | null,
): string {
  if (udtName === "numeric" && precision !== null && scale !== null) {
    return ` // numeric(${precision}, ${scale})`;
  }
  return "";
}
