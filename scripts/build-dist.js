import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

const SERVER_DIST = path.join(ROOT, "packages/server/dist");
const CLIENT_DIST = path.join(ROOT, "packages/client/dist");

// Clean
fs.rmSync(DIST, { recursive: true, force: true });

// Copy server build -> dist/ (exclude .d.ts files — not needed at runtime
// and the Discord bot's dynamic loader would try to import() them)
fs.cpSync(SERVER_DIST, DIST, {
  recursive: true,
  filter: (src) => !src.endsWith(".d.ts"),
});

// Copy client build -> dist/public/
fs.cpSync(CLIENT_DIST, path.join(DIST, "public"), { recursive: true });

console.log("Build assembled in dist/");
