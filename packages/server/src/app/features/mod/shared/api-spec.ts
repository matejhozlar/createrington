export type PrimitiveFieldType =
  "string" | "int" | "long" | "double" | "boolean";

export interface ArrayFieldType {
  type: "array";
  items: FieldType;
}

export interface ObjectFieldType {
  type: "object";
  name: string;
  fields: FieldSpec[];
}

export type FieldType = PrimitiveFieldType | ArrayFieldType | ObjectFieldType;

export interface FieldSpec {
  name: string;
  type: FieldType;
  jsonName?: string;
  nullable?: boolean;
  description?: string;
}

export interface RecordSpec {
  name: string;
  fields: FieldSpec[];
  isArray?: boolean;
}

export interface EndpointSpec {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  name: string;
  description?: string;
  auth?: string;
  query?: FieldSpec[];
  request?: RecordSpec;
  response?: RecordSpec;
}

export interface ApiModuleSpec {
  name: string;
  prefix: string;
  description?: string;
  auth: string;
  mod?: boolean;
  enveloped?: boolean;
  endpoints: EndpointSpec[];
}

export function defineApiSpec(spec: ApiModuleSpec): ApiModuleSpec {
  return spec;
}
