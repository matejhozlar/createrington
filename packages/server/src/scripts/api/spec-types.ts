/**
 * API spec type system — single source of truth for endpoint metadata.
 * Consumed by both the Java library generator and the API docs generator.
 */

// ---------------------------------------------------------------------------
// Field types
// ---------------------------------------------------------------------------

/** Primitive types that map directly to Java types */
export type PrimitiveFieldType =
  | "string"
  | "int"
  | "long"
  | "double"
  | "boolean";

/** Array type — maps to List<T> in Java */
export interface ArrayFieldType {
  type: "array";
  items: FieldType;
}

/** Nested object type — maps to a separate Java record */
export interface ObjectFieldType {
  type: "object";
  name: string;
  fields: FieldSpec[];
}

/** Union of all field types */
export type FieldType = PrimitiveFieldType | ArrayFieldType | ObjectFieldType;

// ---------------------------------------------------------------------------
// Fields & records
// ---------------------------------------------------------------------------

export interface FieldSpec {
  /** Java-idiomatic field name (camelCase) */
  name: string;
  /** Field type */
  type: FieldType;
  /** JSON wire name — only set when it differs from `name` (e.g. snake_case) */
  jsonName?: string;
  /** Whether the field is optional / nullable */
  nullable?: boolean;
  /** Human-readable description (used in docs and Java comments) */
  description?: string;
}

export interface RecordSpec {
  /** Java class name (PascalCase) */
  name: string;
  /** Record fields */
  fields: FieldSpec[];
  /** If true, the endpoint returns a raw JSON array of this record (no wrapper object) */
  isArray?: boolean;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export interface EndpointSpec {
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Path relative to module prefix (e.g. '/login', '/balance') */
  path: string;
  /** PascalCase base name used for Java class naming (e.g. 'Login', 'Pay') */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Auth override for this endpoint (overrides module-level auth) */
  auth?: string;
  /** Query parameters (for GET endpoints) */
  query?: FieldSpec[];
  /** Request body spec */
  request?: RecordSpec;
  /** Response body spec */
  response?: RecordSpec;
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export interface ApiModuleSpec {
  /** Display name (e.g. 'Currency', 'Presence') */
  name: string;
  /** URL prefix (e.g. '/api/currency') */
  prefix: string;
  /** Module description for docs */
  description?: string;
  /** Default auth level for endpoints in this module */
  auth: string;
  /** Whether this is a mod-facing API (used by Java generator to filter) */
  mod?: boolean;
  /** Endpoint definitions */
  endpoints: EndpointSpec[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Identity function for type inference when defining specs */
export function defineApiSpec(spec: ApiModuleSpec): ApiModuleSpec {
  return spec;
}
