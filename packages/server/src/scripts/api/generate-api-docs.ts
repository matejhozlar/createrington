/**
 * API Docs Generator
 *
 * Generates a human-readable Markdown reference for the REST API.
 *
 * Mod-facing modules (Currency, Presence, Trains) use structured API spec
 * files as their source of truth. All other modules fall back to static
 * source-file parsing of Express routes and controller JSDoc comments.
 *
 * Usage:
 *   tsx src/scripts/api/generate-api-docs.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ApiModuleSpec, FieldSpec, FieldType } from "./spec-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = path.join(__dirname, "..", "..", "app", "features");
const OUTPUT_DIR = path.join(__dirname, "..", "..", "..", "..", "..", "docs");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "api-reference.md");

// ============================================================================
// ROUTE MODULE DEFINITIONS
// ============================================================================

interface RouteModule {
  /** Display name in the docs */
  name: string;
  /** URL prefix as registered in features/index.ts */
  prefix: string;
  /** Path relative to features/ */
  routeFile: string;
  /** Path relative to features/, null for inline-handler-only modules */
  controllerFile: string | null;
  /** Short description of the module */
  description: string;
  /** Auth mechanism label for the module header */
  authNote: string;
}

const ROUTE_MODULES: RouteModule[] = [
  {
    name: "Auth",
    prefix: "/api/auth",
    routeFile: "auth/auth.routes.ts",
    controllerFile: "auth/auth.controller.ts",
    description:
      "Discord OAuth flow, JWT session management, and token refresh.",
    authNote: "Public + Bearer JWT",
  },
  {
    name: "Messages",
    prefix: "/api/messages",
    routeFile: "user/message/message.routes.ts",
    controllerFile: "user/message/message.controller.ts",
    description:
      "Send messages to Minecraft server Discord channels via the web client.",
    authNote: "Bearer JWT (user)",
  },
  {
    name: "Skin",
    prefix: "/api/skin",
    routeFile: "skin/skin.routes.ts",
    controllerFile: null,
    description:
      "Proxies Minecraft skin requests to avoid CORS issues with external APIs.",
    authNote: "Public",
  },
  {
    name: "Donations",
    prefix: "/api/donations",
    routeFile: "donation/donation.routes.ts",
    controllerFile: "donation/donation.controller.ts",
    description:
      "Stripe webhook processing for donation and subscription events.",
    authNote: "Stripe signature",
  },
  // Currency, Presence, and Trains are generated from API spec files (see MOD_SPECS below)
  {
    name: "Render",
    prefix: "/api/render",
    routeFile: "render/render.routes.ts",
    controllerFile: null,
    description:
      "Internal data endpoints consumed by PuppeteerService for image generation. Not user-accessible.",
    authNote: "Puppeteer secret",
  },
  {
    name: "Internal Sync",
    prefix: "/api/internal/presence",
    routeFile: "internal/presence/presence.routes.ts",
    controllerFile: "internal/presence/presence.controller.ts",
    description:
      "Cross-environment presence sync. Receives forwarded events from the dev server. Only active when sync secret is configured.",
    authNote: "X-Sync-Secret header",
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface ParsedRoute {
  method: string;
  path: string;
  auth: string;
  handlerMethod: string | null;
  routeComment: string;
}

interface ControllerDoc {
  description: string;
  body: string | null;
}

// ============================================================================
// ROUTE FILE PARSER
// ============================================================================

/**
 * Extracts route definitions from a route file by matching router.METHOD() calls
 * and their preceding comments.
 */
function parseRouteFile(source: string, prefix: string): ParsedRoute[] {
  const routes: ParsedRoute[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    // Match: router.get( , router.post( , etc.
    const methodMatch = lines[i].match(
      /router\.(get|post|put|patch|delete)\(\s*$/,
    );
    const inlineMatch = lines[i].match(
      /router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/,
    );

    if (!methodMatch && !inlineMatch) continue;

    const method = (methodMatch?.[1] ?? inlineMatch?.[1])!.toUpperCase();

    // Extract path — may be on the same line or the next
    let routePath: string;
    if (inlineMatch) {
      routePath = inlineMatch[2];
    } else {
      // Path is on the next non-empty line
      const nextLine = lines[i + 1]?.trim() ?? "";
      const pathMatch = nextLine.match(/^"([^"]+)"/);
      routePath = pathMatch ? pathMatch[1] : "/";
    }

    const fullPath = prefix + (routePath === "/" ? "" : routePath);

    // Determine auth level by scanning forward from router.METHOD line
    const block = lines.slice(i, Math.min(i + 10, lines.length)).join(" ");
    const auth = resolveAuth(block);

    // Extract handler method name (e.g., "AuthController.getAuthUrl")
    const handlerMatch = block.match(
      /(\w+Controller\.\w+|(\w+Controller)\.\w+)/,
    );
    const handlerMethod = handlerMatch ? handlerMatch[0].split(".")[1] : null;

    // Collect preceding comment block
    const routeComment = collectPrecedingComment(lines, i);

    routes.push({ method, path: fullPath, auth, handlerMethod, routeComment });
  }

  return routes;
}

/**
 * Determines the auth level from the middleware composition in the route call.
 */
function resolveAuth(block: string): string {
  // Pattern 1: ...route("public"|"user"|"admin", ...)
  const routeMatch = block.match(/\.\.\.route\(\s*"(public|user|admin)"/);
  if (routeMatch) return routeMatch[1];

  // Pattern 2: ...customRoute([middleware...], ...)
  if (block.includes("customRoute")) {
    const middlewares: string[] = [];
    if (block.includes("verifyServerIP")) middlewares.push("Server IP");
    if (block.includes("verifyModJWT")) middlewares.push("Mod JWT");
    if (block.includes("verifySyncSecret")) middlewares.push("Sync Secret");
    return middlewares.length > 0 ? middlewares.join(" + ") : "custom";
  }

  // Pattern 3: optionalAuth (auth/logout)
  if (block.includes("optionalAuth")) return "optional";

  // Pattern 4: requirePuppeteerSecret
  if (block.includes("requirePuppeteerSecret")) return "Puppeteer Secret";

  // Fallback: raw handler
  return "none";
}

/**
 * Walks backwards from a line index to collect the nearest JSDoc or
 * single-line comment block above it.
 */
function collectPrecedingComment(lines: string[], index: number): string {
  const commentLines: string[] = [];

  // Walk backwards from the line before `index`
  let j = index - 1;

  // Skip blank lines
  while (j >= 0 && lines[j].trim() === "") j--;

  if (j < 0) return "";

  // Check for JSDoc block (ends with */)
  if (lines[j].trim().endsWith("*/")) {
    while (j >= 0) {
      commentLines.unshift(lines[j]);
      if (lines[j].trim().startsWith("/**") || lines[j].trim().startsWith("/*"))
        break;
      j--;
    }
    return extractJsDocText(commentLines.join("\n"));
  }

  // Check for single-line comments
  while (j >= 0 && lines[j].trim().startsWith("//")) {
    commentLines.unshift(lines[j].trim().replace(/^\/\/\s?/, ""));
    j--;
  }

  return commentLines.join(" ").trim();
}

/**
 * Strips JSDoc markers (/ * * /) and returns the inner text.
 */
function extractJsDocText(block: string): string {
  return block
    .replace(/\/\*\*\s*/, "")
    .replace(/\s*\*\//, "")
    .split("\n")
    .map((l) => l.trim().replace(/^\*\s?/, ""))
    .filter((l) => l.length > 0)
    .join("\n");
}

// ============================================================================
// CONTROLLER JSDoc PARSER
// ============================================================================

/**
 * Extracts JSDoc descriptions and body annotations from a controller file,
 * keyed by method name.
 */
function parseControllerFile(source: string): Map<string, ControllerDoc> {
  const docs = new Map<string, ControllerDoc>();
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    // Match: static async methodName(
    const methodMatch = lines[i].match(/static\s+async\s+(\w+)\s*\(/);
    if (!methodMatch) continue;

    const methodName = methodMatch[1];

    // Walk backwards to find the JSDoc block
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === "") j--;

    if (j < 0 || !lines[j].trim().endsWith("*/")) {
      docs.set(methodName, { description: "", body: null });
      continue;
    }

    // Collect the full JSDoc block
    const commentLines: string[] = [];
    while (j >= 0) {
      commentLines.unshift(lines[j]);
      if (lines[j].trim().startsWith("/**") || lines[j].trim().startsWith("/*"))
        break;
      j--;
    }

    const raw = extractJsDocText(commentLines.join("\n"));
    const parsed = parseControllerJsDoc(raw);

    docs.set(methodName, parsed);
  }

  return docs;
}

/**
 * Parses the inner text of a controller method's JSDoc into structured parts.
 *
 * Recognizes patterns:
 * - First line matching METHOD /path → stripped (redundant with route data)
 * - "Body: { ... }" or "@body { ... }" → body documentation
 * - "@param" lines → stripped (internal)
 * - "@returns" / "@return" → stripped
 * - Everything else → description
 */
function parseControllerJsDoc(text: string): ControllerDoc {
  const lines = text.split("\n");
  const descriptionLines: string[] = [];
  let body: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip route identifier line (e.g., "POST /api/currency/login")
    if (/^(GET|POST|PUT|PATCH|DELETE)\s+\//.test(trimmed)) continue;

    // Body annotation: "Body: { ... }" or "@body {{ ... }}"
    const bodyMatch = trimmed.match(/^(?:Body:|@body)\s*(\{.+\})\s*$/i);
    if (bodyMatch) {
      body = bodyMatch[1];
      continue;
    }

    // Skip @param, @returns, @return tags
    if (/^@(param|returns?)\s/.test(trimmed)) continue;

    // Skip @errors for now (could be extracted later)
    if (/^@errors?\s/.test(trimmed)) continue;

    descriptionLines.push(trimmed);
  }

  // Clean up: remove leading/trailing empty lines, collapse multiple blank lines
  const description = descriptionLines
    .join("\n")
    .replace(/^\n+|\n+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { description, body };
}

// ============================================================================
// MARKDOWN GENERATOR
// ============================================================================

function authBadge(auth: string): string {
  switch (auth) {
    case "public":
      return "`Public`";
    case "user":
      return "`User` (Bearer JWT)";
    case "admin":
      return "`Admin` (Bearer JWT)";
    case "optional":
      return "`Optional Auth`";
    case "none":
      return "`None` (raw handler)";
    default:
      return `\`${auth}\``;
  }
}

// (generateMarkdown replaced by generateFullMarkdown + generateParsedModuleMarkdown below)

/**
 * Extracts a description from a route-level comment, stripping the route
 * identifier prefix (e.g., "GET /api/auth/discord - ").
 */
function extractRouteDescription(comment: string): string {
  if (!comment) return "";

  // Strip leading "METHOD /path — description" or "METHOD /path - description"
  // Require whitespace before the dash to avoid matching dashes in URL paths
  const stripped = comment
    .replace(/^(GET|POST|PUT|PATCH|DELETE)\s+\/\S*\s+[-—]\s*/i, "")
    // Also strip standalone "METHOD /path" lines
    .replace(/^(GET|POST|PUT|PATCH|DELETE)\s+\/\S*\s*\n?/gim, "")
    .trim();

  // For multi-line JSDoc from route files (render routes), clean up
  return stripped
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) => l && !l.startsWith("Security:") && !l.startsWith("- Requires"),
    )
    .join(" ")
    .replace(/Request body:\s*\{[^]*\}/, "")
    .trim();
}

/**
 * Extracts body shape from route-level comments that contain
 * "Request body: { ... }" blocks. Handles nested braces.
 */
function extractBodyFromComment(comment: string): string | null {
  if (!comment) return null;

  const marker = comment.match(/(?:Request body|Body):\s*/i);
  if (!marker) return null;

  const start = marker.index! + marker[0].length;
  if (comment[start] !== "{") return null;

  // Walk forward counting braces to find the matching closing brace
  let depth = 0;
  for (let i = start; i < comment.length; i++) {
    if (comment[i] === "{") depth++;
    else if (comment[i] === "}") depth--;
    if (depth === 0) return comment.slice(start, i + 1).trim();
  }

  return null;
}

// ============================================================================
// API SPEC–BASED GENERATION (mod modules)
// ============================================================================

const MOD_SPECS: ApiModuleSpec[] = [
  (await import("@/app/features/mod/currency/currency.api-spec")).default,
  (await import("@/app/features/mod/presence/presence.api-spec")).default,
  (await import("@/app/features/mod/trains/trains.api-spec")).default,
];

/**
 * Formats a FieldType as a human-readable type string for docs.
 */
function formatFieldType(type: FieldType): string {
  if (typeof type === "string") return type;
  if (type.type === "array") return `${formatFieldType(type.items)}[]`;
  if (type.type === "object") return type.name;
  return "unknown";
}

/**
 * Renders a list of fields as a JSON-like body block for the docs.
 */
function fieldsToBodyBlock(fields: FieldSpec[]): string {
  const lines: string[] = ["{"];

  for (const field of fields) {
    const opt = field.nullable ? "?" : "";
    const typeStr = formatFieldType(field.type);
    const desc = field.description ? `  // ${field.description}` : "";
    const key = field.jsonName ?? field.name;
    lines.push(`  ${key}${opt}: ${typeStr},${desc}`);
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Generates markdown sections for modules backed by API spec files.
 * Output format matches the source-parsed module sections.
 */
function generateSpecModulesMarkdown(specs: ApiModuleSpec[]): string {
  const lines: string[] = [];

  for (const spec of specs) {
    lines.push(`## ${spec.name}`);
    lines.push("");
    lines.push(spec.description ?? "");
    lines.push("");
    lines.push(`**Base path:** \`${spec.prefix}\` · **Auth:** ${spec.auth}`);
    lines.push("");

    for (const ep of spec.endpoints) {
      const fullPath = spec.prefix + (ep.path === "/" ? "" : ep.path);
      lines.push(`### ${ep.method} \`${fullPath}\``);
      lines.push("");

      if (ep.description) {
        lines.push(ep.description);
        lines.push("");
      }

      const auth = ep.auth ?? spec.auth;
      lines.push(`**Auth:** \`${auth}\``);
      lines.push("");

      // Query params
      if (ep.query && ep.query.length > 0) {
        lines.push("**Query params:**");
        lines.push("");
        lines.push("```json");
        lines.push(fieldsToBodyBlock(ep.query));
        lines.push("```");
        lines.push("");
      }

      // Request body
      if (ep.request) {
        lines.push("**Body:**");
        lines.push("");
        lines.push("```json");
        lines.push(fieldsToBodyBlock(ep.request.fields));
        lines.push("```");
        lines.push("");
      }

      // Response body
      if (ep.response) {
        const prefix = ep.response.isArray ? `${ep.response.name}[]` : "";
        lines.push("**Response:**");
        lines.push("");
        lines.push("```json");
        if (ep.response.isArray) {
          lines.push(`// Returns: ${prefix}`);
        }
        lines.push(fieldsToBodyBlock(ep.response.fields));
        lines.push("```");
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ============================================================================
// MAIN
// ============================================================================

/**
 * An ordered entry for document generation. Either a source-parsed module
 * or a spec-based module.
 */
type DocEntry =
  | {
      kind: "parsed";
      module: RouteModule;
      routes: ParsedRoute[];
      controllerDocs: Map<string, ControllerDoc>;
    }
  | {
      kind: "spec";
      spec: ApiModuleSpec;
    };

/**
 * Renders the full Markdown document from an ordered list of doc entries.
 */
function generateFullMarkdown(entries: DocEntry[]): string {
  const lines: string[] = [];

  lines.push("# API Reference");
  lines.push("");
  lines.push(
    "> Auto-generated from Express route and controller definitions. Do not edit manually.",
  );
  lines.push(`> Generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  // Table of contents
  lines.push("## Table of Contents");
  lines.push("");
  for (const entry of entries) {
    if (entry.kind === "parsed") {
      const count = entry.routes.length;
      const label = count === 1 ? "endpoint" : "endpoints";
      lines.push(
        `- **[${entry.module.name}](#${entry.module.name.toLowerCase().replace(/\s+/g, "-")})** — ${count} ${label}`,
      );
    } else {
      const count = entry.spec.endpoints.length;
      const label = count === 1 ? "endpoint" : "endpoints";
      lines.push(
        `- **[${entry.spec.name}](#${entry.spec.name.toLowerCase().replace(/\s+/g, "-")})** — ${count} ${label}`,
      );
    }
  }
  lines.push("");

  // Auth reference
  lines.push("## Authentication");
  lines.push("");
  lines.push("| Scheme | Description |");
  lines.push("|--------|-------------|");
  lines.push(
    "| **Bearer JWT** | User access token from Discord OAuth. Sent as `Authorization: Bearer {token}` |",
  );
  lines.push(
    "| **Mod JWT** | Short-lived token (10 min) issued by `POST /api/currency/login`. Same Bearer header |",
  );
  lines.push(
    "| **Server IP** | Request must originate from a whitelisted Minecraft server IP |",
  );
  lines.push(
    "| **Sync Secret** | `X-Sync-Secret` header for cross-environment sync |",
  );
  lines.push(
    "| **Puppeteer Secret** | `?secret=` query param for internal render service |",
  );
  lines.push(
    "| **Stripe Signature** | `stripe-signature` header for webhook verification |",
  );
  lines.push("");

  lines.push("---");
  lines.push("");

  // Module sections
  for (const entry of entries) {
    if (entry.kind === "spec") {
      lines.push(generateSpecModulesMarkdown([entry.spec]));
    } else {
      lines.push(generateParsedModuleMarkdown(entry));
    }
  }

  return lines.join("\n");
}

/**
 * Renders a single source-parsed module as a Markdown section.
 */
function generateParsedModuleMarkdown(entry: {
  module: RouteModule;
  routes: ParsedRoute[];
  controllerDocs: Map<string, ControllerDoc>;
}): string {
  const { module: mod, routes, controllerDocs } = entry;
  const lines: string[] = [];

  lines.push(`## ${mod.name}`);
  lines.push("");
  lines.push(mod.description);
  lines.push("");
  lines.push(`**Base path:** \`${mod.prefix}\` · **Auth:** ${mod.authNote}`);
  lines.push("");

  for (const route of routes) {
    lines.push(`### ${route.method} \`${route.path}\``);
    lines.push("");

    const doc = route.handlerMethod
      ? controllerDocs.get(route.handlerMethod)
      : null;
    const description =
      doc?.description || extractRouteDescription(route.routeComment);

    if (description) {
      lines.push(description);
      lines.push("");
    }

    lines.push(`**Auth:** ${authBadge(route.auth)}`);
    lines.push("");

    const body = doc?.body || extractBodyFromComment(route.routeComment);
    if (body) {
      lines.push("**Body:**");
      lines.push("");
      lines.push("```json");
      lines.push(body);
      lines.push("```");
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function main(): void {
  console.log("Generating API reference docs...\n");

  // --- Build ordered list of doc entries ---
  const entries: DocEntry[] = [];

  // Source-parsed modules (non-mod)
  for (const mod of ROUTE_MODULES) {
    const routeFilePath = path.join(FEATURES_DIR, mod.routeFile);

    if (!fs.existsSync(routeFilePath)) {
      console.warn(
        `  Skipping ${mod.name}: route file not found at ${routeFilePath}`,
      );
      continue;
    }

    const routeSource = fs.readFileSync(routeFilePath, "utf-8");
    const routes = parseRouteFile(routeSource, mod.prefix);

    let controllerDocs = new Map<string, ControllerDoc>();
    if (mod.controllerFile) {
      const controllerPath = path.join(FEATURES_DIR, mod.controllerFile);
      if (fs.existsSync(controllerPath)) {
        const controllerSource = fs.readFileSync(controllerPath, "utf-8");
        controllerDocs = parseControllerFile(controllerSource);
      }
    }

    console.log(`  ${mod.name}: ${routes.length} endpoint(s)`);

    entries.push({ kind: "parsed", module: mod, routes, controllerDocs });

    // Insert spec-based modules after Donations (last module before mod endpoints)
    if (mod.name === "Donations") {
      for (const spec of MOD_SPECS) {
        console.log(
          `  ${spec.name}: ${spec.endpoints.length} endpoint(s) [spec]`,
        );
        entries.push({ kind: "spec", spec });
      }
    }
  }

  // If Donations wasn't found, append specs at the end
  if (!entries.some((e) => e.kind === "spec")) {
    for (const spec of MOD_SPECS) {
      console.log(
        `  ${spec.name}: ${spec.endpoints.length} endpoint(s) [spec]`,
      );
      entries.push({ kind: "spec", spec });
    }
  }

  const totalEndpoints = entries.reduce((sum, e) => {
    if (e.kind === "parsed") return sum + e.routes.length;
    return sum + e.spec.endpoints.length;
  }, 0);

  const markdown = generateFullMarkdown(entries);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, markdown, "utf-8");

  console.log(`\nGenerated ${totalEndpoints} endpoints → ${OUTPUT_FILE}`);
}

main();
