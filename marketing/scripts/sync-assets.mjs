import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const MARKETING_ROOT = path.resolve(path.dirname(__filename), "..");
const REPO_ROOT = path.resolve(MARKETING_ROOT, "..");

const MIRRORS = [
  {
    label: "client/public/assets",
    src: path.join(REPO_ROOT, "packages", "client", "public", "assets"),
    dest: path.join(MARKETING_ROOT, "public", "assets"),
  },
  {
    label: "screenshots",
    src: path.join(REPO_ROOT, "screenshots"),
    dest: path.join(MARKETING_ROOT, "public", "screenshots"),
  },
  {
    label: "marketing/assets (local-only)",
    src: path.join(MARKETING_ROOT, "assets"),
    dest: path.join(MARKETING_ROOT, "public", "assets"),
    merge: true,
  },
];

function rimraf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

for (const m of MIRRORS) {
  if (!fs.existsSync(m.src)) {
    console.error(`[sync-assets] ERROR: source missing: ${m.src}`);
    process.exit(1);
  }
  if (!m.merge) rimraf(m.dest);
  copyDir(m.src, m.dest);
  console.log(`[sync-assets] ${m.label} → ${path.relative(MARKETING_ROOT, m.dest)}`);
}

console.log("[sync-assets] done");
