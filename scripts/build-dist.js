import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");

const SERVER_DIST = path.join(ROOT, "packages/server/dist");
const CLIENT_DIST = path.join(ROOT, "packages/client/dist");

fs.rmSync(DIST, { recursive: true, force: true });

fs.cpSync(SERVER_DIST, DIST, {
  recursive: true,
  filter: (src) => !src.endsWith(".d.ts"),
});

fs.cpSync(CLIENT_DIST, path.join(DIST, "public"), { recursive: true });

const changelogSrc = path.join(ROOT, "CHANGELOG.md");
if (fs.existsSync(changelogSrc)) {
  fs.cpSync(changelogSrc, path.join(DIST, "CHANGELOG.md"));
}

console.log("Build assembled in dist/");
