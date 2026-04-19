// Populates marketing/public/ by mirroring the authoritative asset
// locations so we don't check in duplicate binaries. Runs automatically
// before `pnpm dev` / `pnpm build` / `pnpm preview` via `pre*` hooks,
// and can be invoked directly with `pnpm sync-assets`.
//
// Sources:
//   1. packages/client/public/           → marketing/public/
//      (hero, features, logo, render — everything served by the live site)
//   2. screenshots/                      → marketing/public/screenshots/
//      (README product shots — used by WebShowcase + CryptoMarket)
//   3. ../parallel-worlds/.../textures   → marketing/public/assets/parallel-worlds/
//      (sibling-checkout mod repo; optional so the build still works
//       when the mod repo isn't cloned locally — a stale copy under
//       git is fine as a fallback)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const MARKETING_ROOT = path.resolve(path.dirname(__filename), "..");
const REPO_ROOT = path.resolve(MARKETING_ROOT, "..");

const PW_MOD_BLOCK_DIR = path.resolve(
  REPO_ROOT,
  "..",
  "parallel-worlds",
  "src",
  "main",
  "resources",
  "assets",
  "parallelworlds",
  "textures",
);

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
    label: "parallel-worlds/block",
    src: path.join(PW_MOD_BLOCK_DIR, "block"),
    dest: path.join(MARKETING_ROOT, "public", "assets", "parallel-worlds"),
    optional: true,
    merge: true,
  },
  {
    label: "parallel-worlds/item",
    src: path.join(PW_MOD_BLOCK_DIR, "item"),
    dest: path.join(MARKETING_ROOT, "public", "assets", "parallel-worlds"),
    optional: true,
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

let skipped = 0;
for (const m of MIRRORS) {
  if (!fs.existsSync(m.src)) {
    if (m.optional) {
      console.log(`[sync-assets] skip ${m.label} (source not found: ${m.src})`);
      skipped++;
      continue;
    }
    console.error(`[sync-assets] ERROR: required source missing: ${m.src}`);
    process.exit(1);
  }
  if (!m.merge) rimraf(m.dest);
  copyDir(m.src, m.dest);
  console.log(`[sync-assets] ${m.label} → ${path.relative(MARKETING_ROOT, m.dest)}`);
}

console.log(`[sync-assets] done${skipped > 0 ? ` (${skipped} optional skipped)` : ""}`);
