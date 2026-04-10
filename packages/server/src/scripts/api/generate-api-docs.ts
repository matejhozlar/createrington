/**
 * API Docs Generator
 *
 * Statically parses Express route files and controller JSDoc comments
 * to generate a human-readable Markdown reference for the REST API.
 *
 * No runtime imports — reads source files as plain text, so it works
 * without a database connection or any service dependencies.
 *
 * Usage:
 *   tsx src/scripts/api/generate-api-docs.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  {
    name: "Currency",
    prefix: "/api/currency",
    routeFile: "mod/currency/currency.routes.ts",
    controllerFile: "mod/currency/currency.controller.ts",
    description:
      "In-game economy endpoints called by the Minecraft mod: balances, transfers, withdrawals, daily rewards, and leaderboard.",
    authNote: "Server IP + Mod JWT",
  },
  {
    name: "Presence",
    prefix: "/api/presence",
    routeFile: "mod/presence/presence.routes.ts",
    controllerFile: "mod/presence/presence.controller.ts",
    description:
      "Player join/leave tracking and heartbeat reconciliation from the Minecraft mod.",
    authNote: "Server IP + Mod JWT",
  },
  {
    name: "Trains",
    prefix: "/api/trains",
    routeFile: "mod/trains/trains.routes.ts",
    controllerFile: "mod/trains/trains.controller.ts",
    description:
      "Train crash event reporting from the Create: Trains Minecraft mod.",
    authNote: "Server IP",
  },
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

function generateMarkdown(
  modules: Array<{
    module: RouteModule;
    routes: ParsedRoute[];
    controllerDocs: Map<string, ControllerDoc>;
  }>,
): string {
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
  for (const { module, routes } of modules) {
    lines.push(
      `- **[${module.name}](#${module.name.toLowerCase().replace(/\s+/g, "-")})** — ${routes.length} endpoint(s)`,
    );
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
  for (const { module, routes, controllerDocs } of modules) {
    lines.push(`## ${module.name}`);
    lines.push("");
    lines.push(module.description);
    lines.push("");
    lines.push(
      `**Base path:** \`${module.prefix}\` · **Auth:** ${module.authNote}`,
    );
    lines.push("");

    for (const route of routes) {
      lines.push(`### ${route.method} \`${route.path}\``);
      lines.push("");

      // Get description from controller JSDoc, route comment, or route-level JSDoc
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

      // Body documentation
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
  }

  return lines.join("\n");
}

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
// MAIN
// ============================================================================

function main(): void {
  console.log("Generating API reference docs...\n");

  const modules: Array<{
    module: RouteModule;
    routes: ParsedRoute[];
    controllerDocs: Map<string, ControllerDoc>;
  }> = [];

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

    modules.push({ module: mod, routes, controllerDocs });
  }

  const totalEndpoints = modules.reduce((sum, m) => sum + m.routes.length, 0);

  const markdown = generateMarkdown(modules);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, markdown, "utf-8");

  console.log(`\nGenerated ${totalEndpoints} endpoints → ${OUTPUT_FILE}`);
}

main();
