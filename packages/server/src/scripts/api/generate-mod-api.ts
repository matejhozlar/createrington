/**
 * Mod API Java Library Generator
 *
 * Reads API spec files from mod controllers and generates Java record source
 * files for the createrington-api library. Outputs to mod-api/src/.
 *
 * Usage:
 *   tsx src/scripts/api/generate-mod-api.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ApiModuleSpec,
  EndpointSpec,
  FieldSpec,
  FieldType,
  RecordSpec,
} from "./spec-types";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..", "..");
const OUTPUT_BASE = path.join(
  REPO_ROOT,
  "mod-api",
  "src",
  "main",
  "java",
  "com",
  "saunhardy",
  "createrington",
  "api",
);
const BASE_PACKAGE = "com.saunhardy.createrington.api";

// ---------------------------------------------------------------------------
// Spec registry: import all mod specs
// ---------------------------------------------------------------------------

const MOD_SPECS: ApiModuleSpec[] = [
  (await import("@/app/features/mod/allies/allies.api-spec")).default,
  (await import("@/app/features/mod/chunks/chunks.api-spec")).default,
  (await import("@/app/features/mod/currency/currency.api-spec")).default,
  (await import("@/app/features/mod/forceloads/forceloads.api-spec")).default,
  (await import("@/app/features/mod/presence/presence.api-spec")).default,
  (await import("@/app/features/mod/trains/trains.api-spec")).default,
];

// ---------------------------------------------------------------------------
// Java type mapping
// ---------------------------------------------------------------------------

function javaType(field: FieldSpec): string {
  return resolveJavaType(field.type, field.nullable ?? false);
}

function resolveJavaType(type: FieldType, nullable: boolean): string {
  if (typeof type === "string") {
    const mapped = PRIMITIVE_MAP[type];
    if (nullable && BOXED_MAP[type]) return BOXED_MAP[type];
    return mapped;
  }
  if (type.type === "array") {
    const inner = resolveJavaType(type.items, false);
    return `List<${inner}>`;
  }
  if (type.type === "object") {
    return type.name;
  }
  return "Object";
}

const PRIMITIVE_MAP: Record<string, string> = {
  string: "String",
  int: "int",
  long: "long",
  double: "double",
  boolean: "boolean",
};

const BOXED_MAP: Record<string, string> = {
  int: "Integer",
  long: "Long",
  double: "Double",
  boolean: "Boolean",
};

// ---------------------------------------------------------------------------
// Collect nested object types from fields (recursive)
// ---------------------------------------------------------------------------

interface CollectedRecord {
  name: string;
  fields: FieldSpec[];
}

function collectNestedRecords(fields: FieldSpec[]): CollectedRecord[] {
  const records: CollectedRecord[] = [];

  for (const field of fields) {
    collectFromType(field.type, records);
  }

  return records;
}

function collectFromType(type: FieldType, records: CollectedRecord[]): void {
  if (typeof type === "string") return;

  if (type.type === "array") {
    collectFromType(type.items, records);
  } else if (type.type === "object") {
    // Avoid duplicates (e.g. Position used in multiple specs)
    if (!records.some((r) => r.name === type.name)) {
      records.push({ name: type.name, fields: type.fields });
    }
    // Recurse into nested object's fields
    for (const f of type.fields) {
      collectFromType(f.type, records);
    }
  }
}

// ---------------------------------------------------------------------------
// Java source generation
// ---------------------------------------------------------------------------

function needsListImport(fields: FieldSpec[]): boolean {
  return fields.some((f) => hasArrayType(f.type));
}

function hasArrayType(type: FieldType): boolean {
  if (typeof type === "string") return false;
  if (type.type === "array") return true;
  if (type.type === "object")
    return type.fields.some((f) => hasArrayType(f.type));
  return false;
}

function needsSerializedNameImport(fields: FieldSpec[]): boolean {
  return fields.some((f) => f.jsonName != null);
}

function needsNullableImport(fields: FieldSpec[]): boolean {
  return fields.some((f) => f.nullable);
}

function generateRecordFile(
  packageName: string,
  recordName: string,
  fields: FieldSpec[],
  options?: { envelopedAs?: string },
): string {
  const lines: string[] = [];

  lines.push(`package ${packageName};`);
  lines.push("");

  // Imports
  const imports: string[] = [];

  if (needsListImport(fields)) {
    imports.push("import java.util.List;");
  }
  if (needsSerializedNameImport(fields)) {
    imports.push("import com.google.gson.annotations.SerializedName;");
  }
  if (needsNullableImport(fields)) {
    imports.push(`import ${BASE_PACKAGE}.Nullable;`);
  }

  if (imports.length > 0) {
    imports.sort();
    lines.push(...imports);
    lines.push("");
  }

  // Optional envelope JavaDoc
  if (options?.envelopedAs) {
    lines.push("/**");
    lines.push(
      ` * Wire format: ${options.envelopedAs}. This record describes the inner`,
    );
    lines.push(
      ` * \`data\` payload only -- the surrounding success/message/playerMessage`,
    );
    lines.push(" * fields live on ApiResponse.");
    lines.push(" */");
  }

  // Record declaration
  lines.push(`public record ${recordName}(`);

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const parts: string[] = [];

    // @SerializedName annotation
    if (field.jsonName) {
      parts.push(`    @SerializedName("${field.jsonName}")`);
    }

    // @Nullable annotation + type + name
    const prefix = field.nullable ? "@Nullable " : "";
    const typeName = javaType(field);
    const suffix = i < fields.length - 1 ? "," : "";

    if (field.jsonName) {
      // Annotation on its own line, field on next line
      lines.push(parts[0]);
      lines.push(`    ${prefix}${typeName} ${field.name}${suffix}`);
    } else {
      lines.push(`    ${prefix}${typeName} ${field.name}${suffix}`);
    }
  }

  lines.push(") {}");
  lines.push("");

  return lines.join("\n");
}

function generateEndpointsFile(specs: ApiModuleSpec[]): string {
  const lines: string[] = [];

  lines.push(`package ${BASE_PACKAGE};`);
  lines.push("");
  lines.push("public final class Endpoints {");
  lines.push("");
  lines.push("    private Endpoints() {}");
  lines.push("");

  for (const spec of specs) {
    lines.push(`    // ${spec.name}`);

    for (const ep of spec.endpoints) {
      const fullPath = ep.path === "/" ? spec.prefix : spec.prefix + ep.path;
      const constName = endpointConstantName(spec.name, ep);
      lines.push(
        `    public static final String ${constName} = "${fullPath}";`,
      );
    }

    lines.push("");
  }

  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function endpointConstantName(moduleName: string, ep: EndpointSpec): string {
  // e.g. Currency + "/lottery/start" → CURRENCY_LOTTERY_START
  const pathPart = ep.path.replace(/^\//, "").replace(/\//g, "_").toUpperCase();

  const prefix = moduleName.toUpperCase();

  if (!pathPart) {
    // Root endpoint (e.g. POST /api/presence → "/")
    return prefix;
  }

  return `${prefix}_${pathPart}`;
}

/**
 * Generic envelope used by all enveloped modules. Mod consumers deserialize
 * responses as `ApiResponse<BalanceResponse>`, etc., to access the typed
 * `data` payload alongside the `success`, `message`, and `playerMessage`
 * envelope fields.
 */
function generateApiResponseEnvelope(): string {
  return `package ${BASE_PACKAGE};

import com.google.gson.annotations.SerializedName;

public record ApiResponse<T>(
    boolean success,
    String message,
    @Nullable @SerializedName("playerMessage") String playerMessage,
    @Nullable T data
) {
    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, null, data);
    }

    public static <T> ApiResponse<T> ok(String message, String playerMessage, T data) {
        return new ApiResponse<>(true, message, playerMessage, data);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, message, null, null);
    }

    public static <T> ApiResponse<T> fail(String message, String playerMessage) {
        return new ApiResponse<>(false, message, playerMessage, null);
    }
}
`;
}

function generateNullableAnnotation(): string {
  const lines: string[] = [];

  lines.push(`package ${BASE_PACKAGE};`);
  lines.push("");
  lines.push("import java.lang.annotation.ElementType;");
  lines.push("import java.lang.annotation.Retention;");
  lines.push("import java.lang.annotation.RetentionPolicy;");
  lines.push("import java.lang.annotation.Target;");
  lines.push("");
  lines.push("@Retention(RetentionPolicy.RUNTIME)");
  lines.push(
    "@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_USE})",
  );
  lines.push("public @interface Nullable {}");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// File writing
// ---------------------------------------------------------------------------

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("Generating mod API Java library...\n");

  // Clean output directory
  if (fs.existsSync(OUTPUT_BASE)) {
    fs.rmSync(OUTPUT_BASE, { recursive: true });
  }

  let totalFiles = 0;

  // Generate Nullable annotation
  writeFile(
    path.join(OUTPUT_BASE, "Nullable.java"),
    generateNullableAnnotation(),
  );
  totalFiles++;

  // Generate ApiResponse<T> envelope (only if at least one module is enveloped)
  if (MOD_SPECS.some((s) => s.enveloped)) {
    writeFile(
      path.join(OUTPUT_BASE, "ApiResponse.java"),
      generateApiResponseEnvelope(),
    );
    totalFiles++;
  }

  // Generate Endpoints.java
  writeFile(
    path.join(OUTPUT_BASE, "Endpoints.java"),
    generateEndpointsFile(MOD_SPECS),
  );
  totalFiles++;

  // Generate record files per module
  for (const spec of MOD_SPECS) {
    const moduleName = spec.name.toLowerCase();
    const moduleDir = path.join(OUTPUT_BASE, moduleName);
    const packageName = `${BASE_PACKAGE}.${moduleName}`;

    console.log(`  ${spec.name} (${spec.endpoints.length} endpoints)`);

    const generatedRecords = new Set<string>();

    for (const ep of spec.endpoints) {
      // Request record
      if (ep.request) {
        writeFile(
          path.join(moduleDir, `${ep.request.name}.java`),
          generateRecordFile(packageName, ep.request.name, ep.request.fields),
        );
        generatedRecords.add(ep.request.name);
        totalFiles++;

        for (const rec of collectNestedRecords(ep.request.fields)) {
          if (generatedRecords.has(rec.name)) continue;
          writeFile(
            path.join(moduleDir, `${rec.name}.java`),
            generateRecordFile(packageName, rec.name, rec.fields),
          );
          generatedRecords.add(rec.name);
          totalFiles++;
        }
      }

      // Response record
      if (ep.response) {
        const envelopedAs = spec.enveloped
          ? ep.response.isArray
            ? `ApiResponse<List<${ep.response.name}>>`
            : `ApiResponse<${ep.response.name}>`
          : undefined;

        writeFile(
          path.join(moduleDir, `${ep.response.name}.java`),
          generateRecordFile(
            packageName,
            ep.response.name,
            ep.response.fields,
            { envelopedAs },
          ),
        );
        generatedRecords.add(ep.response.name);
        totalFiles++;

        for (const rec of collectNestedRecords(ep.response.fields)) {
          if (generatedRecords.has(rec.name)) continue;
          writeFile(
            path.join(moduleDir, `${rec.name}.java`),
            generateRecordFile(packageName, rec.name, rec.fields),
          );
          generatedRecords.add(rec.name);
          totalFiles++;
        }
      }
    }
  }

  console.log(`\nGenerated ${totalFiles} Java files in mod-api/src/`);
}

main();
